import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { createApp } from "../../apps/api/src/app.js";
import { loadEnv } from "../../apps/api/src/config/env.js";
import { connectDatabase } from "../../apps/api/src/config/database.js";
import { cleanupTestDatabase } from "../../apps/api/test/helpers/cleanup.js";
import {
  createAdmin,
  createOperator,
  loginAdmin,
} from "../../apps/api/src/services/authService.js";
import { citizenSession } from "../../apps/api/test/helpers/citizen.js";
import { createReport } from "../../apps/api/src/services/reportService.js";
import { saveTanker } from "../../apps/api/src/services/operationsService.js";
import { prepareForecastFixture } from "../../apps/api/src/demo/forecastFixture.js";
import Report from "../../apps/api/src/models/Report.js";
import Tanker from "../../apps/api/src/models/Tanker.js";
import ForecastObservation from "../../apps/api/src/models/ForecastObservation.js";
const dbName = `aquashield_browser_acceptance_${randomUUID().replaceAll("-", "")}`;
let config, server, origin, admin, token, citizen, tanker;
test.beforeAll(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    MONGODB_TEST_DB_NAME: dbName,
    DEMONSTRATION_MODE: true,
    DEMO_SEED_ENABLED: true,
    FORECAST_DEMO_ENABLED: true,
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config);
  const password = randomBytes(24).toString("hex");
  admin = await createAdmin({
    email: "browser-acceptance@example.test",
    password,
  });
  token = (await loginAdmin(admin.email, password, config)).token;
  citizen = await citizenSession(config);
  const op = await createOperator({
    email: "browser-acceptance-op@example.test",
    name: "Synthetic operator",
    password,
  });
  tanker = await saveTanker(
    null,
    {
      identifier: "BROWSER-OBS01",
      name: "Synthetic inspection tanker",
      capacityLitres: 10000,
      availableLitres: 8000,
      status: "AVAILABLE",
      operatorId: op.id,
      currentLocation: { lat: 20, lng: 73.78 },
      observedAt: new Date(Date.now() - 86400000),
    },
    { id: admin.id, role: "ADMIN" },
    true,
  );
  await prepareForecastFixture(config);
  server = createApp(config, {
    aiDependencies: {
      invoke: async () => {
        throw new Error("Synthetic outage");
      },
    },
  }).listen(0, "127.0.0.1");
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
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${u.pathname}${u.search}`,
    });
    await route.fulfill({ response });
  });
});
test.afterEach(async ({ page }) => page.unrouteAll({ behavior: "wait" }));
async function session(page, value) {
  if (page.url() === "about:blank") await page.goto("/");
  await page.evaluate(
    (t) => sessionStorage.setItem("aquashield-admin-session", t),
    value,
  );
}
test("administrator reviews evidence and rejects another report without claiming field resolution", async ({
  page,
}) => {
  await session(page, token);
  for (const [status, button] of [
    ["VERIFIED", "Verify submitted evidence"],
    ["REJECTED", "Reject report"],
  ]) {
    const { report } = await createReport(
      {
        submissionId: randomUUID(),
        areaId: "AREA_01",
        locality: "Panchavati",
        location: { lat: 20.011, lng: 73.79 },
        locationSource: "MANUAL",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        householdSize: 5,
      },
      citizen.user,
      config,
    );
    await page.goto(`/admin/reports/${report.id}`);
    await expect(
      page.getByRole("heading", { name: "Evidence review", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Review note (required)")
      .fill("Controlled simulated submitted-evidence review");
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(
      page.getByText(`Current review state: ${status}.`, { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(`Current review state: ${status}.`, { exact: false }),
    ).toBeVisible();
    expect((await Report.findById(report.id)).verificationStatus).toBe(status);
    await expect(
      page.getByText(/not a physical field inspection/),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("municipal publication reaches selected citizen area; read state and selection survive refresh and login", async ({
  page,
}) => {
  await session(page, token);
  await page.goto("/admin/advisories");
  await page
    .getByLabel("Service area", { exact: true })
    .selectOption("AREA_01");
  await page.getByLabel("Advisory category").selectOption("DEMONSTRATION");
  await page.getByLabel("Evidence type").selectOption("SIMULATED");
  await page
    .getByLabel("Evidence ID or stable simulated scenario key")
    .fill(`browser-notice-${randomUUID()}`);
  await page
    .getByRole("button", { name: "Publish advisory", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Saved municipal advisory state" }),
  ).toBeVisible();
  await session(page, citizen.token);
  await page.goto("/my-alerts");
  await page.getByLabel("Preferred service area").selectOption("AREA_01");
  const card = page
    .getByRole("article")
    .filter({ hasText: "Simulated local advisory" })
    .first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Simulated demonstration advisory");
  await card.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Mark as unread", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    card.getByRole("button", { name: "Mark as unread", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  // Login uses the normal auth endpoint; test credentials stay in memory.
  const result = await page.request.post(`${origin}/api/auth/login`, {
    data: { email: citizen.user.email, password: citizen.password },
  });
  expect(result.status()).toBe(200);
  await session(page, (await result.json()).data.token);
  await page.goto("/my-alerts");
  await expect(page.getByLabel("Preferred service area")).toHaveValue(
    "AREA_01",
  );
  await expect(
    card.getByRole("button", { name: "Mark as unread", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Preferred service area").selectOption("AREA_02");
  await expect(
    page.getByText("No relevant advisories in this view.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("explicit tanker observation and source-separated forecast evaluation use real MongoDB on desktop/mobile", async ({
  page,
}) => {
  await session(page, token);
  await page.goto("/admin/tankers");
  const card = page.getByRole("article").filter({ hasText: "BROWSER-OBS01" });
  await card
    .getByText("Record simulated present-time observation", { exact: true })
    .click();
  await card
    .getByLabel("Simulated inspection note")
    .fill("Authorized simulated present state assessed for this fixture");
  await card
    .getByLabel(
      "I assessed this simulated present state and authorize its recording.",
    )
    .check();
  await card
    .getByRole("button", { name: "Save simulated observation", exact: true })
    .click();
  await expect(card).toContainText("Allocation eligibility: Eligible");
  const stored = await Tanker.findById(tanker.id);
  expect(stored.observations).toHaveLength(1);
  await page.goto("/admin/predictions");
  await page
    .getByLabel("Prediction history source")
    .selectOption("SYNTHETIC_FORECAST");
  await expect(
    page.getByText("Prediction over synthetic demonstration observations.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Evaluate current evidence", exact: true })
    .click();
  await expect(
    page.getByText(
      "Numerical evaluation completed and saved. No AI provider was requested.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("article", {
      name: "Prediction for Panchavati",
      exact: true,
    }),
  ).toContainText("40 eligible reports");
  await expect(
    page.getByRole("article", {
      name: "Prediction for Panchavati",
      exact: true,
    }),
  ).toContainText("CRITICAL");
  expect(await ForecastObservation.countDocuments()).toBe(190);
  await page
    .getByLabel("Prediction history source")
    .selectOption("REPORT_HISTORY");
  await expect(
    page.getByRole("article", {
      name: "Prediction for Panchavati",
      exact: true,
    }),
  ).toContainText("INSUFFICIENT DATA");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
