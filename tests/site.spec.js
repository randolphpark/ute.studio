import { test, expect } from "@playwright/test";

test("landing page loads its assets and fits the viewport", async ({
  page,
}) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto("./");
  await expect(page).toHaveTitle(/UTE Studio/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "BUILT TO WORK.",
  );
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    [...document.images]
      .filter((image) => !image.closest("dialog"))
      .every((image) => image.complete && image.naturalWidth > 0),
  );
  await expect(
    page.locator('a[href="mailto:contact@ute.studio"]').first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(failures).toEqual([]);
});

test("every campaign opens the right preview, image, and enquiry", async ({
  page,
}) => {
  await page.goto("./");
  const concepts = [
    ["workhorse", "The everyday workhorse.", "ute-hero.webp"],
    ["toolbox", "Every detail earns its place.", "toolbox.webp"],
    ["touring", "Clock off. Head out.", "touring.webp"],
  ];
  for (const [key, title, image] of concepts) {
    const project = page.locator(`[data-project="${key}"]`);
    await project.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading")).toHaveText(title);
    await expect(dialog).toContainText("Self-initiated AI visual concept");
    await expect(dialog.locator("img")).toHaveAttribute("src", `assets/${image}`);
    await expect.poll(() => dialog.locator("img").evaluate(
      (img) => img.complete && img.naturalWidth > 0,
    )).toBeTruthy();
    const enquiry = new URL(await dialog.getByRole("link").getAttribute("href"));
    expect(enquiry.protocol).toBe("mailto:");
    expect(enquiry.pathname).toBe("contact@ute.studio");
    expect(enquiry.searchParams.get("subject")).toBe(`Project enquiry: ${title}`);
    if (key === "toolbox")
      await page.getByRole("button", { name: "Close project details" }).click();
    else await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(project).toBeFocused();
  }
});

test("every page link reaches real content or the published enquiry address", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  const links = page.locator("a[href]");
  const sectionTargets = ["#top", "#main", "#work", "#studio", "#services", "#contact"];
  for (let index = 0; index < await links.count(); index++) {
    const link = links.nth(index);
    const href = await link.getAttribute("href");
    if (href.startsWith("mailto:")) {
      // Inspect email destinations without launching an app or sending mail.
      expect(new URL(href).pathname).toBe("contact@ute.studio");
      continue;
    }
    expect(sectionTargets).toContain(href);
    if (testInfo.project.name === "mobile" && await link.evaluate((el) => !!el.closest("nav")))
      await page.getByRole("button", { name: "Menu" }).click();
    await link.focus();
    await link.click();
    expect(new URL(page.url()).hash).toBe(href);
    if (href === "#top")
      await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(5);
    else await expect(page.locator(href)).toBeInViewport();
  }
});

test("navigation and service details work with mobile and desktop layouts", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("navigation")).toBeVisible();
  }
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "What we do" })
    .click();
  await expect(page).toHaveURL(/#services$/);
  if (testInfo.project.name === "mobile")
    await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  for (const details of await page.locator(".service-list details").all()) {
    if (await details.evaluate((el) => el.open))
      await details.locator("summary").click();
    await details.locator("summary").click();
    await expect(details.locator(".service-body")).toBeVisible();
    await details.locator("summary").click();
    await expect(details.locator(".service-body")).toBeHidden();
  }
});
