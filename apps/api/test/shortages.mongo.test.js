import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import Report from "../src/models/Report.js";
import ShortageEvent from "../src/models/ShortageEvent.js";
import { seedDemoReports } from "../src/demo/seedReports.js";
import { buildShortageEvents } from "../src/services/reportClusteringService.js";
import { demoReports } from "../src/demo/reports.js";
import { demoAreas } from "../src/demo/areas.js";
import { detectShortages } from "../src/services/shortageService.js";
import { createAdmin, loginAdmin } from "../src/services/authService.js";
import { citizenSession } from "./helpers/citizen.js";

const databaseName = `aquashield_phase3_test_${randomUUID().replaceAll("-", "")}`;
let config, app, firstId, firstToken, eventId, adminToken;
const input = (overrides = {}) => ({
  submissionId: randomUUID(),
  location: { lat: 20.011, lng: 73.79 },
  locationSource: "MANUAL",
  areaId: "AREA_01",
  locality: "Panchavati",
  problem: "NO_WATER",
  lastSupplyTime: new Date(Date.now() - 18 * 3600000).toISOString(),
  reportedDurationHours: 18,
  waterLevel: "LESS_THAN_25",
  householdSize: 5,
  description: "Private description must never enter public event evidence.",
  ...overrides,
});
before(async () => {
  config = { ...loadEnv(), NODE_ENV: "test", PUBLIC_MIN_HOUSEHOLDS: 3 };
  config.MONGODB_URI = process.env.MONGODB_TEST_URI || config.MONGODB_URI;
  await connectDatabase(config, { dbName: databaseName });
  app = createApp(config);
  const password = randomBytes(24).toString("hex");
  await createAdmin({ email: "phase3-test@example.test", password });
  adminToken = (await loginAdmin("phase3-test@example.test", password, config))
    .token;
});
after(async () => {
  if (mongoose.connection.name === databaseName)
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});

test("three independent citizen submissions persist and create one updated ACTIVE event", async () => {
  for (let i = 0; i < 3; i += 1) {
    const token = (await citizenSession(config)).token;
    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(input())
      .expect(201);
    assert.equal(response.body.data.detectionStatus, "COMPLETE");
    assert.equal(response.body.data.verificationStatus, "PENDING");
    if (i === 0) {
      firstId = response.body.data.id;
      firstToken = token;
    }
  }
  const events = await ShortageEvent.find({ isDemo: false });
  assert.equal(events.length, 1);
  assert.equal(events[0].status, "ACTIVE");
  assert.equal(events[0].eligibleReportCount, 3);
  assert.equal(events[0].verifiedReportCount, 0);
  assert.equal(events[0].estimatedAffectedPopulation, 60);
  assert.equal(events[0].temperatureC, null);
  assert.equal(events[0].vulnerableRatio, null);
  eventId = String(events[0]._id);
  await disconnectDatabase();
  await connectDatabase(config, { dbName: databaseName });
  assert.equal(
    (await ShortageEvent.findById(eventId)).confidenceScore,
    events[0].confidenceScore,
  );
  const detail = await request(app)
    .get(`/api/reports/${firstId}`)
    .set("Authorization", `Bearer ${firstToken}`)
    .expect(200);
  assert.equal(detail.body.data.shortageEvent.id, eventId);
  assert.equal(detail.body.data.shortageEvent.reportHandling, "ELIGIBLE");
  await request(app)
    .get(`/api/reports/${firstId}`)
    .set("Authorization", `Bearer ${(await citizenSession(config)).token}`)
    .expect(404);
});

test("repeated submissions do not inflate population, confidence or verified count", async () => {
  const before = await ShortageEvent.findById(eventId);
  const response = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${firstToken}`)
    .send(input())
    .expect(201);
  const event = await ShortageEvent.findById(eventId);
  assert.equal(event.reportCount, 4);
  assert.equal(event.eligibleReportCount, 3);
  assert.equal(event.duplicateReportCount, 1);
  assert.equal(
    event.estimatedAffectedPopulation,
    before.estimatedAffectedPopulation,
  );
  assert.equal(event.confidenceScore, before.confidenceScore);
  const detail = await request(app)
    .get(`/api/reports/${response.body.data.id}`)
    .set("Authorization", `Bearer ${firstToken}`)
    .expect(200);
  assert.equal(detail.body.data.shortageEvent.reportHandling, "DUPLICATE");
});

test("suspicious report is saved privately but excluded from event calculations", async () => {
  const response = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${(await citizenSession(config)).token}`)
    .send(input({ reportedDurationHours: 1 }))
    .expect(201);
  assert.equal(await Report.countDocuments({ _id: response.body.data.id }), 1);
  const event = await ShortageEvent.findById(eventId);
  assert.equal(event.suspiciousReportCount, 1);
  assert.equal(event.eligibleReportCount, 3);
  assert.equal(event.estimatedAffectedPopulation, 60);
});

test("public event and severity APIs expose aggregate evidence without private identifiers", async () => {
  const list = await request(app).get("/api/shortages").expect(200);
  assert.equal(list.body.data.events.length, 1);
  const event = list.body.data.events[0];
  assert.equal(event.id, eventId);
  assert.equal(event.reportIds, undefined);
  assert.equal(event.duplicateReportIds, undefined);
  assert.equal(event.reporterKeyHash, undefined);
  assert.equal(JSON.stringify(event).includes("Private description"), false);
  assert.equal(JSON.stringify(event).includes(firstId), false);
  const severity = await request(app)
    .get(`/api/shortages/${eventId}/severity`)
    .expect(200);
  assert.deepEqual(severity.body.data, event.severity);
  await request(app)
    .post("/api/shortages/detect")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({})
    .expect(200);
  await request(app)
    .post(`/api/shortages/${eventId}/calculate-severity`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({})
    .expect(200);
  assert.equal(await ShortageEvent.countDocuments({ isDemo: false }), 1);
});

test("demo seed derives multiple severity levels, remains idempotent and preserves real reports", async () => {
  const privateCount = await Report.countDocuments({ isDemo: false });
  await seedDemoReports(config);
  await seedDemoReports(config);
  assert.equal(await Report.countDocuments({ isDemo: true }), 66);
  assert.equal(await Report.countDocuments({ isDemo: false }), privateCount);
  const { body } = await request(app)
    .get("/api/shortages?demo=true")
    .expect(200);
  assert.equal(body.data.events.length, 5);
  const expected = buildShortageEvents(demoReports(), demoAreas(), config);
  for (const event of body.data.events) {
    const derived = expected.find((e) => e.areaId === event.areaId);
    assert.equal(event.confidenceScore, derived.confidenceScore);
    assert.equal(event.severityScore, derived.severityScore);
    assert.equal(
      event.estimatedAffectedPopulation,
      derived.estimatedAffectedPopulation,
    );
  }
  assert.equal(new Set(body.data.events.map((e) => e.severityLevel)).size, 4);
  assert.equal(body.data.summary.emergingAreas, 1);
  const real = await request(app).get("/api/shortages").expect(200);
  assert.equal(real.body.data.events[0].eligibleReportCount, 3);
});

test("new geographic and time clusters create separate events; deleted evidence supersedes derived events", async () => {
  const payload = input({ location: { lat: 22, lng: 73.8 } });
  const response = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${(await citizenSession(config)).token}`)
    .send(payload)
    .expect(201);
  // Backdate this test-owned record through the native collection: createdAt is
  // deliberately immutable through the application's Mongoose update API.
  await Report.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(response.body.data.id) },
    {
      $set: {
        createdAt: new Date(Date.now() - 48 * 3600000),
        lastSupplyTime: null,
      },
    },
  );
  await detectShortages(config);
  assert.equal(
    await ShortageEvent.countDocuments({ isDemo: false, status: "HISTORICAL" }),
    1,
  );
  await Report.collection.deleteOne({
    _id: new mongoose.Types.ObjectId(response.body.data.id),
  });
  await detectShortages(config);
  assert.equal(
    await ShortageEvent.countDocuments({ isDemo: false, status: "SUPERSEDED" }),
    1,
  );
  const list = await request(app).get("/api/shortages").expect(200);
  assert.equal(list.body.data.events.length, 1);
});

test("a derived persistence failure acknowledges the saved report and an unchanged retry recovers", async () => {
  const token = (await citizenSession(config)).token;
  const payload = input({ location: { lat: 24, lng: 73.8 } });
  const originalUpdate = ShortageEvent.updateOne;
  let saved;
  try {
    ShortageEvent.updateOne = async () => {
      throw new Error("Simulated derived storage failure");
    };
    saved = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(payload)
      .expect(201);
    assert.equal(saved.body.data.detectionStatus, "DEFERRED");
    assert.equal(await Report.countDocuments({ _id: saved.body.data.id }), 1);
  } finally {
    ShortageEvent.updateOne = originalUpdate;
  }
  const retry = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${token}`)
    .send(payload)
    .expect(200);
  assert.equal(retry.body.data.id, saved.body.data.id);
  assert.equal(retry.body.data.detectionStatus, "COMPLETE");
  assert.equal(
    await Report.countDocuments({ submissionId: payload.submissionId }),
    1,
  );
  const detail = await request(app)
    .get(`/api/reports/${saved.body.data.id}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(detail.body.data.shortageEvent, null);
  const persisted = await ShortageEvent.findOne({
    reportIds: detail.body.data.id,
  });
  assert.equal(persisted.status, "EMERGING");
  await request(app).get(`/api/shortages/${persisted.id}`).expect(404);
});

test("invalid, unavailable and later-phase mutation endpoints remain safe", async () => {
  await request(app).get("/api/shortages/not-an-id").expect(422);
  await request(app)
    .get(`/api/shortages/${"0".repeat(24)}`)
    .expect(404);
  await request(app).get("/api/shortages?demo=invalid").expect(422);
  await request(app)
    .post("/api/shortages/detect")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ severityScore: 99 })
    .expect(422);
  await request(app)
    .post(`/api/shortages/${eventId}/verify`)
    .send({})
    .expect(404);
  const unavailable = createApp(config, {
    databaseStatus: async () => "unavailable",
  });
  assert.equal(
    (await request(unavailable).get("/api/shortages").expect(503)).body.code,
    "DATABASE_UNAVAILABLE",
  );
  const production = createApp({ ...config, NODE_ENV: "production" });
  await request(production).get("/api/shortages?demo=true").expect(403);
});
