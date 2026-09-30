import { test, expect } from "@playwright/test";

async function enableNewsletter(page, { challengeFails = false } = {}) {
  await page.route("**/ute.studio/", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      /data-newsletter-sitekey="[^"]*"/,
      'data-newsletter-sitekey="1x00000000000000000000AA"',
    );
    await route.fulfill({ response, body: html });
  });
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    async (route) => {
      if (challengeFails) return route.abort();
      await route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile = {
      render(selector, options) { window.testChallenge = options; document.querySelector(selector).textContent = 'Security check complete'; queueMicrotask(() => options.callback('verified-test-token')); return 'test-widget'; },
      reset() { queueMicrotask(() => window.testChallenge.callback('new-verified-test-token')); }
    };`,
      });
    },
  );
  await page.goto("./");
  await page.locator("#newsletter").scrollIntoViewIfNeeded();
}

test("newsletter stays hidden until its public key is configured", async ({
  page,
}) => {
  await page.route("**/ute.studio/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        /data-newsletter-sitekey="[^"]*"/,
        'data-newsletter-sitekey=""',
      ),
    });
  });
  const calls = [];
  page.on("request", (request) => {
    if (/turnstile|api\/newsletter/.test(request.url()))
      calls.push(request.url());
  });
  await page.goto("./");
  await expect(page.locator("#newsletter")).toBeHidden();
  expect(calls).toEqual([]);
});

test("signup requires consent, submits once, and asks the reader to confirm email", async ({
  page,
}) => {
  let submitted;
  let requests = 0;
  await page.route("**/api/newsletter/subscribe", async (route) => {
    requests++;
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      json: { message: "Check your inbox for a confirmation email." },
    });
  });
  await enableNewsletter(page);
  const form = page.getByRole("form", { name: "Subscribe to Field Notes" });
  await form.getByLabel("Your email address").fill("reader@example.com");
  await form.getByRole("button").click();
  expect(requests).toBe(0);
  await form.getByRole("checkbox").check();
  await form.getByRole("button").click();
  await expect(form.getByRole("status")).toContainText("Check your inbox");
  await expect(form.getByRole("button")).toBeDisabled();
  expect(requests).toBe(1);
  expect(submitted).toEqual({
    email: "reader@example.com",
    consent: true,
    website: "",
    token: "verified-test-token",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("signup reports service errors and lets the reader retry", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/newsletter/subscribe", async (route) => {
    calls++;
    await route.fulfill(
      calls === 1
        ? {
            status: 503,
            json: { message: "Our email service is temporarily unavailable." },
          }
        : { status: 202, json: { message: "Check your inbox." } },
    );
  });
  await enableNewsletter(page);
  await page.getByLabel("Your email address").fill("reader@example.com");
  await page.locator("#newsletter").getByRole("checkbox").check();
  const button = page.locator("#newsletter").getByRole("button");
  await button.click();
  await expect(page.locator("#newsletter-status")).toContainText(
    "temporarily unavailable",
  );
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator("#newsletter-status")).toHaveText(
    "Check your inbox.",
  );
});

test("failed security script shows a useful message and cannot submit", async ({
  page,
}) => {
  await enableNewsletter(page, { challengeFails: true });
  await expect(page.locator("#newsletter-status")).toContainText(
    "security check couldn’t load",
  );
  await expect(page.locator("#newsletter").getByRole("button")).toBeDisabled();
});

test("expired security token disables submission until verification succeeds again", async ({
  page,
}) => {
  await enableNewsletter(page);
  const button = page.locator("#newsletter").getByRole("button");
  await expect(button).toBeEnabled();
  await page.evaluate(() => window.testChallenge["expired-callback"]());
  await expect(button).toBeDisabled();
  await expect(page.locator("#newsletter-status")).toContainText("expired");
  await page.evaluate(() => window.testChallenge.callback("fresh-token"));
  await expect(button).toBeEnabled();
});
