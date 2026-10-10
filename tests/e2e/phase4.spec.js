import ShortageEvent from "../../apps/api/src/models/ShortageEvent.js";
import Report from "../../apps/api/src/models/Report.js";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { prepareBrowserAdmin } from "../helpers/admin.js";
import { seedDemoReports } from "../../apps/api/src/demo/seedReports.js";
let admin;
test.beforeAll(async () => {
  admin = await prepareBrowserAdmin();
  await seedDemoReports();
});
test.afterAll(async () => {
  await admin.cleanup();
});

test("anonymous admin access redirects, real login rejects bad credentials and logout revokes the session", async ({
  page,
}) => {
  await page.goto("/admin?demo=true");
  await expect(
    page.getByRole("heading", { name: "Administrator sign in" }),
  ).toBeVisible();
  expect((await page.request.get("/api/dashboard/map")).status()).toBe(401);
  await page.getByLabel("Email", { exact: true }).fill(admin.email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Email or password is incorrect",
  );
  await page.getByLabel("Password", { exact: true }).fill(admin.password);
  const login = page.waitForResponse(
    (r) => r.url().endsWith("/api/auth/login") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const token = (await (await login).json()).data.token;
  await expect(page).toHaveURL("/admin?demo=true");
  await expect(page.getByLabel("Command center metrics")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Administrator sign in" }),
  ).toBeVisible();
  expect(
    (
      await page.request.get("/api/dashboard/map", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/alerts?demo=true");
  await expect(page.getByLabel("Geographic shortage map")).toBeVisible();
  await expect(page.getByLabel("Citizen reports", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Open event details" }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence and severity" }),
  ).toBeVisible();
  await expect(page.getByLabel("Municipal assessment context")).toHaveCount(0);
});

test("command center shows eight honest KPIs, Panchavati, activity, analytics and AI extension", async ({
  page,
}, info) => {
  await admin.signIn(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin?demo=true");
  const metrics = page.getByLabel("Command center metrics");
  await expect(page).toHaveTitle("Municipal overview | AquaShield");
  const nextSteps = page.getByRole("navigation", {
    name: "Municipal next steps",
  });
  await expect(
    nextSteps.getByRole("link", { name: "Review fair allocation" }),
  ).toHaveAttribute("href", "/admin/allocations?demo=true");
  await expect(
    nextSteps.getByRole("link", { name: "Explore report-activity forecasts" }),
  ).toHaveAttribute("href", "/admin/predictions?demo=true");
  await expect(metrics.locator("article")).toHaveCount(8);
  await expect(
    metrics.getByLabel("Active Shortages", { exact: true }),
  ).toContainText("4");
  await expect(
    metrics.getByLabel("Critical Areas", { exact: true }),
  ).toContainText("1");
  await expect(
    metrics.getByLabel("Estimated People Affected", { exact: true }),
  ).toContainText("~1,040");
  for (const label of [
    "Available Tankers",
    "Tankers En Route",
    "Water Delivered",
    "Average Response Time",
    "High-Risk Areas",
  ])
    await expect(metrics.getByLabel(label, { exact: true })).toContainText(
      "Unknown",
    );
  await expect(
    page.getByRole("region", { name: "Shortage evidence for Panchavati" }),
  ).toBeVisible();
  await expect(page.getByLabel("Recent activity")).toContainText("simulated");
  await expect(page.getByLabel("AquaShield AI recommendation")).toContainText(
    "No AI recommendation has been generated",
  );
  await expect(page.getByLabel("Shortage analytics")).toContainText("42");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/phase4-${info.project.name}.png`,
    fullPage: true,
  });
});

test("interactive map supports layers, zoom, keyboard pan, fit and zone inspection", async ({
  page,
}) => {
  await admin.signIn(page);
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/admin?demo=true");
  const map = page.getByLabel("Geographic shortage map");
  await expect(map).toContainText("Street tiles are unavailable");
  await expect(map).toContainText("66 report locations available");
  await map.getByLabel("Citizen reports", { exact: true }).check();
  await expect(map.locator('circle[fill="#326aa0"]')).toHaveCount(66);
  await map.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(map).toContainText("150%");
  const canvas = map.locator("svg");
  await canvas.focus();
  await canvas.press("ArrowRight");
  await expect(canvas.locator("g").first()).toHaveAttribute(
    "transform",
    /translate\(370,230\)/,
  );
  await map.getByRole("button", { name: "Fit all zones" }).click();
  await expect(map).toContainText("100%");
  await map.getByRole("button", { name: "Inspect Adgaon, MEDIUM" }).click();
  await expect(
    page.getByRole("region", { name: "Shortage evidence for Adgaon" }),
  ).toBeVisible();
  await map.getByLabel("Emerging evidence", { exact: true }).uncheck();
  await expect(map.locator("circle[stroke-dasharray]")).toHaveCount(0);
});

test("Leaflet street view opens severity popups and retains private layer controls", async ({
  page,
}) => {
  await admin.signIn(page);
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/admin?demo=true");
  const map = page.getByLabel("Geographic shortage map");
  await expect(map.locator(".leaflet-container")).toBeVisible();
  await expect(map.locator(".leaflet-marker-icon")).toHaveCount(5);
  await map.getByRole("button", { name: "Inspect Satpur, HIGH" }).click();
  await expect(map.locator(".leaflet-popup-content")).toContainText(
    "Shortage confidence",
  );
  await expect(
    page.getByRole("region", { name: "Shortage evidence for Satpur" }),
  ).toBeVisible();
  await map.getByRole("button", { name: "Zoom in", exact: true }).click();
  await map.getByRole("button", { name: "Fit all zones" }).click();
  await map.getByRole("button", { name: "Coordinate view" }).click();
  await expect(map.locator("svg.map-canvas")).toBeVisible();
});

test("event table filters and full detail retain estimates and unknown delivery history", async ({
  page,
}) => {
  await admin.signIn(page);
  await page.goto("/admin?demo=true");
  const table = page.getByLabel("Shortage event table");
  await table.getByLabel("Severity filter").selectOption("CRITICAL");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await table.getByLabel("Search area").fill("missing-area");
  await expect(table).toContainText("No events match");
  await table.getByLabel("Search area").fill("Panchavati");
  await table.getByRole("button", { name: "Panchavati", exact: true }).click();
  await page.getByRole("link", { name: "Open event details" }).click();
  await expect(page.getByLabel("Municipal assessment context")).toContainText(
    "Unknown — delivery records are not configured",
  );
  await expect(page.getByLabel("Municipal assessment context")).toContainText(
    "Request urgent municipal assessment",
  );
  await expect(
    page.getByRole("region", { name: "Shortage evidence for Panchavati" }),
  ).toContainText("~588");
  await page
    .getByRole("navigation", { name: "Administrator navigation" })
    .getByRole("link", { name: "Analytics", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shortage analytics", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Shortage analytics")).toContainText(
    "All records shown are simulated",
  );
});

test("dashboard service failures have safe retry states and recover", async ({
  page,
}) => {
  await admin.signIn(page);
  let fail = true;
  await page.route("**/api/dashboard/summary?demo=true", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        json: {
          success: false,
          code: "DATABASE_UNAVAILABLE",
          message: "Administrator evidence is temporarily unavailable.",
        },
      });
    else await route.continue();
  });
  await page.goto("/admin?demo=true");
  await expect(page.getByRole("alert").first()).toContainText(
    "temporarily unavailable",
  );
  fail = false;
  await page.getByRole("button", { name: "Retry dashboard summary" }).click();
  await expect(
    page
      .getByLabel("Command center metrics")
      .getByLabel("Critical Areas", { exact: true }),
  ).toContainText("1");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("expired browser session loses admin access, reporting requires sign-in and public alerts stay available", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("aquashield-admin-session", "f".repeat(64)),
  );
  await page.goto("/admin/analytics");
  await expect(
    page.getByRole("heading", { name: "Administrator sign in" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("aquashield-admin-session"),
    ),
  ).toBeNull();
  await page.goto("/report");
  await expect(
    page.getByRole("heading", { name: "Citizen sign in" }),
  ).toBeVisible();
  expect((await page.request.post("/api/reports", { data: {} })).status()).toBe(
    401,
  );
  await page.goto("/alerts?demo=true");
  await expect(
    page.getByRole("heading", { name: "Water crisis overview", exact: true }),
  ).toBeVisible();
});

test("F8 detection refreshes the selected event context without changing its ID", async ({
  page,
}) => {
  await admin.signIn(page);
  await page.goto("/admin?demo=true");
  const context = page.getByLabel("Municipal assessment context");
  const hero = await ShortageEvent.findOne({ isDemo: true, areaId: "AREA_01" });
  const count = await Report.countDocuments({
    _id: { $in: hero.reportIds },
    waterLevel: "EMPTY",
  });
  await expect(
    context.getByText(`EMPTY: ${count} reports`, { exact: true }),
  ).toBeVisible();
  const report = await Report.findOne({
    _id: { $in: hero.reportIds },
    waterLevel: "EMPTY",
  });
  expect(report).not.toBeNull();
  await Report.updateOne(
    { _id: report._id },
    { $set: { waterLevel: "ABOVE_50" } },
  );
  try {
    const refreshed = page.waitForResponse(
      (r) =>
        r.url().includes("/api/dashboard/shortages/") && r.status() === 200,
    );
    await page.getByRole("button", { name: "Run detection" }).click();
    const response = await refreshed;
    const payload = (await response.json()).data;
    expect(payload.event.id).toBe(hero.id);
    expect(payload.waterLevels.EMPTY).toBe(count - 1);
    await expect(
      context.getByText(`EMPTY: ${count - 1} reports`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Shortage evidence for Panchavati" }),
    ).toContainText(String(payload.event.reportCount));
  } finally {
    await Report.updateOne(
      { _id: report._id },
      { $set: { waterLevel: "EMPTY" } },
    );
    await page.getByRole("button", { name: "Run detection" }).click();
    await expect(
      context.getByText(`EMPTY: ${count} reports`, { exact: true }),
    ).toBeVisible();
  }
});
