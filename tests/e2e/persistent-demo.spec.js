import { cleanupTestDatabase } from "../../apps/api/test/helpers/cleanup.js";
import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
} from "../../apps/api/src/config/database.js";
import { createApp } from "../../apps/api/src/app.js";
import { seedPersistentDemo } from "../../apps/api/src/demo/persistentSeed.js";
import { accountDefinitions } from "../../apps/api/src/demo/scenario.js";
import Allocation from "../../apps/api/src/models/Allocation.js";
import Delivery from "../../apps/api/src/models/Delivery.js";
import Tanker from "../../apps/api/src/models/Tanker.js";
import Report from "../../apps/api/src/models/Report.js";
import User from "../../apps/api/src/models/User.js";
const dbName = `aquashield_browser_demo_${randomUUID().replaceAll("-", "")}`;
const passwords = Object.fromEntries(
  accountDefinitions.map((a) => [a.key, randomBytes(24).toString("hex")]),
);
let config, server, origin;
test.beforeAll(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMONSTRATION_MODE: true,
    DEMO_SEED_ENABLED: true,
    DEMO_DATABASE_NAME: "aquashield_demo",
    MONGODB_TEST_DB_NAME: dbName,
    DEMO_AI_MODE: true,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config);
  await seedPersistentDemo(config, passwords);
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
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(10000);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
async function signIn(page, key, path) {
  const a = accountDefinitions.find((a) => a.key === key);
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(passwords[key]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("persistent scenario: admin approval, owned operator trip, demo OTP, accounting and seed preservation", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await signIn(page, "admin", "/login");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByText(/AquaShield — Demonstration Environment/),
  ).toBeVisible();
  await expect(
    page.getByText("Panchavati", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/admin/tankers");
  await expect(
    page.getByRole("button", { name: "Edit FAC-T01", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset demo operations" }),
  ).toHaveCount(0);
  await page.goto("/admin/allocations");
  let card = page.getByRole("article", { name: /^Allocation / }).first();
  await expect(card).toContainText("RECOMMENDED");
  await card
    .getByLabel("Rejection reason")
    .fill("Faculty review before a fresh recommendation");
  await card.getByRole("button", { name: "Reject allocation" }).click();
  await expect(card).toContainText("REJECTED");
  await page.getByLabel(/Request an agent explanation/).check();
  await page
    .getByRole("button", { name: "Request allocation recommendation" })
    .click();
  card = page.getByRole("article", { name: /^Allocation / }).first();
  await expect(card).toContainText("RECOMMENDED");
  await expect(card).toContainText("Demo AI simulation — no Gemini execution");
  await card.getByRole("button", { name: "Approve allocation" }).click();
  await expect(card).toContainText("APPROVED");
  await card.getByRole("button", { name: "Assign approved tanker" }).click();
  await expect(card).toContainText("ASSIGNED");
  const allocation = await Allocation.findOne({ status: "ASSIGNED" }).sort({
    createdAt: -1,
  });
  const operator = await User.findById(allocation.operatorId);
  const key = accountDefinitions.find((a) => a.email === operator.email).key;
  const starting = (await Tanker.findById(allocation.tankerId)).availableLitres;
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, key, "/login?returnTo=/operator");
  await expect(page).toHaveURL(/\/operator$/);
  await expect(
    page.getByText(`Assignment ${allocation.id}`, { exact: true }),
  ).toBeVisible();
  const delivery = await Delivery.findOne({ allocationId: allocation._id });
  const trip = page.getByRole("article", {
    name: `Trip ${delivery.id}`,
    exact: true,
  });
  await expect(trip).toContainText("ASSIGNED");
  await trip.getByRole("button", { name: "Start trip", exact: true }).click();
  await expect(trip).toContainText("EN_ROUTE");
  await page.reload();
  await expect(trip).toContainText("EN_ROUTE");
  await trip.getByRole("button", { name: "Mark arrived", exact: true }).click();
  await expect(trip).toContainText("ARRIVED");
  await trip
    .getByRole("button", { name: "Generate demo OTP", exact: true })
    .click();
  const code = trip.getByRole("status").filter({ hasText: "Demo-only OTP:" });
  await expect(code).toBeVisible();
  await trip
    .getByLabel("Delivery OTP", { exact: true })
    .fill((await code.textContent()).match(/\d{6}/)[0]);
  await trip
    .getByRole("button", { name: "Verify delivery OTP", exact: true })
    .click();
  await trip.getByLabel("Actual litres delivered", { exact: true }).fill("400");
  await trip
    .getByRole("button", { name: "Complete delivery", exact: true })
    .click();
  await expect(trip).toContainText("DELIVERED");
  expect((await Tanker.findById(delivery.tankerId)).availableLitres).toBe(
    starting - 400,
  );
  const saved = (await Delivery.findById(delivery.id)).toObject();
  const repeated = await seedPersistentDemo(config, passwords);
  expect(repeated.counts.allocations.inserted).toBe(0);
  expect((await Delivery.findById(delivery.id)).toObject()).toEqual(saved);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/persistent-demo-${info.project.name}.png`,
    fullPage: true,
  });
});
test("new citizen reports accumulate in the same demo database and remain owned after renewed login", async ({
  page,
}) => {
  test.setTimeout(60000);
  const email = `new-${randomUUID()}@example.test`,
    password = randomBytes(24).toString("hex");
  const count = await Report.countDocuments();
  await page.goto("/register");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Faculty scenario resident");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Account created" }),
  ).toBeVisible();
  expect(await Report.countDocuments()).toBe(count);
  const login = async () => {
    await page.goto("/citizen/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/my-reports$/);
  };
  await login();
  await expect(
    page.getByRole("heading", { name: "No reports here yet." }),
  ).toBeVisible();
  await page.goto("/report");
  await page
    .getByLabel("Or choose a locality center")
    .selectOption("DEMO_AREA_06");
  await page.getByLabel("Problem type").selectOption("NO_WATER");
  await page.getByLabel("How many people are in your household?").fill("4");
  await page.getByLabel("Approximate shortage duration (hours)").fill("6");
  await page
    .getByLabel("Current household water level")
    .selectOption("LESS_THAN_25");
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/reports") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  const response = await pending;
  expect(response.status()).toBe(201);
  const id = (await response.json()).data.id;
  expect((await Report.findById(id)).isDemo).toBe(true);
  await page
    .getByRole("link", { name: "Track this report", exact: true })
    .click();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login();
  await expect(
    page.getByText("Demonstration East Sector", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/my-reports?demo=true");
  await expect(
    page.getByRole("heading", { name: "My reports", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Demonstration East Sector", { exact: true }).first(),
  ).toBeVisible();
  expect(await Report.countDocuments()).toBe(count + 1);
  await seedPersistentDemo(config, passwords);
  expect(await Report.countDocuments()).toBe(count + 1);
});
