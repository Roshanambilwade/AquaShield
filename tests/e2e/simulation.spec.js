import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { loadEnv } from "../../apps/api/src/config/env.js";
import { connectDatabase } from "../../apps/api/src/config/database.js";
import { createApp } from "../../apps/api/src/app.js";
import { prepareSimulation } from "../../apps/api/src/services/simulationService.js";
import { simulationAccounts } from "../../apps/api/src/simulation/scenario.js";
import { cleanupTestDatabase } from "../../apps/api/test/helpers/cleanup.js";
import Report from "../../apps/api/src/models/Report.js";
import Allocation from "../../apps/api/src/models/Allocation.js";
import Delivery from "../../apps/api/src/models/Delivery.js";
import User from "../../apps/api/src/models/User.js";
import Tanker from "../../apps/api/src/models/Tanker.js";
let app, server, origin;
const dbName = `aquashield_simulation_test_${randomUUID().replaceAll("-", "")}`;
const passwords = Object.fromEntries(
  simulationAccounts.map((a) => [a.key, randomBytes(24).toString("hex")]),
);
test.beforeAll(async () => {
  const base = loadEnv();
  const config = {
    ...base,
    NODE_ENV: "test",
    SIMULATION_ENABLED: true,
    SIMULATION_PREPARE_ENABLED: true,
    SIMULATION_DATABASE_NAME: dbName,
    MONGODB_TEST_DB_NAME: dbName,
    MONGODB_URI: base.MONGODB_URI.replace(
      /(mongodb(?:\+srv)?:\/\/[^/]+\/)[^?]*/,
      `$1${dbName}`,
    ),
    DEMONSTRATION_MODE: true,
    DEMO_AI_MODE: true,
    FORECAST_DEMO_ENABLED: true,
    SIMULATION_TICK_INTERVAL_MS: 60000,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config);
  await prepareSimulation(config, passwords);
  app = createApp(config);
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  origin = `http://127.0.0.1:${server.address().port}`;
  await mkdir(".local/qa/simulation", { recursive: true });
});
test.afterAll(async () => {
  await app?.locals.simulation.close();
  if (server) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  await cleanupTestDatabase(dbName);
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    try {
      const response = await route.fetch({
        url: `${origin}${url.pathname}${url.search}`,
      });
      await route.fulfill({ response });
    } catch (e) {
      if (
        route.request().failure()?.errorText !== "net::ERR_ABORTED" &&
        !e.message.includes("Route is already handled")
      )
        throw e;
    }
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
async function login(page, key, path = "/login") {
  const account = simulationAccounts.find((a) => a.key === key);
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(passwords[key]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/(?:citizen\/)?login(?:\?|$)/);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
async function logout(page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
}
test("administrator simulation controls, live saved progress, errors and three responsive viewports", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await login(page, "admin");
  await page.getByRole("link", { name: "Simulation", exact: true }).click();
  await expect(page.getByTestId("simulation-status")).toHaveText("READY");
  await expect(
    page.getByText("INSUFFICIENT_DATA", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start simulation", exact: true })
    .click();
  await expect(page.getByTestId("simulation-status")).toHaveText("RUNNING");
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByTestId("simulation-status")).toHaveText("PAUSED");
  await page.getByLabel("Simulation speed").selectOption("2");
  await expect(page.getByLabel("Simulation speed")).toHaveValue("2");
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect(page.getByTestId("simulation-status")).toHaveText("RUNNING");
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByTestId("simulation-status")).toHaveText("PAUSED");
  for (let tick = 1; tick <= 6; tick++) {
    const completed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/simulation/command") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Advance one tick", exact: true })
      .click();
    expect((await completed).status()).toBe(200);
    await expect(page.getByTestId("simulation-tick")).toHaveText(String(tick));
  }
  expect(await Report.countDocuments()).toBe(18);
  expect(await Allocation.countDocuments()).toBe(0);
  await page.reload();
  await expect(page.getByTestId("simulation-tick")).toHaveText("6");
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/qa/simulation/${info.project.name}-${width}.png`,
      fullPage: true,
    });
  }
  await page.route(
    "**/api/simulation",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          code: "DATABASE_UNAVAILABLE",
          message: "Simulation services temporarily unavailable.",
        }),
      }),
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Refresh saved simulation", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/simulation") && response.status() === 200,
  );
  await page
    .getByRole("button", { name: "Refresh saved simulation", exact: true })
    .click();
  const saved = await (await refreshed).json();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Saved simulation refreshed at" }),
  ).toContainText("Status: PAUSED; tick 6 / 24");
  await expect(page.getByTestId("simulation-tick")).toHaveText("6");
  // Terminal state is a read-only UI fixture; preserve the real paused run for
  // the following end-to-end municipal workflow.
  await page.route(
    "**/api/simulation",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...saved,
          data: {
            ...saved.data,
            run: { ...saved.data.run, status: "STOPPED", tick: 24 },
          },
        }),
      }),
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Refresh saved simulation", exact: true })
    .click();
  await expect(page.getByTestId("simulation-status")).toHaveText("STOPPED");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Simulation completed its 24-tick limit" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop simulation", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Start simulation", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Resume simulation", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Advance one tick", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Refresh saved simulation", exact: true })
    .click();
  await expect(page.getByTestId("simulation-status")).toHaveText("PAUSED");
  expect(await Report.countDocuments()).toBe(18);
});
test("generated reports feed manual review, allocation, owned OTP delivery and citizen inbox", async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page, "admin");
  if ((await Report.countDocuments()) === 0) {
    await page.goto("/admin/simulation");
    for (let tick = 1; tick <= 6; tick++) {
      await page
        .getByRole("button", { name: "Advance one tick", exact: true })
        .click();
      await expect(page.getByTestId("simulation-tick")).toHaveText(
        String(tick),
      );
    }
  }
  const report = await Report.findOne({
    areaId: "AREA_01",
    verificationStatus: "PENDING",
  }).sort({ createdAt: 1 });
  await page.goto(`/admin/reports/${report.id}`);
  await page
    .getByLabel("Review note (required)")
    .fill(
      "Synthetic submitted evidence reviewed; no physical field inspection.",
    );
  await page
    .getByRole("button", { name: "Verify submitted evidence", exact: true })
    .click();
  await expect(
    page.getByText("Current review state: VERIFIED.", { exact: false }),
  ).toBeVisible();
  await page.goto("/admin/allocations");
  await page
    .getByText("Record verified demand and delivery evidence", { exact: true })
    .click();
  await page.getByLabel("Verified demand (L)").fill("4000");
  await page.getByLabel("Previous-day delivered water (L)").fill("0");
  await page
    .getByLabel("Evidence source / ledger reference")
    .fill("Synthetic scenario ledger; simulated input, not field measurement.");
  await page
    .getByRole("button", { name: "Save verified evidence", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Request allocation recommendation",
      exact: true,
    })
    .click();
  const card = page.getByRole("article", { name: /^Allocation / }).first();
  await expect(card).toContainText("RECOMMENDED");
  await card
    .getByRole("button", { name: "Approve allocation", exact: true })
    .click();
  await expect(card).toContainText("APPROVED");
  await card
    .getByRole("button", { name: "Assign approved tanker", exact: true })
    .click();
  await expect(card).toContainText("ASSIGNED");
  const allocation = await Allocation.findOne({ status: "ASSIGNED" });
  const operator = await User.findById(allocation.operatorId);
  const key = simulationAccounts.find((a) => a.email === operator.email).key;
  const tanker = await Tanker.findById(allocation.tankerId);
  const starting = tanker.availableLitres;
  await logout(page);
  await login(page, key, "/login?returnTo=/operator");
  await expect
    .poll(() => Delivery.countDocuments({ allocationId: allocation._id }))
    .toBe(1);
  const delivery = await Delivery.findOne({ allocationId: allocation._id });
  const trip = page.getByRole("article", {
    name: `Trip ${delivery.id}`,
    exact: true,
  });
  await trip.getByRole("button", { name: "Start trip", exact: true }).click();
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
  expect((await Tanker.findById(tanker.id)).availableLitres).toBe(
    starting - 400,
  );
  expect((await Delivery.findById(delivery.id)).litresDelivered).toBe(400);
  await logout(page);
  await login(page, "admin");
  await page.goto("/admin/analytics");
  const delivered = page
    .getByRole("region", { name: "Observed municipal activity" })
    .locator(".analytics-evidence > div")
    .filter({
      has: page.getByText("Recorded delivered litres", { exact: true }),
    });
  await expect(delivered.locator("dd")).toHaveText("400");
  await page.goto("/admin/audit");
  // Search excludes its end: include the just-completed current minute, and
  // select the trip journal rather than its separate allocation journal.
  await page
    .getByLabel("To (UTC, exclusive)")
    .fill(new Date(Date.now() + 60000).toISOString().slice(0, 16));
  await page
    .getByLabel("Target type", { exact: true })
    .selectOption("DELIVERY");
  await page
    .getByLabel("Event type", { exact: true })
    .fill("DELIVERY_COMPLETED");
  await page.getByRole("button", { name: "Search audit history" }).click();
  await expect(
    page.getByRole("link", { name: "DELIVERY_COMPLETED", exact: true }),
  ).toHaveCount(1);
  await page.goto("/admin/advisories");
  await page
    .getByLabel("Service area", { exact: true })
    .selectOption("AREA_01");
  await page.getByLabel("Advisory category").selectOption("DEMONSTRATION");
  await page.getByLabel("Evidence type").selectOption("SIMULATED");
  await page
    .getByLabel("Evidence ID or stable simulated scenario key")
    .fill("simulation-panchavati-reviewed");
  await page
    .getByRole("button", { name: "Publish advisory", exact: true })
    .click();
  await expect(page.getByRole("article").first()).toBeVisible();
  await page.goto("/admin/simulation");
  await expect(
    page.getByText("400 recorded simulated L", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Stop simulation", exact: true })
    .click();
  await expect(page.getByTestId("simulation-status")).toHaveText("STOPPED");
  await logout(page);
  await login(page, "citizen-1", "/citizen/login");
  await page.goto("/my-reports");
  await expect(
    page.getByText("Panchavati", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/my-alerts");
  await page.getByLabel("Preferred service area").selectOption("AREA_01");
  const advisory = page
    .getByRole("article")
    .filter({ hasText: "Simulated demonstration advisory" })
    .first();
  await expect(advisory).toBeVisible();
  await advisory
    .getByRole("button", { name: "Mark as read", exact: true })
    .click();
  await page.reload();
  await expect(
    advisory.getByRole("button", { name: "Mark as unread", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/simulation");
  await expect(
    page.getByRole("button", { name: "Advance one tick", exact: true }),
  ).toHaveCount(0);
});
