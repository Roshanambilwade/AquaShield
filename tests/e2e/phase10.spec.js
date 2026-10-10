import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
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
  createOperator,
  loginAdmin,
} from "../../apps/api/src/services/authService.js";
import { analyticsFixtures } from "../../apps/api/test/helpers/analyticsFixtures.js";
import Tanker from "../../apps/api/src/models/Tanker.js";
const dbName = `aquashield_browser_phase10_${randomUUID().replaceAll("-", "")}`;
let server, origin, token, f;
test.beforeAll(async () => {
  const config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMONSTRATION_MODE: false,
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config, { dbName });
  const password = randomBytes(24).toString("hex"),
    user = await createAdmin({ email: "browser@phase10.test", password });
  const op = await createOperator({
    email: "op@phase10.test",
    name: "Synthetic operator",
    password,
  });
  token = (await loginAdmin(user.email, password, config)).token;
  f = await analyticsFixtures(user._id, op._id);
  await Tanker.collection.updateOne(
    { identifier: "SYNTHETIC-AVAILABLE" },
    {
      $push: {
        audit: {
          $each: Array.from({ length: 25 }, (_, i) => ({
            _id: new mongoose.Types.ObjectId(),
            action: "TANKER_UPDATED",
            actorId: user._id,
            actorRole: "ADMIN",
            at: new Date(+f.from + (i + 1) * 60000),
            outcome: "SUCCESS",
            before: { status: "AVAILABLE" },
            after: { status: "AVAILABLE" },
          })),
        },
      },
    },
  );
  const app = createApp(config, {
    aiDependencies: {
      invoke: async () => {
        throw Error("Synthetic outage");
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
    /^aquashield_browser_phase10_[a-f0-9]{32}$/.test(dbName)
  )
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (t) => sessionStorage.setItem("aquashield-admin-session", t),
    token,
  );
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: `${origin}${u.pathname}${u.search}` }),
    });
  });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
async function dates(page, from = f.from, to = f.to) {
  await page
    .getByLabel("From (UTC, inclusive)")
    .fill(from.toISOString().slice(0, 16));
  await page
    .getByLabel("To (UTC, exclusive)")
    .fill(to.toISOString().slice(0, 16));
}
test("observed analytics filters, denominators, area comparison and separate predictions render on desktop/mobile", async ({
  page,
}, info) => {
  await page.goto("/admin/analytics");
  await expect(
    page.getByRole("heading", { name: "Observed municipal activity" }),
  ).toBeVisible();
  await dates(page);
  await page.getByRole("button", { name: "Apply analytics filters" }).click();
  const observed = page.getByRole("region", {
    name: "Observed municipal activity",
  });
  const metric = observed
    .locator(".analytics-evidence > div")
    .filter({ has: page.getByText("Reports submitted", { exact: true }) });
  await expect(metric.locator("dd")).toHaveText("4");
  await expect(observed).toContainText("82.5 min · 2 valid recorded timings");
  await expect(observed).toContainText(
    "1 eligible available · 1 busy/reserved · 3 total",
  );
  await expect(observed).toContainText(
    "NOT_EVALUATED: no current supported saved forecast",
  );
  await expect(observed).toContainText("No AI request was made");
  await page
    .getByLabel("Service area", { exact: true })
    .selectOption("AREA_02");
  await page.getByRole("button", { name: "Apply analytics filters" }).click();
  await expect(metric.locator("dd")).toHaveText("1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/phase10-analytics-${info.project.name}.png`,
    fullPage: true,
  });
});
test("audit pagination, exact search and safe event detail remain authorized and responsive", async ({
  page,
}, info) => {
  await page.goto("/admin/audit");
  await expect(
    page.getByRole("heading", { name: "Recorded events" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next audit page" }).click();
  await expect(
    page.getByText("Server-side page 2.", { exact: false }),
  ).toBeVisible();
  await dates(page);
  await page
    .getByLabel("Event type", { exact: true })
    .fill("ALLOCATION_APPROVED");
  await page
    .getByLabel("Correlation ID", { exact: true })
    .fill(f.correlationId);
  await page.getByLabel("Outcome", { exact: true }).selectOption("SUCCESS");
  await page.getByRole("button", { name: "Search audit history" }).click();
  await expect(
    page.getByRole("link", { name: "ALLOCATION_APPROVED", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("link", { name: "ALLOCATION_APPROVED", exact: true })
    .click();
  const detail = page.getByRole("region", { name: "Audit event detail" });
  await expect(detail).toContainText("RECOMMENDED");
  await expect(detail).toContainText("APPROVED");
  await expect(detail).toContainText("ADMIN");
  await expect(detail).toContainText(f.correlationId);
  await expect(detail).not.toContainText("PRIVATE_REASON");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/qa/phase10-audit-${info.project.name}.png`,
    fullPage: true,
  });
});
test("analytics error retry and empty historical window do not fabricate activity", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/dashboard/analytics?**", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        json: {
          success: false,
          code: "ANALYTICS_TIMEOUT",
          message: "Narrow the date range and retry.",
        },
      });
    } else await route.fallback();
  });
  await page.goto("/admin/analytics");
  await expect(page.getByRole("alert")).toContainText("Narrow the date range");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByRole("heading", { name: "Observed municipal activity" }),
  ).toBeVisible();
  await dates(
    page,
    new Date(+f.from - 10 * 86400000),
    new Date(+f.from - 9 * 86400000),
  );
  await page.getByRole("button", { name: "Apply analytics filters" }).click();
  await expect(
    page.getByText("No report submissions in this window.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No historical activity to chart.", { exact: true }),
  ).toBeVisible();
});
test("audit no-match search and session expiry protect the restricted portal", async ({
  page,
}) => {
  await page.goto("/admin/audit");
  await expect(
    page.getByRole("heading", { name: "Recorded events" }),
  ).toBeVisible();
  await page
    .getByLabel("Event type", { exact: true })
    .fill("NONEXISTENT_EVENT");
  await page.getByRole("button", { name: "Search audit history" }).click();
  await expect(
    page.getByText("No audit events match these filters."),
  ).toBeVisible();
  await page.evaluate(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        Authorization:
          "Bearer " + sessionStorage.getItem("aquashield-admin-session"),
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  });
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: "Recorded events" }),
  ).toHaveCount(0);
});
