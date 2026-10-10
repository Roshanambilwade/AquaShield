import { cleanupTestDatabase } from "../../apps/api/test/helpers/cleanup.js";
import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createApp } from "../../apps/api/src/app.js";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
} from "../../apps/api/src/config/database.js";
import { createAdmin } from "../../apps/api/src/services/authService.js";
import User from "../../apps/api/src/models/User.js";
import Report from "../../apps/api/src/models/Report.js";
import AdminSession from "../../apps/api/src/models/AdminSession.js";

const dbName = `aquashield_browser_citizen_${randomUUID().replaceAll("-", "")}`;
const password = randomBytes(24).toString("hex");
let server, origin;
test.beforeAll(async () => {
  const config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: true,
    GEMINI_API_KEY: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config, { dbName });
  await createAdmin({
    name: "Municipal reviewing officer",
    email: "officer@browser.test",
    password,
  });
  server = createApp(config).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await cleanupTestDatabase(dbName);
});
async function forward(page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
}
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(10000);
  await forward(page);
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
async function register(page, name, email) {
  await page.goto("/register");
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Account created");
}
async function signIn(page, email, path = "/citizen/login") {
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("citizen registers, logs in, submits, revisits history and officers review unverified reporter evidence", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90000);
  const email = "resident@browser.test";
  await page.goto("/report");
  await expect(page).toHaveURL(/\/citizen\/login\?returnTo=/);
  await register(page, "Reporting resident", email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/my-reports$/);
  await expect(page.getByText(/Email unverified/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No reports here yet." }),
  ).toBeVisible();
  await page.goto("/report");
  await page.getByLabel("Or choose a locality center").selectOption("AREA_01");
  await page.getByLabel("Problem type").selectOption("NO_WATER");
  await page.getByLabel("How many people are in your household?").fill("5");
  await page.getByLabel("Approximate shortage duration (hours)").fill("24");
  await page.getByLabel("Current household water level").selectOption("EMPTY");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Account-owned household evidence.");
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/reports") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  const saved = await pending;
  expect(saved.status()).toBe(201);
  const reportId = (await saved.json()).data.id;
  const owner = await User.findOne({ email });
  expect((await Report.findById(reportId)).ownerId.toString()).toBe(owner.id);
  await page
    .getByRole("link", { name: "Track this report", exact: true })
    .click();
  await expect(page.getByText(reportId, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(reportId, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, email);
  await expect(
    page.getByRole("heading", { name: "Panchavati", exact: true }),
  ).toBeVisible();
  await mkdir(".local/qa", { recursive: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/qa/phase65-history-${info.project.name}.png`,
    fullPage: true,
  });
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:4174" });
  const stranger = await other.newPage();
  try {
    await forward(stranger);
    await register(stranger, "Another resident", "another@browser.test");
    await signIn(stranger, "another@browser.test");
    await expect(
      stranger.getByRole("heading", { name: "No reports here yet." }),
    ).toBeVisible();
    await stranger.goto(`/report/${reportId}`);
    await expect(stranger.getByRole("alert")).toContainText(
      "not available to your account",
    );
    await expect(
      stranger.getByText("Account-owned household evidence."),
    ).toHaveCount(0);
  } finally {
    await stranger.unrouteAll({ behavior: "ignoreErrors" });
    await other.close();
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, "officer@browser.test", "/login");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/reports");
  await expect(
    page.getByRole("heading", { name: "Citizen reports", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(email, { exact: false })).toBeVisible();
  await page
    .getByRole("link", { name: "Review report evidence", exact: true })
    .click();
  await expect(
    page.getByText("Reporting resident", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Name and email are account-provided/),
  ).toBeVisible();
  await expect(
    page.getByText("Account-owned household evidence."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/qa/phase65-officer-${info.project.name}.png`,
    fullPage: true,
  });
});
test("registration duplicate errors are safe and expiration clears personal history before sign-in", async ({
  page,
}) => {
  if (!(await User.exists({ email: "resident@browser.test" }))) {
    await register(page, "Reporting resident", "resident@browser.test");
    // This test normally follows the complete workflow above.
    // When run alone, create a minimal owned report through the real API.
    await signIn(page, "resident@browser.test");
    await expect(page).toHaveURL(/\/my-reports$/);
    await page.goto("/report");
    await page
      .getByLabel("Or choose a locality center")
      .selectOption("AREA_01");
    await page.getByLabel("Problem type").selectOption("NO_WATER");
    await page.getByLabel("How many people are in your household?").fill("5");
    await page
      .getByRole("button", { name: "Submit report", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your report has been received." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
  }
  await page.goto("/register");
  await page.getByLabel("Full name", { exact: true }).fill("Duplicate attempt");
  await page.getByLabel("Email", { exact: true }).fill("resident@browser.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Unable to create an account with these details",
  );
  await signIn(page, "resident@browser.test");
  await expect(
    page.getByRole("heading", { name: "Panchavati", exact: true }),
  ).toBeVisible();
  const owner = await User.findOne({ email: "resident@browser.test" });
  await AdminSession.updateMany(
    { userId: owner.id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await page.reload();
  await expect(page).toHaveURL(/\/citizen\/login/);
  await expect(
    page.getByRole("heading", { name: "Panchavati", exact: true }),
  ).toHaveCount(0);
  await signIn(page, "resident@browser.test");
  await expect(
    page.getByRole("heading", { name: "Panchavati", exact: true }),
  ).toBeVisible();
});
