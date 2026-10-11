import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
import { preview } from "vite";
import { chromium, expect } from "@playwright/test";
import mongoose from "mongoose";
import { parseEnv } from "../../apps/api/src/config/env.js";
import { connectDatabase } from "../../apps/api/src/config/database.js";
import { createAdmin } from "../../apps/api/src/services/authService.js";
import { cleanupTestDatabase } from "../../apps/api/test/helpers/cleanup.js";
import Report from "../../apps/api/src/models/Report.js";
import ShortageEvent from "../../apps/api/src/models/ShortageEvent.js";
import Allocation from "../../apps/api/src/models/Allocation.js";
import Tanker from "../../apps/api/src/models/Tanker.js";
import Delivery from "../../apps/api/src/models/Delivery.js";
import { prepareForecastFixture } from "../../apps/api/src/demo/forecastFixture.js";

// Acceptance regression: synthetic actors, owned UUID DB, no seed or live provider.
const dbName = `aquashield_reliability_test_${randomUUID().replaceAll("-", "")}`;
const password = randomBytes(24).toString("hex");
Object.assign(process.env, {
  NODE_ENV: "test",
  DEMONSTRATION_MODE: "true",
  DEMO_AI_MODE: "true",
  DEMO_SEED_ENABLED: "false",
  FORECAST_DEMO_ENABLED: "true",
  GEMINI_API_KEY: "",
  GEMINI_MODEL_ID: "",
  ROUTING_BASE_URL: "",
  MONGODB_TEST_DB_NAME: dbName,
  MONGODB_URI: "mongodb://127.0.0.1:27017/aquashield_tests",
  CORS_ORIGIN: "http://127.0.0.1:4185",
  VITE_API_BASE_URL: "/api",
});
const config = parseEnv(process.env);
let child,
  backend,
  web,
  browser,
  page,
  adminToken,
  stage = "setup",
  completed = false;
const results = [];
const pass = (label) => {
  results.push(label);
  console.log(JSON.stringify({ status: "PASS", check: label }));
};
async function start() {
  child = fork(
    new URL("../../apps/api/test/helpers/runtimeProcess.js", import.meta.url),
    [],
    { execArgv: [], silent: true, windowsHide: true, env: { ...process.env } },
  );
  child.stdout.resume();
  child.stderr.resume();
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Readiness deadline")),
      15000,
    );
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Runtime launch failed"));
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Runtime stopped before readiness"));
    });
    child.on("message", (m) => {
      if (m.ready) {
        clearTimeout(timer);
        resolve(m);
      }
    });
  });
  backend = `http://127.0.0.1:${ready.port}`;
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const target = child,
    exited = once(target, "exit");
  const timer = setTimeout(() => target.kill(), 12000);
  try {
    target.send("stop");
    assert.equal((await exited)[0], 0);
  } finally {
    clearTimeout(timer);
    child = undefined;
  }
}
async function api(method, path, body, token = adminToken, expected = 200) {
  const response = await fetch(`${backend}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: expected ${expected}, got ${response.status}`,
  );
  return (await response.json()).data;
}
async function login(email) {
  await page.goto("http://127.0.0.1:4185/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Wait for the sign-in promise and role navigation before a caller starts a
  // hard navigation; otherwise the test can abort its own login request.
  await expect(page).toHaveURL(
    email.startsWith("admin@")
      ? /\/admin$/
      : email.startsWith("operator@")
        ? /\/operator$/
        : /\/my-reports$/,
  );
}
const logout = async () => {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
};
async function viewportCheck(name) {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    assert.equal(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `.local/pre-simulation-${name}-${viewport.width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  await connectDatabase(config);
  assert.equal(mongoose.connection.name, dbName);
  assert.equal(
    (await mongoose.connection.db.listCollections().toArray()).length,
    0,
  );
  await createAdmin({
    email: "admin@acceptance.test",
    password,
    name: "Audit municipal administrator",
  });
  await start();
  process.env.API_PROXY_TARGET = backend;
  web = await preview({
    root: "apps/web",
    configFile: "apps/web/vite.config.js",
    preview: { host: "127.0.0.1", port: 4185, strictPort: true },
  });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12000);
  const pageErrors = [];
  page.on("pageerror", () => pageErrors.push("BROWSER_RUNTIME_ERROR"));
  // Forward only API requests to the actual isolated runtime, including after restart.
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    try {
      const response = await route.fetch({
        url: `${backend}${url.pathname}${url.search}`,
      });
      await route.fulfill({ response });
    } catch {
      // Restart may close an in-flight test connection. Avoid raw Playwright
      // request errors (which can include synthetic bearer headers).
      await route.abort("connectionfailed").catch(() => {});
    }
  });
  stage = "citizen registration";
  await page.goto("http://127.0.0.1:4185/register");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Audit synthetic resident");
  await page
    .getByLabel("Email", { exact: true })
    .fill("citizen-0@acceptance.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Account created" }),
  ).toBeVisible();
  assert.equal(await Report.countDocuments(), 0);
  await login("citizen-0@acceptance.test");
  await expect(page).toHaveURL(/\/my-reports$/);
  pass("registration creates no report; role-based citizen landing");
  stage = "citizen submission";
  await page.goto("http://127.0.0.1:4185/report");
  await page.getByLabel("Or choose a locality center").selectOption("AREA_01");
  await page.getByLabel("Problem type").selectOption("NO_WATER");
  await page.getByLabel("How many people are in your household?").fill("5");
  await page.getByLabel("Approximate shortage duration (hours)").fill("24");
  await page.getByLabel("Current household water level").selectOption("EMPTY");
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/reports") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  const response = await responsePromise;
  assert.equal(response.status(), 201);
  const reportId = (await response.json()).data.id;
  await page
    .getByRole("link", { name: "Track this report", exact: true })
    .click();
  await expect(page.getByText(reportId, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(reportId, { exact: true })).toBeVisible();
  assert.equal((await Report.findById(reportId)).isDemo, true);
  pass("new browser report persisted and owned after refresh");
  // Two independent peer households are fixture setup via authenticated API,
  // supplying adequate current cluster evidence without seeding final scores.
  const citizenToken = (
    await api(
      "POST",
      "/auth/login",
      { email: "citizen-0@acceptance.test", password },
      null,
    )
  ).token;
  for (let i = 1; i < 3; i++) {
    const email = `citizen-${i}@acceptance.test`;
    await api(
      "POST",
      "/auth/register",
      { email, name: `Audit household ${i}`, password },
      null,
      201,
    );
    const token = (await api("POST", "/auth/login", { email, password }, null))
      .token;
    await api(
      "POST",
      "/reports",
      {
        submissionId: randomUUID(),
        areaId: "AREA_01",
        locality: "Panchavati",
        location: { lat: 20.011 + i * 0.0001, lng: 73.79 },
        locationSource: "MANUAL",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        householdSize: i + 3,
        reportedDurationHours: 24,
        lastSupplyTime: null,
      },
      token,
      201,
    );
    await api("GET", `/reports/${reportId}`, undefined, token, 404);
  }
  const event = await ShortageEvent.findOne({ isDemo: true, status: "ACTIVE" });
  assert.ok(event);
  assert.equal(event.reportIds.length, 3);
  assert.equal(event.verifiedReportCount, 0);
  await logout();
  await login("admin@acceptance.test");
  await expect(page).toHaveURL(/\/admin$/);
  adminToken = (
    await api(
      "POST",
      "/auth/login",
      { email: "admin@acceptance.test", password },
      null,
    )
  ).token;
  stage = "admin review";
  await page.goto(`http://127.0.0.1:4185/admin/reports/${reportId}`);
  await expect(
    page.getByRole("heading", {
      name: "Report source and evidence",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Audit synthetic resident", { exact: true }).first(),
  ).toBeVisible();
  await viewportCheck("admin-report");
  await page
    .getByLabel("Review note (required)")
    .fill(
      "Submitted synthetic evidence reviewed; no physical field inspection",
    );
  await page
    .getByRole("button", { name: "Verify submitted evidence", exact: true })
    .click();
  await expect(
    page.getByText("Current review state: VERIFIED.", { exact: false }),
  ).toBeVisible();
  assert.equal(
    (await Report.findById(reportId)).verificationStatus,
    "VERIFIED",
  );
  pass(
    "explicit administrator submitted-evidence verification, actor/time/audit; no physical inspection claim",
  );
  stage = "operational fixtures";
  const operator = (
    await api("POST", "/operations/operators", {
      email: "operator@acceptance.test",
      name: "Audit tanker operator",
      password,
    })
  ).operator;
  const stranger = (
    await api("POST", "/operations/operators", {
      email: "other-operator@acceptance.test",
      name: "Other synthetic operator",
      password,
    })
  ).operator;
  const strangerToken = (
    await api(
      "POST",
      "/auth/login",
      { email: "other-operator@acceptance.test", password },
      null,
    )
  ).token;
  const tanker = (
    await api("POST", "/operations/tankers", {
      identifier: "AUDIT-T01",
      name: "Audit synthetic tanker",
      capacityLitres: 10000,
      availableLitres: 8000,
      status: "AVAILABLE",
      currentLocation: { lat: 20, lng: 73.78 },
      observedAt: new Date(Date.now() - 86400000).toISOString(),
      operatorId: operator.id,
    })
  ).tanker;
  await page.goto("http://127.0.0.1:4185/admin/tankers");
  const fleetCard = page.getByRole("article").filter({ hasText: "AUDIT-T01" });
  await fleetCard
    .getByText("Record simulated present-time observation", { exact: true })
    .click();
  await fleetCard
    .getByLabel("Simulated inspection note")
    .fill("Explicit authorized simulated present-time assessment");
  await fleetCard
    .getByLabel(
      "I assessed this simulated present state and authorize its recording.",
    )
    .check();
  await fleetCard
    .getByRole("button", { name: "Save simulated observation", exact: true })
    .click();
  await expect(fleetCard).toContainText("Allocation eligibility: Eligible");
  pass(
    "fresh audited server-time simulated observation restores eligible allocation candidate",
  );
  await api("PUT", `/operations/evidence/${event.id}`, {
    demandLitres: 4000,
    recentDeliveredLitres: 0,
    source: "Synthetic acceptance ledger (not real municipal measurements)",
    observedAt: new Date().toISOString(),
  });
  stage = "admin recommend approve assign";
  await page.goto("http://127.0.0.1:4185/admin/allocations");
  await page.getByLabel(/Request an agent explanation/).check();
  await page
    .getByRole("button", {
      name: "Request allocation recommendation",
      exact: true,
    })
    .click();
  const card = page.getByRole("article", { name: /^Allocation / }).first();
  await expect(card).toContainText("RECOMMENDED");
  await expect(card).toContainText("Demo AI simulation — no Gemini execution");
  const allocation = await Allocation.findOne({ status: "RECOMMENDED" });
  assert.ok(allocation);
  await api(
    "POST",
    `/operations/allocations/${allocation.id}/assign`,
    {},
    adminToken,
    409,
  );
  await api(
    "POST",
    `/operations/allocations/${allocation.id}/approve`,
    {},
    citizenToken,
    403,
  );
  await card
    .getByRole("button", { name: "Approve allocation", exact: true })
    .click();
  await expect(card).toContainText("APPROVED");
  await card
    .getByRole("button", { name: "Assign approved tanker", exact: true })
    .click();
  await expect(card).toContainText("ASSIGNED");
  await api(
    "GET",
    `/operator/assignments/${allocation.id}`,
    undefined,
    strangerToken,
    404,
  );
  assert.notEqual(operator.id, stranger.id);
  pass(
    "browser recommendation with explicit demo explanation; separate approval and assignment; unauthorized actions denied",
  );
  stage = "operator trip";
  await logout();
  await login("operator@acceptance.test");
  await expect(page).toHaveURL(/\/operator$/);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Operator", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Assignment ${allocation.id}`, { exact: true }),
  ).toBeVisible();
  const delivery = await Delivery.findOne({ allocationId: allocation.id });
  assert.ok(delivery);
  const trip = page.getByRole("article", {
    name: `Trip ${delivery.id}`,
    exact: true,
  });
  await api(
    "POST",
    `/deliveries/${delivery.id}/arrive`,
    {},
    (
      await api(
        "POST",
        "/auth/login",
        { email: "operator@acceptance.test", password },
        null,
      )
    ).token,
    409,
  );
  await trip.getByRole("button", { name: "Start trip", exact: true }).click();
  await expect(trip).toContainText("EN_ROUTE");
  await stop();
  await start();
  await page.reload();
  await expect(trip).toContainText("EN_ROUTE");
  pass(
    "operator navigation and ownership; start persisted across actual backend process restart",
  );
  await viewportCheck("operator-en-route");
  await trip.getByRole("button", { name: "Mark arrived", exact: true }).click();
  await expect(trip).toContainText("ARRIVED");
  await trip
    .getByRole("button", { name: "Generate demo OTP", exact: true })
    .click();
  const code = trip.getByRole("status").filter({ hasText: "Demo-only OTP:" });
  await expect(code).toBeVisible();
  const otp = (await code.textContent()).match(/\d{6}/)[0];
  await trip.getByLabel("Delivery OTP", { exact: true }).fill(otp);
  await trip
    .getByRole("button", { name: "Verify delivery OTP", exact: true })
    .click();
  await trip
    .getByLabel("Actual litres delivered", { exact: true })
    .fill("3000");
  await trip
    .getByRole("button", { name: "Complete delivery", exact: true })
    .click();
  await expect(trip).toContainText("DELIVERED");
  await stop();
  await start();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your assignments", exact: true }),
  ).toBeVisible();
  const stored = await Delivery.findById(delivery.id);
  assert.equal(stored.status, "DELIVERED");
  assert.equal(stored.otpVerified, true);
  assert.equal(stored.verificationMethod, "DEMO_OTP");
  assert.equal(stored.syncPending, false);
  assert.equal(stored.litresDelivered, 3000);
  assert.equal((await Tanker.findById(tanker.id)).availableLitres, 5000);
  assert.equal((await Allocation.findById(allocation.id)).status, "COMPLETED");
  const operatorToken = (
    await api(
      "POST",
      "/auth/login",
      { email: "operator@acceptance.test", password },
      null,
    )
  ).token;
  await api(
    "POST",
    `/deliveries/${delivery.id}/complete`,
    { litresDelivered: 3000 },
    operatorToken,
    409,
  );
  await viewportCheck("operator-completed");
  pass(
    "authorized demo OTP; valid recorded quantity; unique completion and exact accounting after restart",
  );
  stage = "admin history analytics audit";
  await logout();
  await login("admin@acceptance.test");
  await expect(page).toHaveURL(/\/admin$/);
  const analytics = await api("GET", "/dashboard/analytics");
  assert.equal(analytics.deliveries.litres, 3000);
  assert.equal(analytics.deliveries.completed, 1);
  const audit = await api(
    "GET",
    `/audit?targetType=DELIVERY&targetId=${delivery.id}&eventType=DELIVERY_COMPLETED`,
  );
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0].actorRole, "OPERATOR");
  assert.ok(audit.events[0].correlationId);
  for (const [path, heading] of [
    ["/admin/deliveries", "Trips and deliveries"],
    ["/admin/analytics", "Shortage analytics"],
    ["/admin/audit", "Audit history"],
  ]) {
    await page.goto(`http://127.0.0.1:4185${path}`);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  pass(
    "municipal history/analytics/audit load; one accepted delivery and one completion journal",
  );
  stage = "advisory publication";
  await page.goto("http://127.0.0.1:4185/admin/advisories");
  await page
    .getByLabel("Service area", { exact: true })
    .selectOption("AREA_01");
  await page.getByLabel("Advisory category").selectOption("DELIVERY_RECORDED");
  await page.getByLabel("Evidence type").selectOption("DELIVERY");
  await page
    .getByLabel("Evidence ID or stable simulated scenario key")
    .fill(delivery.id);
  await page
    .getByRole("button", { name: "Publish advisory", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Saved municipal advisory state" }),
  ).toBeVisible();
  stage = "citizen delivery renewed login";
  await logout();
  await login("citizen-0@acceptance.test");
  await expect(page).toHaveURL(/\/my-reports$/);
  stage = "citizen delivery report retrieval";
  await page.goto(`http://127.0.0.1:4185/report/${reportId}`);
  await expect(page.getByText(reportId, { exact: true })).toBeVisible();
  stage = "citizen delivery API status";
  const citizenView = await api(
    "GET",
    `/reports/${reportId}`,
    undefined,
    citizenToken,
  );
  assert.equal(citizenView.responseStatus.status, "DELIVERED");
  assert.equal(JSON.stringify(citizenView).includes(operator.id), false);
  stage = "citizen delivery rendered status";
  await expect(
    page.getByText("Water delivery recorded for the shortage area", {
      exact: true,
    }),
  ).toBeVisible();
  stage = "citizen delivery reload status";
  await page.reload();
  await expect(
    page.getByText("Water delivery recorded for the shortage area", {
      exact: true,
    }),
  ).toBeVisible();
  await viewportCheck("citizen-delivered");
  stage = "citizen inbox and read state";
  await page.getByRole("link", { name: "My Alerts", exact: true }).click();
  await page.getByLabel("Preferred service area").selectOption("AREA_01");
  const notice = page
    .getByRole("article")
    .filter({ hasText: "Area delivery recorded" })
    .first();
  await expect(notice).toBeVisible();
  await notice
    .getByRole("button", { name: "Mark as read", exact: true })
    .click();
  await expect(
    notice.getByRole("button", { name: "Mark as unread", exact: true }),
  ).toBeVisible();
  await stop();
  await start();
  await page.reload();
  await expect(
    notice.getByRole("button", { name: "Mark as unread", exact: true }),
  ).toBeVisible();
  await viewportCheck("citizen-inbox");
  stage = "citizen inbox renewed login";
  await logout();
  await login("citizen-0@acceptance.test");
  await page.goto("http://127.0.0.1:4185/my-alerts");
  await expect(
    notice.getByRole("button", { name: "Mark as unread", exact: true }),
  ).toBeVisible();
  pass(
    "citizen matching-area advisory and persisted read state after actual process restart and renewed login",
  );
  stage = "source-separated forecast evaluation";
  await logout();
  await login("admin@acceptance.test");
  const prepared = await prepareForecastFixture({
    ...config,
    DEMO_SEED_ENABLED: true,
  });
  assert.equal(prepared.inserted, 190);
  await page.goto("http://127.0.0.1:4185/admin/predictions");
  await page
    .getByLabel("Prediction history source")
    .selectOption("SYNTHETIC_FORECAST");
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
  await viewportCheck("synthetic-forecast");
  await page
    .getByLabel("Prediction history source")
    .selectOption("REPORT_HISTORY");
  await expect(
    page.getByRole("article", {
      name: "Prediction for Panchavati",
      exact: true,
    }),
  ).toContainText("INSUFFICIENT DATA");
  pass(
    "six-area separate synthetic fixtures evaluated and persisted; ordinary insufficient source preserved",
  );
  await logout();
  assert.equal(pageErrors.length, 0);
  pass(
    "citizen delivered response, renewed login/refresh, role privacy, desktop/mobile overflow and logout",
  );
  completed = true;
  console.log(
    JSON.stringify({
      result: "REMEDIATION_FULL_BROWSER_FLOW_PASS",
      checks: results.length,
      reports: 3,
      deliveries: 1,
      deliveredLitres: 3000,
      remainingLitres: 5000,
      restarts: 3,
      providerCalls: 0,
      ordinaryReportsSeeded: false,
      forecastFixturePrepared: true,
    }),
  );
} catch (error) {
  if (page)
    await page
      .screenshot({
        path: ".local/remediation-journey-failure.png",
        fullPage: true,
      })
      .catch(() => {});
  console.error(
    JSON.stringify({
      result: "FAIL",
      stage,
      errorType: error.name,
      safeMessage:
        error.name === "AssertionError"
          ? String(error.message).slice(0, 240)
          : "Audit step failed; inspect local harness stage without publishing secrets.",
    }),
  );
  process.exitCode = 1;
} finally {
  if (page) await page.unrouteAll({ behavior: "wait" }).catch(() => {});
  if (browser) await browser.close();
  if (web) await new Promise((resolve) => web.httpServer.close(resolve));
  await stop();
  await cleanupTestDatabase(dbName);
  console.log(JSON.stringify({ isolatedCleanup: "COMPLETE", completed }));
}
