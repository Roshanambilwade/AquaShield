import { cleanupTestDatabase } from "../../apps/api/test/helpers/cleanup.js";
import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import request from "supertest";
import { createApp } from "../../apps/api/src/app.js";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
} from "../../apps/api/src/config/database.js";
import {
  createAdmin,
  createOperator,
  loginAdmin,
} from "../../apps/api/src/services/authService.js";
import { citizenSession } from "../../apps/api/test/helpers/citizen.js";
import ShortageEvent from "../../apps/api/src/models/ShortageEvent.js";

const dbName = `aquashield_remediation_test_${randomUUID().replaceAll("-", "")}`;
let app,
  config,
  server,
  origin,
  adminToken,
  operatorToken,
  operator,
  citizen,
  stranger;
test.beforeAll(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: true,
    GEMINI_API_KEY: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config, { dbName });
  app = createApp(config);
  const password = randomBytes(24).toString("hex");
  await createAdmin({ email: "remediation@test.example", password });
  adminToken = (await loginAdmin("remediation@test.example", password, config))
    .token;
  operator = await createOperator({
    email: "operator@test.example",
    password,
    name: "Test operator",
  });
  operatorToken = (
    await loginAdmin(operator.email, password, config, ["OPERATOR"])
  ).token;
  citizen = await citizenSession(config);
  stranger = await citizenSession(config);
  server = app.listen(0, "127.0.0.1");
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

test("F5 citizen submission, municipal approval/assignment, renewed history and account isolation", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
  await page.goto("/citizen/login");
  await page.getByLabel("Email", { exact: true }).fill(citizen.user.email);
  await page.getByLabel("Password", { exact: true }).fill(citizen.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/my-reports$/);
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
  const id = (await response.json()).data.id;
  for (let i = 0; i < 2; i++) {
    const peer = await citizenSession(config);
    await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${peer.token}`)
      .send({
        submissionId: randomUUID(),
        location: { lat: 20.011, lng: 73.79 },
        locationSource: "MANUAL",
        locality: "Panchavati",
        areaId: "AREA_01",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        reportedDurationHours: 24,
        householdSize: 4,
      })
      .expect(201);
  }
  const event = await ShortageEvent.findOne({ reportIds: id, isDemo: false });
  expect(event.status).toBe("ACTIVE");
  const post = (path, body) =>
    request(app)
      .post(`/api/operations/${path}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);
  await post("tankers", {
    identifier: "REMEDIATION",
    name: "Test tanker",
    capacityLitres: 5000,
    availableLitres: 4000,
    operatorId: operator.id,
    status: "AVAILABLE",
    observedAt: new Date().toISOString(),
    currentLocation: null,
  }).expect(200);
  const rec = (
    await post("allocations/recommend", {
      eventId: event.id,
      requestId: randomUUID(),
      useAi: false,
    }).expect(200)
  ).body.data.allocation;
  await post(`allocations/${rec.id}/approve`, {}).expect(200);
  await page.goto("/my-reports");
  await expect(
    page.getByText(/Municipal response: Area response approved/),
  ).toBeVisible();
  await post(`allocations/${rec.id}/assign`, {}).expect(200);
  await page.reload();
  await expect(
    page.getByText(/Municipal response: Tanker assigned to area/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/citizen/login");
  await page.getByLabel("Email", { exact: true }).fill(citizen.user.email);
  await page.getByLabel("Password", { exact: true }).fill(citizen.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText(/Municipal response: Tanker assigned to area/),
  ).toBeVisible();
  await expect(
    page.getByText("Pending verification", { exact: true }),
  ).toBeVisible();
  await request(app)
    .get(`/api/reports/${id}`)
    .set("Authorization", `Bearer ${stranger.token}`)
    .expect(404);
  await request(app)
    .get(`/api/reports/${id}`)
    .set("Authorization", `Bearer ${operatorToken}`)
    .expect(403);
  const history = (
    await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${citizen.token}`)
      .expect(200)
  ).body.data;
  expect(Object.keys(history.reports[0].responseStatus).sort()).toEqual([
    "approvedAt",
    "assignedAt",
    "status",
  ]);
  await request(app).get(`/api/shortages/${event.id}`).expect(404);
  await page.unrouteAll({ behavior: "wait" });
});
