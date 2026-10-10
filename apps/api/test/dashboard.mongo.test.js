import { cleanupTestDatabase } from "./helpers/cleanup.js";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import {
  createAdmin,
  loginAdmin,
  hashPassword,
} from "../src/services/authService.js";
import User from "../src/models/User.js";
import AdminSession from "../src/models/AdminSession.js";
import { seedDemoReports } from "../src/demo/seedReports.js";
import { detectShortages } from "../src/services/shortageService.js";
import Report from "../src/models/Report.js";

const databaseName = `aquashield_phase4_test_${randomUUID().replaceAll("-", "")}`;
const email = "admin-test@example.test",
  password = randomBytes(24).toString("hex");
let app, config, user, token;
const get = (path) =>
  request(app).get(path).set("Authorization", `Bearer ${token}`);
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "",
  };
  config.MONGODB_URI = process.env.MONGODB_TEST_URI || config.MONGODB_URI;
  await connectDatabase(config, { dbName: databaseName });
  app = createApp(config);
  user = await createAdmin({ email, password });
  token = (await loginAdmin(email, password, config)).token;
  await seedDemoReports(config);
});
after(() => cleanupTestDatabase(databaseName));

test("admin login, me and logout use hashed revocable sessions with no password disclosure", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);
  const session = login.body.data;
  assert.equal(session.user.role, "ADMIN");
  assert.equal(session.user.passwordHash, undefined);
  assert.match(session.token, /^[a-f0-9]{64}$/);
  const expectedHash = createHash("sha256").update(session.token).digest("hex");
  const stored = await AdminSession.findOne({
    userId: user._id,
    tokenHash: expectedHash,
  }).select("+tokenHash");
  assert.notEqual(stored.tokenHash, session.token);
  assert.equal(stored.tokenHash, expectedHash);
  const me = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${session.token}`)
    .expect(200);
  assert.equal(me.body.data.user.email, email);
  await request(app)
    .post("/api/auth/logout")
    .set("Authorization", `Bearer ${session.token}`)
    .send({})
    .expect(200);
  await request(app)
    .get("/api/dashboard/map")
    .set("Authorization", `Bearer ${session.token}`)
    .expect(401);
  const wrong = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "incorrect" })
    .expect(401);
  const unknown = await request(app)
    .post("/api/auth/login")
    .send({ email: "missing@example.test", password: "incorrect" })
    .expect(401);
  assert.deepEqual(wrong.body, unknown.body);
  await disconnectDatabase();
  await connectDatabase(config, { dbName: databaseName });
  await get("/api/auth/me").expect(200);
});
test("all protected routes reject anonymous and forged sessions", async () => {
  for (const path of [
    "/api/dashboard/summary",
    "/api/dashboard/map",
    "/api/dashboard/analytics",
    "/api/auth/me",
  ]) {
    await request(app).get(path).expect(401);
    await request(app)
      .get(path)
      .set("Authorization", `Bearer ${"a".repeat(64)}`)
      .expect(401);
  }
  await request(app).post("/api/shortages/detect").send({}).expect(401);
  await request(app)
    .post(`/api/shortages/${"0".repeat(24)}/calculate-severity`)
    .send({})
    .expect(401);
});
test("expiry, disabled accounts and changed non-admin roles are enforced on every request", async () => {
  const session = await loginAdmin(email, password, config);
  await AdminSession.updateMany(
    { userId: user._id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await request(app)
    .get("/api/dashboard/map")
    .set("Authorization", `Bearer ${session.token}`)
    .expect(401);
  token = (await loginAdmin(email, password, config)).token;
  await User.updateOne({ _id: user._id }, { $set: { role: "CITIZEN" } });
  await get("/api/dashboard/map").expect(403);
  await User.updateOne(
    { _id: user._id },
    { $set: { role: "ADMIN", disabled: true } },
  );
  await get("/api/dashboard/map").expect(401);
  await User.updateOne({ _id: user._id }, { $set: { disabled: false } });
  await get("/api/dashboard/map").expect(200);
  const citizen = await User.create({
    email: "citizen@example.test",
    name: "Citizen",
    role: "CITIZEN",
    passwordHash: await hashPassword(password),
  });
  const citizenLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: citizen.email, password })
    .expect(200);
  assert.equal(citizenLogin.body.data.user.role, "CITIZEN");
  await request(app)
    .get("/api/dashboard/map")
    .set("Authorization", `Bearer ${citizenLogin.body.data.token}`)
    .expect(403);
});
test("dashboard metrics reuse existing event counts and leave unavailable operational data unknown", async () => {
  const response = await get("/api/dashboard/summary?demo=true").expect(200);
  const data = response.body.data;
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(Object.keys(data.metrics).length, 8);
  assert.equal(data.metrics.activeShortages.value, 4);
  assert.equal(data.metrics.criticalAreas.value, 1);
  assert.equal(data.metrics.estimatedPeopleAffected.value, 1040);
  assert.equal(data.metrics.estimatedPeopleAffected.kind, "ESTIMATE");
  for (const name of [
    "availableTankers",
    "tankersEnRoute",
    "waterDelivered",
    "averageResponseTime",
    "highRiskAreas",
  ]) {
    assert.equal(data.metrics[name].value, null);
    assert.equal(data.metrics[name].kind, "UNKNOWN");
  }
  assert.equal(data.emergingAreas, 1);
  assert.equal(data.ai.status, "NOT_CONFIGURED");
  assert.ok(data.activity.length > 0);
  const real = await get("/api/dashboard/summary").expect(200);
  assert.equal(real.body.data.metrics.activeShortages.value, 0);
  assert.equal(real.body.data.activity.length, 0);
});
test("authorized map retrieves demo zones and sanitized report layers while citizen data remains private", async () => {
  const response = await get("/api/dashboard/map?demo=true").expect(200);
  const data = response.body.data;
  assert.equal(data.zones.length, 5);
  assert.equal(data.reports.length, 66);
  assert.equal(data.reportsTruncated, false);
  assert.equal(data.emergingZones.length, 1);
  assert.equal(data.forecastDataAvailable, false);
  assert.deepEqual(data.tankers, []);
  assert.equal(new Set(data.zones.map((e) => e.severityLevel)).size, 4);
  for (const report of data.reports) {
    assert.equal(report.reporterKeyHash, undefined);
    assert.equal(report.description, undefined);
    assert.equal(report.photo, undefined);
  }
  const report = await Report.create({
    areaId: "REAL_TEST_AREA",
    reporterKeyHash: randomBytes(32).toString("hex"),
    submissionId: randomUUID(),
    location: { lat: 20.011, lng: 73.79 },
    locationSource: "MANUAL",
    locality: "Private report",
    problem: "NO_WATER",
    waterLevel: "UNKNOWN",
    householdSize: 4,
    description: "Private description",
  });
  await detectShortages(config);
  const real = await get("/api/dashboard/map").expect(200);
  assert.equal(real.body.data.reports.length, 1);
  assert.equal(real.body.data.reports[0].id, String(report._id));
  await request(app).get(`/api/reports/${report._id}`).expect(401);
  const publicZones = await request(app).get("/api/shortages").expect(200);
  assert.deepEqual(publicZones.body.data.events, []);
});
test("analytics and detail expose evidence counts, unknown deliveries and non-AI assessment guidance", async () => {
  const { body } = await get("/api/dashboard/analytics?demo=true").expect(200);
  assert.equal(
    body.data.reportsByHour.reduce((sum, r) => sum + r.count, 0),
    66,
  );
  assert.equal(body.data.evidence.verifiedReports, 42);
  assert.equal(body.data.evidence.duplicateReports, 2);
  assert.equal(body.data.evidence.suspiciousReports, 1);
  assert.deepEqual(
    body.data.severityDistribution.map((r) => r.count),
    [1, 2, 1, 1],
  );
  const zones = (await request(app).get("/api/shortages?demo=true").expect(200))
    .body.data.events;
  const hero = zones.find((e) => e.areaId === "AREA_01");
  const detail = await get(
    `/api/dashboard/shortages/${hero.id}?demo=true`,
  ).expect(200);
  assert.deepEqual(detail.body.data.event.severity, hero.severity);
  assert.equal(detail.body.data.previousDelivery, null);
  assert.equal(detail.body.data.deliveryDataAvailable, false);
  assert.equal(
    detail.body.data.recommendedAction.source,
    "DETERMINISTIC_ASSESSMENT_GUIDANCE",
  );
  assert.equal(
    Object.values(detail.body.data.waterLevels).reduce((a, b) => a + b, 0),
    37,
  );
});
test("read-only fleet and verified delivery records populate KPIs and layers without simulation leakage", async () => {
  const db = mongoose.connection.db;
  const areaId = (await get("/api/dashboard/map").expect(200)).body.data
    .zones[0].areaId;
  await db.collection("tankers").insertMany([
    {
      _id: "T1",
      isDemo: false,
      status: "AVAILABLE",
      currentLocation: { lat: 20, lng: 73.8 },
      capacityLitres: 10000,
    },
    {
      _id: "T2",
      isDemo: false,
      status: "EN_ROUTE",
      currentLocation: { lat: 20.1, lng: 73.8 },
    },
    {
      _id: "DEMO_ONLY",
      isDemo: true,
      status: "AVAILABLE",
      currentLocation: { lat: 20, lng: 73.8 },
    },
  ]);
  await db.collection("deliveries").insertMany([
    {
      isDemo: false,
      areaId,
      status: "DELIVERED",
      otpVerified: true,
      litresDelivered: 8000,
      deliveredAt: new Date("2026-10-08T06:00Z"),
      requestedAt: new Date("2026-10-08T05:30Z"),
    },
    {
      isDemo: false,
      areaId,
      status: "DELIVERED",
      otpVerified: false,
      litresDelivered: 99999,
      deliveredAt: new Date(),
    },
  ]);
  const response = await get("/api/dashboard/summary").expect(200);
  assert.equal(response.body.data.metrics.availableTankers.value, 0);
  assert.equal(response.body.data.recordedAvailableTankers, 1);
  assert.equal(response.body.data.metrics.tankersEnRoute.value, 1);
  assert.equal(response.body.data.metrics.waterDelivered.value, 8000);
  assert.equal(response.body.data.metrics.averageResponseTime.value, 30);
  const map = await get("/api/dashboard/map").expect(200);
  assert.equal(map.body.data.tankers.length, 2);
  assert.equal(map.body.data.tankerDataAvailable, true);
  const realId = map.body.data.zones[0].id;
  const detail = await get(`/api/dashboard/shortages/${realId}`).expect(200);
  assert.equal(detail.body.data.previousDelivery.litres, 8000);
  await db
    .collection("tankers")
    .insertOne({ isDemo: false, status: "BROKEN_DATA" });
  assert.equal(
    (await get("/api/dashboard/summary").expect(200)).body.data.metrics
      .availableTankers.value,
    null,
  );
});
test("invalid dashboard query and production demo access fail safely", async () => {
  await get("/api/dashboard/map?demo=maybe").expect(422);
  await get("/api/dashboard/map?includeSecrets=true").expect(422);
  await get("/api/dashboard/shortages/not-an-id").expect(422);
  await get(`/api/dashboard/shortages/${"0".repeat(24)}`).expect(404);
  const production = createApp({ ...config, NODE_ENV: "production" });
  await request(production)
    .get("/api/dashboard/map?demo=true")
    .set("Authorization", `Bearer ${token}`)
    .expect(403);
});
