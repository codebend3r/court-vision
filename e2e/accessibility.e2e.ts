import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = [
  { path: "/login", heading: "Sign in" },
  { path: "/signup", heading: "Create your account" },
  { path: "/design", heading: "Design system" },
] as const;

const themes = ["light", "dark"] as const;
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

pages.forEach(({ path, heading }) => {
  themes.forEach((theme) => {
    test(`${path} has no WCAG A/AA violations in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
      const violations = results.violations.map(({ help, id, nodes }) => ({
        help,
        id,
        targets: nodes.flatMap(({ target }) => target),
      }));

      expect(violations).toEqual([]);
    });
  });
});

test("auth forms preserve keyboard order and visible focus", async ({ page }) => {
  await page.goto("/login");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("banner").getByRole("link", { name: "Court Vision" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("banner").getByRole("button")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await expect(page.getByLabel("Password")).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).not.toHaveCSS(
    "box-shadow",
    "none",
  );

  await page.goto("/signup");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("banner").getByRole("link", { name: "Court Vision" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("banner").getByRole("button")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Username")).toBeFocused();
  await expect(page.getByLabel("Username")).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await expect(page.getByLabel("Password")).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Create account" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Create account" })).not.toHaveCSS(
    "box-shadow",
    "none",
  );
});

test("design controls are keyboard operable", async ({ page }) => {
  await page.goto("/design");

  const offSwitch = page.getByRole("switch", { name: "Off" });
  await offSwitch.focus();
  await page.keyboard.press("Space");

  await expect(offSwitch).toBeChecked();
});
