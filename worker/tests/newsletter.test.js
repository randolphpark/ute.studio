import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { MockAgent, fetch as mockFetch } from "undici";
import worker from "../src/index.js";

const ORIGIN = "https://www.ute.studio";
const NOW = () => Math.floor(Date.now() / 1000);
const TOKEN = "a".repeat(64);
const HASH = (value) => createHash("sha256").update(value).digest("hex");
const schema = await readFile(
  new URL("../migrations/0001_newsletter.sql", import.meta.url),
  "utf8",
);

async function fixture(t, bindings = {}) {
  const mock = new MockAgent();
  mock.disableNetConnect();
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      scriptPath: new URL("../src/index.js", import.meta.url).pathname,
      compatibilityDate: "2026-06-11",
      bindings: {
        ENABLED: "true",
        SITE_ORIGIN: ORIGIN,
        NEWSLETTER_FROM: "UTE Studio <news@ute.studio>",
        NEWSLETTER_REPLY_TO: "contact@ute.studio",
        RESEND_API_KEY: "test-only-resend-key",
        TURNSTILE_SECRET_KEY: "test-only-turnstile-key",
        RESEND_SEGMENT_ID: "field-notes",
        ...bindings,
      },
      d1Databases: ["DB"],
      outboundService: async (request) => {
        const result = await mockFetch(request.url, {
          method: request.method,
          headers: Object.fromEntries(request.headers),
          body: request.method === "GET" ? undefined : await request.text(),
          dispatcher: mock,
        });
        return new Response(await result.arrayBuffer(), {
          status: result.status,
          headers: Object.fromEntries(result.headers),
        });
      },
    }),
  );
  const db = await mf.getD1Database("DB");
  await db.exec(schema.replace(/\n/g, " "));
  t.after(async () => {
    await mf.dispose();
    await mock.close();
  });
  const call = (path, method = "GET", body, headers = {}) =>
    mf.dispatchFetch(`${ORIGIN}/api/newsletter/${path}`, {
      method,
      headers: { ...(method === "POST" ? { Origin: ORIGIN } : {}), ...headers },
      body,
    });
  const signup = (data = {}, headers = {}) =>
    call(
      "subscribe",
      "POST",
      JSON.stringify({
        email: "reader@example.com",
        consent: true,
        token: "challenge-token",
        ...data,
      }),
      {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "192.0.2.1",
        ...headers,
      },
    );
  const verify = (result = {}, times = 1) =>
    mock
      .get("https://challenges.cloudflare.com")
      .intercept({ path: "/turnstile/v0/siteverify", method: "POST" })
      .reply(200, {
        success: true,
        hostname: "www.ute.studio",
        action: "newsletter",
        ...result,
      })
      .times(times);
  const api = (path, method, status, body = {}) =>
    mock
      .get("https://api.resend.com")
      .intercept({ path, method })
      .reply(status, body);
  const pending = async (
    email = "reader@example.com",
    expires = NOW() + 86400,
  ) =>
    db
      .prepare(
        "INSERT INTO pending_subscriptions (email, token_hash, requested_at, expires_at, last_sent_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(email, HASH(TOKEN), NOW(), expires, NOW())
      .run();
  const confirm = () =>
    call("confirm", "POST", `token=${TOKEN}`, {
      "Content-Type": "application/x-www-form-urlencoded",
    });
  return { mf, db, mock, call, signup, verify, api, pending, confirm };
}

test("disabled or incomplete setup fails closed without contacting providers", async (t) => {
  const f = await fixture(t, { RESEND_API_KEY: "" });
  const response = await f.signup();
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /not available yet/);
});

test("validates methods, origin, consent, email, content type and body size", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("subscribe")).status, 405);
  assert.equal((await f.call("unknown")).status, 404);
  assert.equal(
    (await f.signup({}, { Origin: "https://attacker.example" })).status,
    403,
  );
  assert.equal((await f.signup({ email: "bad@" })).status, 400);
  assert.equal((await f.signup({ consent: false })).status, 400);
  assert.equal((await f.signup({ token: "" })).status, 400);
  assert.equal((await f.call("subscribe", "POST", "email=x")).status, 415);
  assert.equal(
    (
      await f.call("subscribe", "POST", "{", {
        "Content-Type": "application/json",
      })
    ).status,
    400,
  );
  assert.equal((await f.signup({ email: "x".repeat(5000) })).status, 413);
  assert.equal((await f.signup({ website: "bot.example" })).status, 202);
});

test("checks Turnstile success, hostname and action before storing or sending", async (t) => {
  const f = await fixture(t);
  for (const result of [
    { success: false },
    { hostname: "other.example" },
    { action: "other" },
  ]) {
    f.verify(result);
    assert.equal((await f.signup()).status, 400);
  }
  assert.equal(
    (
      await f.db
        .prepare("SELECT COUNT(*) AS count FROM pending_subscriptions")
        .first()
    ).count,
    0,
  );
  f.mock.assertNoPendingInterceptors();
});

test("sends branded confirmation, stores only token hash, and deduplicates signup", async (t) => {
  const f = await fixture(t);
  f.verify({}, 2);
  let sent;
  f.mock
    .get("https://api.resend.com")
    .intercept({ path: "/emails", method: "POST" })
    .reply((options) => {
      sent = JSON.parse(Buffer.from(options.body).toString());
      return { statusCode: 200, data: JSON.stringify({ id: "email-1" }) };
    });
  assert.equal((await f.signup({ email: " Reader@Example.com " })).status, 202);
  assert.equal((await f.signup()).status, 202);
  assert.equal(sent.from, "UTE Studio <news@ute.studio>");
  assert.equal(sent.reply_to, "contact@ute.studio");
  assert.deepEqual(sent.to, ["reader@example.com"]);
  const token = /confirm\?token=([a-f0-9]{64})/.exec(sent.text)[1];
  const row = await f.db.prepare("SELECT * FROM pending_subscriptions").first();
  assert.equal(row.token_hash, HASH(token));
  assert.ok(!JSON.stringify(row).includes(token));
  assert.equal(row.expires_at - row.requested_at, 86400);
  assert.equal(
    (
      await f.db
        .prepare("SELECT COUNT(*) AS count FROM subscription_consents")
        .first()
    ).count,
    0,
  );
  f.mock.assertNoPendingInterceptors();
});

test("limits repeated signup by email and stores no raw IP address", async (t) => {
  const f = await fixture(t);
  f.verify({}, 4);
  f.api("/emails", "POST", 200, { id: "email-1" });
  for (let i = 0; i < 3; i++) assert.equal((await f.signup()).status, 202);
  assert.equal((await f.signup()).status, 429);
  const rows = await f.db.prepare("SELECT * FROM newsletter_rate_limits").all();
  assert.ok(!JSON.stringify(rows).includes("192.0.2.1"));
  f.mock.assertNoPendingInterceptors();
});

test("provider send failure is reported and leaves a valid token for a possible delayed email", async (t) => {
  const f = await fixture(t);
  f.verify();
  f.api("/emails", "POST", 503);
  assert.equal((await f.signup()).status, 503);
  const row = await f.db.prepare("SELECT * FROM pending_subscriptions").first();
  assert.equal(row.last_sent_at, 0);
  assert.ok(row.expires_at > NOW());
});

test("confirmation GET has no subscription side effects and hides token from referrers", async (t) => {
  const f = await fixture(t);
  await f.pending();
  const response = await f.call(`confirm?token=${TOKEN}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(await response.text(), /method="post"/);
  assert.equal(
    (
      await f.db
        .prepare("SELECT processing_until FROM pending_subscriptions")
        .first()
    ).processing_until,
    0,
  );
});

test("POST confirmation creates contact in the right segment once; replay cannot resubscribe", async (t) => {
  const f = await fixture(t);
  await f.pending();
  f.api("/contacts/reader%40example.com", "GET", 404);
  let contact;
  f.mock
    .get("https://api.resend.com")
    .intercept({ path: "/contacts", method: "POST" })
    .reply((options) => {
      contact = JSON.parse(Buffer.from(options.body).toString());
      return { statusCode: 200, data: JSON.stringify({ id: "contact-1" }) };
    });
  const response = await f.confirm();
  assert.equal(response.status, 200);
  assert.match(await response.text(), /You’re on the list/);
  assert.deepEqual(contact, {
    email: "reader@example.com",
    segments: [{ id: "field-notes" }],
  });
  assert.equal(
    await f.db.prepare("SELECT * FROM pending_subscriptions").first(),
    null,
  );
  assert.equal(
    (await f.db.prepare("SELECT * FROM subscription_consents").first())
      .consent_version,
    "field-notes-2026-09-30",
  );
  assert.match(await (await f.confirm()).text(), /already been used/);
  f.mock.assertNoPendingInterceptors();
});

test("existing subscribed contacts are added to the newsletter segment without changing global preference", async (t) => {
  const f = await fixture(t);
  await f.pending();
  f.api("/contacts/reader%40example.com", "GET", 200, {
    id: "contact-1",
    unsubscribed: false,
  });
  f.api("/contacts/reader%40example.com/segments/field-notes", "POST", 200, {
    id: "field-notes",
  });
  assert.equal((await f.confirm()).status, 200);
  f.mock.assertNoPendingInterceptors();
});

test("existing unsubscribe preferences survive new signup confirmation", async (t) => {
  const f = await fixture(t);
  await f.pending();
  f.api("/contacts/reader%40example.com", "GET", 200, {
    id: "contact-1",
    unsubscribed: true,
  });
  assert.match(
    await (await f.confirm()).text(),
    /unsubscribe preference is saved/,
  );
  assert.equal(
    await f.db.prepare("SELECT * FROM subscription_consents").first(),
    null,
  );
  assert.equal(
    await f.db.prepare("SELECT * FROM pending_subscriptions").first(),
    null,
  );
  f.mock.assertNoPendingInterceptors();
});

test("invalid, expired and locked confirmation tokens cannot enroll contacts", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("confirm?token=invalid")).status, 410);
  await f.pending("reader@example.com", NOW() - 1);
  assert.equal((await f.confirm()).status, 410);
  await f.db
    .prepare(
      "UPDATE pending_subscriptions SET expires_at = ?, processing_until = ?",
    )
    .bind(NOW() + 60, NOW() + 120)
    .run();
  assert.equal((await f.confirm()).status, 409);
});

test("failed confirmation releases its lock and can be retried", async (t) => {
  const f = await fixture(t);
  await f.pending();
  f.api("/contacts/reader%40example.com", "GET", 429);
  const response = await f.confirm();
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Your link is still valid/);
  assert.equal(
    (
      await f.db
        .prepare("SELECT processing_until FROM pending_subscriptions")
        .first()
    ).processing_until,
    0,
  );
});

test("scheduled cleanup removes expired pending data and old consent records", async (t) => {
  const f = await fixture(t);
  await f.pending("reader@example.com", NOW() - 1);
  await f.db
    .prepare("INSERT INTO newsletter_rate_limits VALUES (?, 1, ?)")
    .bind("old-key", NOW() - 1)
    .run();
  await f.db
    .prepare("INSERT INTO subscription_consents VALUES (?, ?, ?, ?)")
    .bind("old@example.com", "old-token", NOW() - 731 * 86400, "old")
    .run();
  await worker.scheduled({}, { DB: f.db });
  for (const table of [
    "pending_subscriptions",
    "newsletter_rate_limits",
    "subscription_consents",
  ])
    assert.equal(
      (await f.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first())
        .count,
      0,
    );
});
