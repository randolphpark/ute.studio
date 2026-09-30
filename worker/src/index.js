const PREFIX = "/api/newsletter";
const CONSENT_VERSION = "field-notes-2026-09-30";
const ACCEPTED =
  "Check your inbox for a confirmation email. If you just requested one, please use the latest link.";
const encoder = new TextEncoder();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function responseHeaders(type) {
  return {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders("application/json; charset=utf-8"),
  });
}
function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
function page(title, message, token = "", status = 200) {
  const action = token
    ? `<form method="post" action="${PREFIX}/confirm"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Confirm my subscription ↗</button></form>`
    : "";
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — UTE Studio</title><style>body{margin:0;background:#f5f3ed;color:#242520;font:16px/1.7 Arial,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:560px;padding:48px 24px}strong{font-size:28px;letter-spacing:-1px}small{display:block;color:#b83213;font-weight:bold;letter-spacing:2px;margin:40px 0 16px}h1{font-size:38px;line-height:1.1;letter-spacing:-1px}p{color:#55574d}button{border:0;padding:18px 24px;background:#c93717;color:white;font:inherit;font-weight:bold;cursor:pointer}a{color:inherit}a:focus-visible,button:focus-visible{outline:3px solid #e34b24;outline-offset:5px}.home{display:block;margin-top:32px}</style></head><body><main><strong>ute<span style="color:#e34b24">.</span>studio ⚙</strong><small>UTE STUDIO / FIELD NOTES</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${action}<a class="home" href="https://www.ute.studio/#newsletter">Back to UTE Studio →</a></main></body></html>`,
    { status, headers: responseHeaders("text/html; charset=utf-8") },
  );
}
async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
async function bodyText(request) {
  if (!request.body) throw new HttpError(400, "Please complete the form.");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) {
      await reader.cancel();
      throw new HttpError(413, "This request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
function configured(env) {
  return (
    env.ENABLED === "true" &&
    env.DB &&
    env.RESEND_API_KEY &&
    env.TURNSTILE_SECRET_KEY &&
    env.RESEND_SEGMENT_ID &&
    env.SITE_ORIGIN === "https://www.ute.studio" &&
    env.NEWSLETTER_FROM &&
    env.NEWSLETTER_REPLY_TO
  );
}
async function limited(env, identifier, max, period, now) {
  const key = await hash(`${env.TURNSTILE_SECRET_KEY}:${identifier}`);
  const row = await env.DB.prepare(
    `INSERT INTO newsletter_rate_limits (key, hits, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING hits`,
  )
    .bind(key, now + period, now, now)
    .first();
  return row.hits > max;
}
async function resend(env, path, method = "GET", body, idempotencyKey) {
  const headers = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const result = await fetch(`https://api.resend.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (result.status === 404 && method === "GET") return null;
  if (!result.ok)
    throw new HttpError(
      503,
      "Our email service is temporarily unavailable. Please try again shortly.",
    );
  return result.json();
}
function confirmationEmail(token, env) {
  const url = `${env.SITE_ORIGIN}${PREFIX}/confirm?token=${token}`;
  return {
    from: env.NEWSLETTER_FROM,
    reply_to: env.NEWSLETTER_REPLY_TO,
    subject: "Confirm your subscription to UTE Studio Field Notes",
    text: `One more step.\n\nConfirm your subscription to UTE Studio Field Notes: ${url}\n\nCreative ideas, AI experiments and product stories for ute, trade and touring brands. This link expires in 24 hours. You can unsubscribe from any newsletter.\n\nIf you didn't request this email, ignore it. You won't be subscribed.\n\nUTE Studio | https://www.ute.studio`,
    html: `<div style="background:#f5f3ed;padding:40px 24px;font-family:Arial,sans-serif;color:#242520"><div style="max-width:560px;margin:auto"><p style="font-size:28px"><b>ute<span style="color:#e34b24">.</span></b>studio</p><p style="font-size:12px;letter-spacing:2px;color:#b83213">FIELD NOTES</p><h1>One more step.</h1><p>Confirm your subscription for creative ideas, AI experiments and product stories for ute, trade and touring brands.</p><p style="margin:32px 0"><a href="${url}" style="background:#c93717;color:white;padding:16px 24px;display:inline-block;text-decoration:none">Confirm my subscription →</a></p><p>This link expires in 24 hours. You can unsubscribe from any newsletter.</p><p>If you didn’t request this email, ignore it. You won’t be subscribed.</p><p><a href="https://www.ute.studio" style="color:#242520">UTE Studio</a></p></div></div>`,
  };
}
async function subscribe(request, env) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new HttpError(415, "Please submit the signup form.");
  let data;
  try {
    data = JSON.parse(await bodyText(request));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Please complete the form.");
  }
  if (!data || typeof data !== "object")
    throw new HttpError(400, "Please complete the form.");
  if (data.website) return json({ message: ACCEPTED }, 202);
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
      email,
    )
  )
    throw new HttpError(400, "Please enter a valid email address.");
  if (data.consent !== true)
    throw new HttpError(400, "Please agree to receive UTE Studio Field Notes.");
  if (typeof data.token !== "string" || !data.token || data.token.length > 2048)
    throw new HttpError(400, "Please complete the security check.");
  const verification = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: data.token,
        remoteip: request.headers.get("CF-Connecting-IP") || undefined,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!verification.ok)
    throw new HttpError(
      503,
      "The security check is unavailable. Please try again.",
    );
  const result = await verification.json();
  if (
    !result.success ||
    result.hostname !== new URL(env.SITE_ORIGIN).hostname ||
    result.action !== "newsletter"
  )
    throw new HttpError(
      400,
      "The security check expired or failed. Please try again.",
    );
  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (
    (await limited(env, `ip:${ip}`, 10, 3600, now)) ||
    (await limited(env, `email:${email}`, 3, 3600, now)) ||
    (await limited(env, "all", 100, 86400, now))
  )
    throw new HttpError(429, "Too many requests. Please try again later.");
  const token = randomToken();
  const tokenHash = await hash(token);
  const saved = await env.DB.prepare(
    `INSERT INTO pending_subscriptions (email, token_hash, requested_at, expires_at, last_sent_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET token_hash = excluded.token_hash,
    requested_at = excluded.requested_at, expires_at = excluded.expires_at, last_sent_at = excluded.last_sent_at,
    processing_until = 0 WHERE pending_subscriptions.last_sent_at <= ? AND pending_subscriptions.processing_until <= ?
    RETURNING token_hash`,
  )
    .bind(email, tokenHash, now, now + 86400, now, now - 600, now)
    .first();
  if (!saved) return json({ message: ACCEPTED }, 202);
  try {
    await resend(
      env,
      "/emails",
      "POST",
      { ...confirmationEmail(token, env), to: [email] },
      `newsletter-confirm/${tokenHash}`,
    );
  } catch (error) {
    // Keep the token valid if the provider accepted the email before a timeout.
    await env.DB.prepare(
      "UPDATE pending_subscriptions SET last_sent_at = 0 WHERE token_hash = ?",
    )
      .bind(tokenHash)
      .run();
    throw error;
  }
  return json({ message: ACCEPTED }, 202);
}
async function confirm(request, env, url) {
  let token;
  if (request.method === "GET") token = url.searchParams.get("token");
  else {
    if (
      !request.headers
        .get("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      throw new HttpError(415, "Please use the confirmation button.");
    token = new URLSearchParams(await bodyText(request)).get("token");
  }
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return page(
      "This link is not valid.",
      "Please request a new confirmation email from the signup form.",
      "",
      410,
    );
  const tokenHash = await hash(token);
  const now = Math.floor(Date.now() / 1000);
  const pending = await env.DB.prepare(
    "SELECT * FROM pending_subscriptions WHERE token_hash = ? AND expires_at > ?",
  )
    .bind(tokenHash, now)
    .first();
  if (!pending) {
    const receipt = await env.DB.prepare(
      "SELECT confirmed_at FROM subscription_consents WHERE token_hash = ?",
    )
      .bind(tokenHash)
      .first();
    return receipt
      ? page(
          "This link has already been used.",
          "Your confirmation was previously recorded. This link will not change any later unsubscribe preferences.",
        )
      : page(
          "This link has expired.",
          "Please request a new confirmation email from the signup form.",
          "",
          410,
        );
  }
  // A GET only shows the form. Email security scanners cannot subscribe someone.
  if (request.method === "GET")
    return page(
      "Make it official.",
      "Confirm that you’d like to receive UTE Studio Field Notes. You can unsubscribe from any newsletter.",
      token,
    );
  const locked = await env.DB.prepare(
    "UPDATE pending_subscriptions SET processing_until = ? WHERE token_hash = ? AND processing_until <= ? AND expires_at > ? RETURNING email",
  )
    .bind(now + 120, tokenHash, now, now)
    .first();
  if (!locked)
    return page(
      "Confirmation is in progress.",
      "Please wait a moment before trying again.",
      token,
      409,
    );
  try {
    const contactPath = `/contacts/${encodeURIComponent(pending.email)}`;
    const contact = await resend(env, contactPath);
    if (contact?.unsubscribed) {
      await env.DB.prepare(
        "DELETE FROM pending_subscriptions WHERE token_hash = ?",
      )
        .bind(tokenHash)
        .run();
      return page(
        "Your unsubscribe preference is saved.",
        "This address previously opted out. To subscribe again, email contact@ute.studio so we can help update your preferences.",
      );
    }
    if (contact) {
      await resend(
        env,
        `${contactPath}/segments/${encodeURIComponent(env.RESEND_SEGMENT_ID)}`,
        "POST",
      );
    } else {
      // Do not send unsubscribed:false: a concurrent contact creation must not
      // overwrite a global opt-out. Resend remains the subscription authority.
      await resend(env, "/contacts", "POST", {
        email: pending.email,
        segments: [{ id: env.RESEND_SEGMENT_ID }],
      });
    }
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO subscription_consents (email, token_hash, confirmed_at, consent_version) VALUES (?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET token_hash = excluded.token_hash, confirmed_at = excluded.confirmed_at, consent_version = excluded.consent_version`,
      ).bind(pending.email, tokenHash, now, CONSENT_VERSION),
      env.DB.prepare(
        "DELETE FROM pending_subscriptions WHERE token_hash = ?",
      ).bind(tokenHash),
    ]);
    return page(
      "You’re on the list.",
      "Thanks for confirming. Look out for creative ideas and product stories from UTE Studio Field Notes.",
    );
  } catch {
    await env.DB.prepare(
      "UPDATE pending_subscriptions SET processing_until = 0 WHERE token_hash = ?",
    )
      .bind(tokenHash)
      .run();
    return page(
      "We couldn’t confirm just yet.",
      "Our email service is temporarily unavailable. Your link is still valid; please try again shortly.",
      token,
      503,
    );
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isConfirmation = url.pathname === `${PREFIX}/confirm`;
    try {
      if (![`${PREFIX}/subscribe`, `${PREFIX}/confirm`].includes(url.pathname))
        return json({ message: "Not found." }, 404);
      const allowed = isConfirmation ? ["GET", "POST"] : ["POST"];
      if (!allowed.includes(request.method))
        return json({ message: "Method not allowed." }, 405);
      if (!configured(env))
        throw new HttpError(
          503,
          "Newsletter signup is not available yet. Please try again later.",
        );
      if (
        request.method === "POST" &&
        request.headers.get("Origin") !== env.SITE_ORIGIN
      )
        throw new HttpError(
          403,
          "Please use the form on the UTE Studio website.",
        );
      return isConfirmation
        ? await confirm(request, env, url)
        : await subscribe(request, env);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      const message =
        error instanceof HttpError
          ? error.message
          : "We couldn’t complete your request. Please try again shortly.";
      // Never log addresses, confirmation tokens, provider bodies or secrets.
      return isConfirmation
        ? page("Please try again.", message, "", status)
        : json({ message }, status);
    }
  },
  async scheduled(_event, env) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM pending_subscriptions WHERE expires_at <= ?",
      ).bind(now),
      env.DB.prepare(
        "DELETE FROM newsletter_rate_limits WHERE expires_at <= ?",
      ).bind(now),
      env.DB.prepare(
        "DELETE FROM subscription_consents WHERE confirmed_at < ?",
      ).bind(now - 730 * 86400),
    ]);
  },
};
