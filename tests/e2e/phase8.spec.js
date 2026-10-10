import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import mongoose from "mongoose";
import { mkdir } from "node:fs/promises";
import { createApp } from "../../apps/api/src/app.js";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../apps/api/src/config/database.js";
import {
  createAdmin,
  loginAdmin,
} from "../../apps/api/src/services/authService.js";
import Report, {
  initializeReportStorage,
} from "../../apps/api/src/models/Report.js";
import Prediction from "../../apps/api/src/models/Prediction.js";
import { activityReports } from "../../apps/api/test/helpers/predictions.js";
const dbName = `aquashield_browser_phase8_${randomUUID().replaceAll("-", "")}`;
let server, origin, token;
test.beforeAll(async () => {
  const config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMONSTRATION_MODE: false,
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config, { dbName });
  const password = randomBytes(24).toString("hex"),
    user = await createAdmin({ email: "browser@phase8.test", password });
  token = (await loginAdmin(user.email, password, config)).token;
  await initializeReportStorage();
  await Report.insertMany(
    activityReports({ now: new Date() }).map((r) => ({
      ...r,
      _id: createHash("sha256").update(r._id).digest("hex").slice(0, 24),
      submissionId: randomUUID(),
      locality: "Panchavati",
      locationSource: "LOCALITY_CENTER",
      problem: "NO_WATER",
      waterLevel: "EMPTY",
      householdSize: 4,
    })),
  );
  const app = createApp(config, {
    aiDependencies: {
      invoke: async () => {
        throw new Error("Synthetic outage");
      },
    },
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (
    mongoose.connection.name === dbName &&
    /^aquashield_browser_phase8_[a-f0-9]{32}$/.test(dbName)
  )
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${u.pathname}${u.search}`,
    });
    await route.fulfill({ response });
  });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
async function signIn(page) {
  await page.addInitScript(
    (t) => sessionStorage.setItem("aquashield-admin-session", t),
    token,
  );
}
test("numerical dashboard evaluates, separates observed/predicted activity and persists alert review on desktop/mobile", async ({
  page,
}, info) => {
  await signIn(page);
  await page.goto("/admin/predictions");
  await expect(
    page.getByRole("heading", { name: "Report activity forecasts" }),
  ).toBeVisible();
  await expect(
    page.getByText("No evaluation has been saved.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evaluate current evidence" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Numerical evaluation completed" }),
  ).toBeVisible();
  const detail = page.getByRole("article", {
    name: "Prediction for Panchavati",
  });
  await expect(detail).toContainText("CRITICAL · 85/100 index");
  await expect(detail).toContainText("≈ 4 over 6 hours");
  await expect(detail).toContainText("not a shortage probability");
  await expect(detail).toContainText("Observed operational severity");
  await detail.getByText("Accessible chart data", { exact: true }).click();
  await expect(
    detail.getByRole("cell", { name: "Predicted", exact: true }),
  ).toBeVisible();
  const alert = page.getByRole("article", { name: "Alert for Panchavati" });
  await alert.getByRole("button", { name: "Acknowledge alert" }).click();
  await expect(alert).toContainText("ACKNOWLEDGED");
  await alert
    .getByLabel("Resolution reason")
    .fill(
      "Municipal review recorded; physical supply requires separate verification.",
    );
  await alert.getByRole("button", { name: "Resolve alert" }).click();
  await expect(alert).toContainText("RESOLVED");
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Alert for Panchavati" }),
  ).toContainText("RESOLVED");
  await detail.getByRole("button", { name: "View forecast history" }).click();
  await expect(
    detail.getByRole("heading", { name: "Saved forecast history" }),
  ).toBeVisible();
  await detail
    .getByRole("button", { name: "Backtest report activity" })
    .click();
  await expect(detail).toContainText("INSUFFICIENT_VALIDATION_DATA");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/phase8-${info.project.name}.png`,
    fullPage: true,
  });
});
test("sparse, stale, loading and failure states stay honest without provider requests", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/predictions");
  await page.getByRole("button", { name: /Satpur/ }).click();
  await expect(
    page.getByRole("article", { name: "Prediction for Satpur" }),
  ).toContainText("INSUFFICIENT DATA");
  const p = await Prediction.findOne({ areaId: "AREA_01", isDemo: false });
  p.result.observationWindow.end = new Date(
    Date.now() - 48 * 3600000,
  ).toISOString();
  p.markModified("result");
  await p.save();
  await page.reload();
  await page.getByRole("button", { name: /Panchavati/ }).click();
  await expect(
    page.getByRole("article", { name: "Prediction for Panchavati" }),
  ).toContainText("STALE: this saved assessment");
  await page.route("**/api/predictions?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        code: "DATABASE_UNAVAILABLE",
        message: "Numerical data is temporarily unavailable.",
      }),
    });
  });
  await page.reload();
  await expect(page.getByText("Loading numerical predictions…")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
});
test("anonymous prediction page requires municipal authentication", async ({
  page,
}) => {
  await page.goto("/admin/predictions");
  await expect(
    page.getByRole("heading", { name: "Administrator sign in" }),
  ).toBeVisible();
});
