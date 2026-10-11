import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { loadEnv } from "../../apps/api/src/config/env.js";
import { connectDatabase } from "../../apps/api/src/config/database.js";
import { createApp } from "../../apps/api/src/app.js";
import { seedPersistentDemo } from "../../apps/api/src/demo/persistentSeed.js";
import { accountDefinitions } from "../../apps/api/src/demo/scenario.js";
import { cleanupTestDatabase } from "../../apps/api/test/helpers/cleanup.js";
import Delivery from "../../apps/api/src/models/Delivery.js";
import User from "../../apps/api/src/models/User.js";

const dbName = `aquashield_browser_ui_${randomUUID().replaceAll("-", "")}`;
const passwords = Object.fromEntries(
  accountDefinitions.map((account) => [
    account.key,
    randomBytes(24).toString("hex"),
  ]),
);
let server, origin, recordedMap;
const pending = new Set();
test.beforeAll(async () => {
  const config = {
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
  await mkdir(".local/qa/ui", { recursive: true });
});
test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await cleanupTestDatabase(dbName);
});
test.beforeEach(async ({ page }) => {
  recordedMap = null;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    pending.add(route);
    try {
      const response = await route.fetch({
        url: `${origin}${url.pathname}${url.search}`,
      });
      if (url.pathname === "/api/dashboard/map" && response.status() === 200)
        recordedMap = (await response.json()).data;
      await route.fulfill({ response });
    } catch (error) {
      // Selection/navigation cancels abandoned frontend requests. Do not turn
      // that supported cancellation into a fixture failure; other errors fail.
      if (
        route.request().failure()?.errorText === "net::ERR_ABORTED" ||
        error.message.includes("Route is already handled")
      )
        return;
      throw error;
    } finally {
      pending.delete(route);
    }
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
async function signIn(page, key, path = "/login") {
  const account = accountDefinitions.find((entry) => entry.key === key);
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(passwords[key]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/(?:citizen\/)?login(?:\?|$)/);
  await expect.poll(() => pending.size).toBe(0);
}
async function checkLayout(page, label, info, width) {
  await expect.poll(() => pending.size).toBe(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".environment-indicator")).toHaveText(
    "Demonstration Environment · simulated data",
  );
  await expect(page.locator("main")).not.toContainText(
    /Phase\s*\d|Phases\s*\d/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${label} overflow at ${width}`,
  ).toBe(true);
  await page.screenshot({
    path: `.local/qa/ui/${info.project.name}-${label}-${width}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `.local/qa/ui/${info.project.name}-${label}-${width}-viewport.png`,
  });
}
test("municipal routes, real seeded evidence and navigation fit desktop, tablet and mobile", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "admin");
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of [
      "",
      "reports",
      "tankers",
      "allocations",
      "deliveries",
      "predictions",
      "analytics",
      "audit",
      "advisories",
    ]) {
      await page.goto(`/admin${route ? `/${route}` : ""}`);
      await expect(
        page.getByRole("navigation", { name: "Administrator navigation" }),
      ).toBeVisible();
      await expect(page.locator(".admin-toolbar a.active")).toHaveCount(1);
      // Capture loaded data rather than only the initial loading frame.
      await expect(
        page.getByRole("status").filter({ hasText: /^Loading/ }),
      ).toHaveCount(0);
      await checkLayout(page, route || "dashboard", info, viewport.width);
    }
  }
  expect(errors).toEqual([]);
});
test("zone filters, selection, empty state and tile retry retain authorized map access", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.goto("/admin");
  const map = page.getByLabel("Geographic shortage map");
  await expect(map).toContainText("Street tiles are unavailable");
  await expect.poll(() => recordedMap).not.toBeNull();
  const recordedLayers = recordedMap;
  await map.getByLabel("Eligible tankers only", { exact: true }).check();
  await expect(map.locator('rect[fill="#235579"]')).toHaveCount(
    recordedLayers.tankers.filter(
      (tanker) => tanker.eligibility?.eligible === true,
    ).length,
  );
  await map.getByLabel("Eligible tankers only", { exact: true }).uncheck();
  const zones = page.getByLabel("Shortage zones", { exact: true });
  await page
    .getByLabel("Map severity", { exact: true })
    .selectOption("CRITICAL");
  await expect(zones.locator("button").first()).toContainText("CRITICAL");
  await page.getByLabel("Map area", { exact: true }).fill("Panchavati");
  await expect(zones.locator("button").first()).toContainText("Panchavati");
  const eventTable = page.getByLabel("Shortage event table");
  await expect(eventTable.locator("tbody tr")).toHaveCount(
    await zones.locator("button").count(),
  );
  await expect(eventTable.locator("tbody")).not.toContainText("Satpur");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: /^Shortage evidence for/ }),
  ).toHaveCount(0);
  await zones.locator("button").first().click();
  await expect(
    page.getByRole("region", { name: /^Shortage evidence for Panchavati/ }),
  ).toBeVisible();
  await page
    .getByLabel("Map event status", { exact: true })
    .selectOption("ACTIVE");
  await expect(zones.locator("button").first()).toContainText("ACTIVE");
  await page
    .getByLabel("Map area", { exact: true })
    .fill("No such service area");
  await expect(zones).toContainText("No shortage zones match");
  await expect(eventTable).toContainText("No events match");
  await page.getByRole("button", { name: "Reset map filters" }).click();
  await expect(zones.locator("button").first()).toBeVisible();
  await map.getByRole("button", { name: "Street view", exact: true }).click();
  await expect(map).toContainText("Street tiles are unavailable");
  await page.getByLabel("Map area", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Map severity", { exact: true })).toBeFocused();
});
test("citizen and operator screens preserve role navigation across three viewport sizes", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const citizen = accountDefinitions.find(
    (account) => account.role === "CITIZEN",
  );
  const assigned = await Delivery.findOne({ isDemo: true, status: "ASSIGNED" });
  expect(assigned).not.toBeNull();
  const operatorAccount = await User.findById(assigned.operatorId);
  const operator = accountDefinitions.find(
    (account) => account.email === operatorAccount.email,
  );
  expect(operator?.role).toBe("OPERATOR");
  await signIn(page, citizen.key, "/citizen/login");
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [route, label] of [
      ["/", "citizen-home"],
      ["/report", "report"],
      ["/my-reports", "history"],
      ["/my-alerts", "alerts"],
    ]) {
      await page.goto(route);
      await expect(
        page.getByRole("link", { name: "Municipal team", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "My Alerts", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: /^Loading/ }),
      ).toHaveCount(0);
      await checkLayout(page, label, info, viewport.width);
    }
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, operator.key);
  await page.goto("/operator");
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("navigation", { name: "Assignment sections" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Municipal team", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start trip", exact: true }).first(),
    ).toBeVisible();
    await checkLayout(page, "operator", info, viewport.width);
  }
});
