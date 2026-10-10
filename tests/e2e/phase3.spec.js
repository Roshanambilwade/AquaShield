import mongoose from "mongoose";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../apps/api/src/config/database.js";
import { seedDemoReports } from "../../apps/api/src/demo/seedReports.js";
import { buildShortageEvents } from "../../apps/api/src/services/reportClusteringService.js";
import { detectShortages } from "../../apps/api/src/services/shortageService.js";
import { demoReports } from "../../apps/api/src/demo/reports.js";
import { demoAreas } from "../../apps/api/src/demo/areas.js";
import Report from "../../apps/api/src/models/Report.js";
import ShortageEvent from "../../apps/api/src/models/ShortageEvent.js";
import { prepareBrowserAdmin } from "../helpers/admin.js";
import { prepareBrowserCitizen } from "../helpers/citizen.js";
let admin;
const citizens = [];

const createdIds = [];
test.beforeAll(async () => {
  await connectDatabase(loadEnv());
  await seedDemoReports();
  admin = await prepareBrowserAdmin();
});
test.beforeEach(async ({ page }) => {
  await admin.signIn(page);
});
test.afterAll(async () => {
  if (createdIds.length)
    await Report.collection.deleteMany({
      _id: { $in: createdIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isDemo: false,
    });
  await detectShortages(loadEnv());
  await admin.cleanup();
  for (const citizen of citizens) await citizen.cleanup();
  await disconnectDatabase();
});

test("demo dashboard renders computed severities, confidence, population and geographic markers", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const expected = buildShortageEvents(demoReports(), demoAreas(), loadEnv());
  const hero = expected.find((e) => e.areaId === "AREA_01");
  await page.goto("/admin?demo=true");
  await expect(
    page.getByRole("heading", { name: "Water crisis overview" }),
  ).toBeVisible();
  const panel = page.getByRole("region", {
    name: "Shortage evidence for Panchavati",
  });
  await expect(
    panel.getByText(`${hero.severityScore}/100`, { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(`${hero.confidenceScore}%`, { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(`~${hero.estimatedAffectedPopulation}`, { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("31 (simulated)", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText(/not water remaining/).first()).toBeVisible();
  const zones = page.getByLabel("Shortage zones");
  for (const level of ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    await expect(zones.getByText(level, { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Geographic shortage map")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/phase3-dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("zone selection, emerging evidence, severity detail and detection refresh work", async ({
  page,
}) => {
  await page.goto("/admin?demo=true");
  await page.getByRole("button", { name: "Inspect Adgaon, MEDIUM" }).click();
  const emerging = page.getByRole("region", {
    name: "Shortage evidence for Adgaon",
  });
  await expect(
    emerging.getByText("Emerging risk · limited current evidence", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open event details" }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence and severity" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Shortage evidence for Adgaon" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to shortage overview" }).click();
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/shortages/detect") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Run detection" }).click();
  expect((await response).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Run detection" }),
  ).toBeEnabled();
});

test("real browser submissions create a MongoDB event and retain citizen privacy", async ({
  browser,
  page,
}) => {
  const contexts = [];
  const testIds = [];
  const testLocality = `Phase 3 browser verification ${randomUUID().slice(0, 8)}`;
  const testLatitude = String(40 + Math.random() * 20);
  const testLongitude = String(10 + Math.random() * 20);
  let firstReport;
  try {
    for (let i = 0; i < 3; i += 1) {
      const context = await browser.newContext({
        baseURL: "http://127.0.0.1:4174",
      });
      contexts.push(context);
      const citizen = await context.newPage();
      const account = await prepareBrowserCitizen();
      citizens.push(account);
      await account.signIn(citizen);
      await citizen.goto("/report");
      await citizen.getByLabel("Latitude", { exact: true }).fill(testLatitude);
      await citizen
        .getByLabel("Longitude", { exact: true })
        .fill(testLongitude);
      await citizen
        .getByLabel("Area / locality", { exact: true })
        .fill(testLocality);
      await citizen.getByLabel("Problem type").selectOption("NO_WATER");
      await citizen
        .getByLabel("Approximate shortage duration (hours)")
        .fill("24");
      await citizen
        .getByLabel("Current household water level")
        .selectOption("EMPTY");
      await citizen
        .getByLabel("How many people are in your household?")
        .fill(String(3 + i));
      const pending = citizen.waitForResponse(
        (r) =>
          r.url().endsWith("/api/reports") && r.request().method() === "POST",
      );
      await citizen
        .getByRole("button", { name: "Submit report", exact: true })
        .click();
      const response = await pending;
      const payload = await response.json();
      if (payload.data?.id) {
        createdIds.push(payload.data.id);
        testIds.push(payload.data.id);
      }
      expect(response.status()).toBe(201);
      expect(payload.data.detectionStatus).toBe("COMPLETE");
      if (i === 0) firstReport = { page: citizen, id: payload.data.id };
    }
    const event = await ShortageEvent.findOne({
      reportIds: firstReport.id,
      isDemo: false,
    });
    expect(event).not.toBeNull();
    expect(event.status).toBe("ACTIVE");
    expect(event.eligibleReportCount).toBe(3);
    expect(event.estimatedAffectedPopulation).toBe(48);
    expect(event.verifiedReportCount).toBe(0);
    await firstReport.page.goto(`/report/${firstReport.id}`);
    await expect(
      firstReport.page.getByRole("region", {
        name: `Shortage evidence for ${testLocality}`,
      }),
    ).toHaveCount(0);
    const publicResponse = await page.request.get(`/api/shortages/${event.id}`);
    expect(publicResponse.status()).toBe(404);
    await page.goto("/admin");
    await page
      .getByLabel("Shortage zones")
      .getByRole("button")
      .filter({ hasText: testLocality })
      .click();
    const panel = page.getByRole("region", {
      name: `Shortage evidence for ${testLocality}`,
    });
    await expect(
      panel.getByText(`${event.confidenceScore}%`, { exact: true }),
    ).toBeVisible();
    await expect(panel.getByText("~48", { exact: true })).toBeVisible();
    await expect(panel.getByText(/Partial severity/)).toBeVisible();
    await page.goto(`/report/${firstReport.id}`);
    await expect(page.getByRole("alert")).toContainText("citizen account");
  } finally {
    if (testIds.length)
      await Report.collection.deleteMany({
        _id: { $in: testIds.map((id) => new mongoose.Types.ObjectId(id)) },
        isDemo: false,
      });
    for (const context of contexts) await context.close();
  }
});

test("shortage loading, service error and retry recover to an empty state", async ({
  page,
}) => {
  let recovered = false;
  await page.route("**/api/dashboard/shortages?demo=false", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill(
      recovered
        ? {
            json: {
              success: true,
              data: {
                events: [],
                summary: {
                  activeShortages: 0,
                  criticalAreas: 0,
                  estimatedPeopleAffected: 0,
                  emergingAreas: 0,
                },
                isDemo: false,
              },
            },
          }
        : {
            status: 503,
            json: {
              success: false,
              code: "DATABASE_UNAVAILABLE",
              message:
                "Shortage evidence is temporarily unavailable. Please try again.",
            },
          },
    );
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("status").filter({ hasText: "Loading shortage evidence" }),
  ).toContainText("Loading shortage evidence");
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  recovered = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No shortage evidence yet." }),
  ).toBeVisible();
  await page.route("**/api/shortages/detect?demo=false", (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        code: "DATABASE_UNAVAILABLE",
        message:
          "Shortage evidence is temporarily unavailable. Please try again.",
      },
    }),
  );
  await page.getByRole("button", { name: "Run detection" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No shortage evidence yet." }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("unknown shortage event shows safe error and navigation", async ({
  page,
}) => {
  await page.goto(`/admin/shortages/${"0".repeat(24)}`);
  await expect(page.getByRole("alert")).toContainText("not available");
  await expect(
    page.getByRole("link", { name: "Back to shortage overview" }),
  ).toBeVisible();
});
