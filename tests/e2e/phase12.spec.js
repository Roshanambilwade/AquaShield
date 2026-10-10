import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("presentation navigation, keyboard focus and citizen sign-in remain usable", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/citizen/login");
  await expect(page).toHaveTitle("Citizen sign in | AquaShield");
  const email = page.getByLabel("Email", { exact: true });
  await email.focus();
  await page.keyboard.press("Tab");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toBeFocused();
  const style = await password.evaluate((node) => {
    const css = getComputedStyle(node);
    return {
      outline: css.outlineStyle,
      width: css.outlineWidth,
      height: node.getBoundingClientRect().height,
    };
  });
  expect(style.outline).toBe("solid");
  expect(parseFloat(style.width)).toBeGreaterThanOrEqual(2);
  expect(style.height).toBeGreaterThanOrEqual(44);
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toHaveAttribute("href", "#main-content");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/phase12-signin-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Local alerts" })
    .click();
  await expect(page).toHaveTitle("Local alerts | AquaShield");
  await expect(page.locator("#main-content")).toBeFocused();
});
