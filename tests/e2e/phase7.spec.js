import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
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
import { citizenSession } from "../../apps/api/test/helpers/citizen.js";
import { seedOperations } from "../../apps/api/src/demo/seedOperations.js";
import Tanker from "../../apps/api/src/models/Tanker.js";
import Allocation from "../../apps/api/src/models/Allocation.js";
import Delivery from "../../apps/api/src/models/Delivery.js";
import ShortageEvent from "../../apps/api/src/models/ShortageEvent.js";
const dbName = `aquashield_browser_phase7_${randomUUID().replaceAll("-", "")}`;
const password = randomBytes(24).toString("hex");
let config,
  app,
  server,
  origin,
  admin,
  adminToken,
  demoOperator,
  liveOperator,
  recipientCode;
test.beforeAll(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: true,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config, { dbName });
  admin = await createAdmin({ email: "admin@phase7.test", password });
  adminToken = (await loginAdmin(admin.email, password, config)).token;
  demoOperator = await createOperator({
    email: "demo-op@phase7.test",
    name: "Demo trip operator",
    password,
  });
  liveOperator = await createOperator({
    email: "live-op@phase7.test",
    name: "Controlled test operator",
    password,
  });
  // Test-only recipient channel. No SMS, secrets, live inference or routing.
  app = createApp(config, {
    deliveryDependencies: {
      handoff: async ({ code }) => {
        recipientCode = code;
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
    /^aquashield_browser_phase7_[a-f0-9]{32}$/.test(dbName)
  )
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});
test.beforeEach(async ({ page }) => {
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
async function signIn(page, email, secret = password, path = "/login") {
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    path.includes("returnTo=/operator")
      ? /\/operator$/
      : path.includes("citizen/login")
        ? /\/my-reports$/
        : /\/admin$/,
  );
}
const api = (method, path, body, token = adminToken) =>
  request(app)[method](path).set("Authorization", `Bearer ${token}`).send(body);
async function progress(page, { demo }) {
  const card = page
    .getByRole("article", { name: /^Trip / })
    .filter({ hasText: demo ? "Fictional demo trip" : "Recorded trip" })
    .first();
  await expect(card).toContainText("ASSIGNED");
  await card.getByRole("button", { name: "Start trip", exact: true }).click();
  await expect(card).toContainText("EN_ROUTE");
  await page.reload();
  await expect(card).toContainText("EN_ROUTE");
  await card.getByRole("button", { name: "Mark arrived", exact: true }).click();
  await expect(card).toContainText("ARRIVED");
  await card
    .getByRole("button", {
      name: demo ? "Generate demo OTP" : "Request recipient OTP",
      exact: true,
    })
    .click();
  let code;
  if (demo) {
    const label = card
      .getByRole("status")
      .filter({ hasText: "Demo-only OTP:" });
    await expect(label).toBeVisible();
    code = (await label.innerText()).match(/\b\d{6}\b/)[0];
  } else {
    await expect(
      card.getByRole("button", { name: "Request recipient OTP", exact: true }),
    ).toBeEnabled();
    expect(recipientCode).toMatch(/^\d{6}$/);
    code = recipientCode;
  }
  await card.getByLabel("Delivery OTP", { exact: true }).fill(code);
  await card
    .getByRole("button", { name: "Verify delivery OTP", exact: true })
    .click();
  await expect(
    card.getByLabel("Actual litres delivered", { exact: true }),
  ).toBeVisible();
  await card
    .getByLabel("Actual litres delivered", { exact: true })
    .fill("3500");
  await card
    .getByRole("button", { name: "Complete delivery", exact: true })
    .click();
  await expect(card).toContainText("DELIVERED");
  await expect(card).toContainText("Actual delivered: 3500 L");
  await page.reload();
  await expect(card).toContainText("DELIVERED");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  return card;
}
test("fictional admin assignment, operator trip/OTP/completion and municipal totals persist", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await seedOperations(config, { id: String(admin._id) }, { reset: true });
  const tanker = await Tanker.findOne({ identifier: "DEMO-T01" });
  await api("patch", `/api/operations/tankers/${tanker.id}?demo=true`, {
    revision: tanker.revision,
    tanker: {
      identifier: tanker.identifier,
      name: tanker.name,
      capacityLitres: tanker.capacityLitres,
      availableLitres: tanker.availableLitres,
      status: "AVAILABLE",
      operatorId: String(demoOperator._id),
      currentLocation: { lat: 20, lng: 73.78 },
      observedAt: new Date().toISOString(),
    },
  }).expect(200);
  await signIn(page, admin.email);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/allocations?demo=true");
  await page
    .getByRole("button", { name: "Request allocation recommendation" })
    .click();
  const allocationCard = page
    .getByRole("article", { name: /^Allocation / })
    .first();
  await allocationCard
    .getByRole("button", { name: "Approve allocation" })
    .click();
  await allocationCard
    .getByRole("button", { name: "Assign approved tanker" })
    .click();
  await expect(allocationCard).toContainText("ASSIGNED");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, demoOperator.email, password, "/login?returnTo=/operator");
  await expect(page).toHaveURL(/\/operator$/);
  await expect(page.getByText(/Straight-line distance:/)).toBeVisible();
  await page
    .getByRole("link", { name: "Open assigned job", exact: true })
    .click();
  await expect(page).toHaveURL(/\/operator\/assignment\/[a-f0-9]{24}$/);
  await expect(
    page.getByRole("heading", { name: "Assigned job", exact: true }),
  ).toBeVisible();
  await page.route(/https:\/\/.*tile\.openstreetmap\.org\//, (route) =>
    route.abort(),
  );
  const trip = page.getByRole("article", { name: /^Trip / }).first();
  await trip
    .getByRole("button", { name: "Show street map", exact: true })
    .click();
  await expect(trip.locator(".leaflet-container")).toBeVisible();
  await trip.locator(".leaflet-control-zoom-in").click();
  await expect(trip.getByText(/Dashed straight-line connector/)).toBeVisible();
  await trip
    .getByRole("button", { name: "Hide street map", exact: true })
    .click();
  await progress(page, { demo: true });
  const d = await Delivery.findOne({ isDemo: true, status: "DELIVERED" });
  expect(d.otpVerified).toBe(true);
  expect(d.litresDelivered).toBe(3500);
  expect((await Allocation.findById(d.allocationId)).status).toBe("COMPLETED");
  expect((await Tanker.findById(d.tankerId)).availableLitres).toBe(4500);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, admin.email);
  await page.goto("/admin/deliveries?demo=true");
  await expect(
    page.getByText(/Recorded actual water delivered: 3,500 L/),
  ).toBeVisible();
  const audit = page.getByRole("article", { name: /^Trip / }).first();
  await audit
    .getByText("Trip timestamps and audit history", { exact: true })
    .click();
  await expect(audit.getByText(/DELIVERY_COMPLETED/)).toBeVisible();
  const summary = await api("get", "/api/dashboard/summary?demo=true").expect(
    200,
  );
  expect(summary.body.data.metrics.waterDelivered.value).toBe(3500);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/phase7-deliveries-${info.project.name}.png`,
    fullPage: true,
  });
});
test("controlled recipient handoff completes a citizen response with private history after renewed login", async ({
  page,
}) => {
  test.setTimeout(90000);
  recipientCode = null;
  const citizen = await citizenSession(config),
    stranger = await citizenSession(config);
  await signIn(page, citizen.user.email, citizen.password, "/citizen/login");
  await page.goto("/report");
  await page.getByLabel("Or choose a locality center").selectOption("AREA_01");
  await page.getByLabel("Problem type").selectOption("NO_WATER");
  await page.getByLabel("How many people are in your household?").fill("5");
  await page.getByLabel("Approximate shortage duration (hours)").fill("24");
  await page.getByLabel("Current household water level").selectOption("EMPTY");
  const submitted = page.waitForResponse(
    (r) => r.url().endsWith("/api/reports") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  const response = await submitted;
  expect(response.status()).toBe(201);
  const reportId = (await response.json()).data.id;
  for (let i = 0; i < 2; i++) {
    const peer = await citizenSession(config);
    await api(
      "post",
      "/api/reports",
      {
        submissionId: randomUUID(),
        location: { lat: 20.011, lng: 73.79 },
        locationSource: "MANUAL",
        locality: "Panchavati",
        areaId: "AREA_01",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        householdSize: 4,
        reportedDurationHours: 24,
      },
      peer.token,
    ).expect(201);
  }
  const event = await ShortageEvent.findOne({
    isDemo: false,
    reportIds: reportId,
  });
  expect(event.status).toBe("ACTIVE");
  await api("post", "/api/operations/tankers", {
    identifier: "CONTROLLED-LIVE",
    name: "Test fixture tanker",
    capacityLitres: 5000,
    availableLitres: 4500,
    operatorId: String(liveOperator._id),
    currentLocation: null,
    observedAt: new Date().toISOString(),
    status: "AVAILABLE",
  }).expect(200);
  const rec = (
    await api("post", "/api/operations/allocations/recommend", {
      eventId: event.id,
      requestId: randomUUID(),
      useAi: false,
    }).expect(200)
  ).body.data.allocation;
  await api("post", `/api/operations/allocations/${rec.id}/approve`, {}).expect(
    200,
  );
  await api("post", `/api/operations/allocations/${rec.id}/assign`, {}).expect(
    200,
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, liveOperator.email, password, "/login?returnTo=/operator");
  await expect(
    page.getByText("Straight-line distance: Unknown", { exact: true }),
  ).toBeVisible();
  await progress(page, { demo: false });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, citizen.user.email, citizen.password, "/citizen/login");
  await expect(
    page.getByText(/Municipal response: Water delivery recorded for area/),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(/Municipal response: Water delivery recorded for area/),
  ).toBeVisible();
  await page.goto(`/report/${reportId}`);
  await expect(
    page.getByText("Water delivery recorded for the shortage area", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Delivery to your household has not been verified/),
  ).toBeVisible();
  await api(
    "get",
    `/api/reports/${reportId}`,
    undefined,
    stranger.token,
  ).expect(404);
  const history = (
    await api("get", "/api/reports", undefined, citizen.token).expect(200)
  ).body.data;
  const summary = history.reports.find((r) => r.id === reportId).responseStatus;
  for (const field of ["operatorId", "tankerId", "otp", "audit", "notes"])
    expect(summary[field]).toBeUndefined();
});

test("citizen portal hands off a private code through the UI and operator completion persists", async ({
  page,
}) => {
  test.setTimeout(90000);
  // Keep prior scenarios intact. New distinct locality/operator avoid fixture overlap.
  const recipient = await citizenSession(config);
  const op = await createOperator({
    email: "portal-op@phase7.test",
    name: "Portal operator",
    password,
  });
  let reportId;
  for (let i = 0; i < 3; i++) {
    const owner = i === 0 ? recipient : await citizenSession(config);
    const created = await api(
      "post",
      "/api/reports",
      {
        submissionId: randomUUID(),
        location: { lat: 19.997 + i * 0.0002, lng: 73.752 },
        locationSource: "MANUAL",
        locality: "Satpur",
        areaId: "AREA_02",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        householdSize: 5,
        reportedDurationHours: 24,
      },
      owner.token,
    ).expect(201);
    if (i === 0) reportId = created.body.data.id;
  }
  const event = await ShortageEvent.findOne({
    isDemo: false,
    reportIds: reportId,
  });
  expect(event.status).toBe("ACTIVE");
  await api("post", "/api/operations/tankers", {
    identifier: "PORTAL-LIVE",
    name: "Portal test tanker",
    capacityLitres: 5000,
    availableLitres: 4500,
    operatorId: op.id,
    currentLocation: null,
    observedAt: new Date().toISOString(),
    status: "AVAILABLE",
  }).expect(200);
  const rec = (
    await api("post", "/api/operations/allocations/recommend", {
      eventId: event.id,
      requestId: randomUUID(),
      useAi: false,
    }).expect(200)
  ).body.data.allocation;
  await api("post", `/api/operations/allocations/${rec.id}/approve`, {}).expect(
    200,
  );
  await api("post", `/api/operations/allocations/${rec.id}/assign`, {}).expect(
    200,
  );
  await signIn(page, op.email, password, "/login?returnTo=/operator");
  await page.getByRole("button", { name: "Start trip", exact: true }).click();
  await page.getByRole("button", { name: "Mark arrived", exact: true }).click();
  await expect(page.getByLabel("Delivery OTP", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(
    page,
    recipient.user.email,
    recipient.password,
    "/citizen/login",
  );
  await page.goto(`/report/${reportId}`);
  const panel = page.getByRole("region", {
    name: "Citizen delivery verification",
  });
  await panel
    .getByRole("button", { name: "Get recipient delivery code", exact: true })
    .click();
  await expect(panel.getByRole("status")).toContainText(
    "Recipient delivery code:",
  );
  const code = (await panel.getByRole("status").innerText()).match(
    /\b\d{6}\b/,
  )[0];
  expect(
    await page.evaluate(() => JSON.stringify(sessionStorage)),
  ).not.toContain(code);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, op.email, password, "/login?returnTo=/operator");
  await page.getByLabel("Delivery OTP", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "Verify delivery OTP", exact: true })
    .click();
  await page
    .getByLabel("Actual litres delivered", { exact: true })
    .fill("3500");
  await page
    .getByRole("button", { name: "Complete delivery", exact: true })
    .click();
  await expect(page.getByRole("article", { name: /^Trip / })).toContainText(
    "DELIVERED",
  );
  await page.reload();
  await expect(page.getByRole("article", { name: /^Trip / })).toContainText(
    "Actual delivered: 3500 L",
  );
  const stored = await Delivery.findOne({ allocationId: rec.id });
  expect(stored.verificationMethod).toBe("CITIZEN_PORTAL_OTP");
  expect(recipientCode).not.toBe(code); // External test adapter was never used.
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(
    page,
    recipient.user.email,
    recipient.password,
    "/citizen/login",
  );
  await page.goto(`/report/${reportId}`);
  await expect(
    page.getByText("Water delivery recorded for the shortage area", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(panel).toHaveCount(0);
});
