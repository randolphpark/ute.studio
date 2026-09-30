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

test("campaign previews open, close with Escape, and restore focus", async ({
  page,
}) => {
  await page.goto("./");
  const project = page.getByRole("button", {
    name: "View Every detail earns its place product concept",
  });
  await project.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText(
    "Every detail earns its place.",
  );
  await expect(dialog).toContainText("AI-generated style study");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(project).toBeFocused();
  await page
    .getByRole("button", { name: "View Clock off. Head out. touring concept" })
    .click();
  await expect(dialog.getByRole("heading")).toHaveText("Clock off. Head out.");
  await page.getByRole("button", { name: "Close project details" }).click();
  await expect(dialog).not.toBeVisible();
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
  await page
    .locator("summary")
    .filter({ hasText: "3D & product animation" })
    .click();
  await expect(
    page.getByText("Show the details a single photo can’t."),
  ).toBeVisible();
});
