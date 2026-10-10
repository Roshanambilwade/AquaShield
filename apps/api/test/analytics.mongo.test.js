import { cleanupTestDatabase } from "./helpers/cleanup.js";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase } from "../src/config/database.js";
import {
  createAdmin,
  createOperator,
  loginAdmin,
} from "../src/services/authService.js";
import { citizenSession } from "./helpers/citizen.js";
import { analyticsFixtures } from "./helpers/analyticsFixtures.js";
import Report from "../src/models/Report.js";
import Allocation from "../src/models/Allocation.js";
import Delivery from "../src/models/Delivery.js";
import Tanker from "../src/models/Tanker.js";
import EarlyWarningAlert from "../src/models/EarlyWarningAlert.js";
import AllocationEvidence from "../src/models/AllocationEvidence.js";
import { protectAuditTrail } from "../src/models/auditTrail.js";
const dbName = `aquashield_phase10_test_${randomUUID().replaceAll("-", "")}`;
let config, app, token, opToken, citizen, f, admin;
const get = (path, as = token) =>
  request(app).get(path).set("Authorization", `Bearer ${as}`);
const query = (extra = {}) =>
  new URLSearchParams({
    from: f.from.toISOString(),
    to: f.to.toISOString(),
    ...extra,
  });
const analytics = (extra = {}) =>
  get(`/api/dashboard/analytics?${query(extra)}`);
const history = (extra = {}) => get(`/api/audit?${query(extra)}`);
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMONSTRATION_MODE: false,
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
  };
  await connectDatabase(
    {
      ...config,
      MONGODB_URI: process.env.MONGODB_TEST_URI || config.MONGODB_URI,
    },
    { dbName },
  );
  const password = randomBytes(24).toString("hex");
  admin = await createAdmin({ email: "admin@phase10.test", password });
  token = (await loginAdmin(admin.email, password, config)).token;
  const op = await createOperator({
    name: "Synthetic operator",
    email: "op@phase10.test",
    password,
  });
  opToken = (await loginAdmin(op.email, password, config, ["OPERATOR"])).token;
  citizen = await citizenSession(config);
  f = await analyticsFixtures(admin._id, op._id);
  await Promise.all(
    [
      Report,
      Allocation,
      Delivery,
      Tanker,
      EarlyWarningAlert,
      AllocationEvidence,
    ].map((m) => m.createIndexes()),
  );
  app = createApp(config, {
    aiDependencies: {
      invoke: async () => {
        throw new Error("Synthetic provider outage");
      },
    },
  });
});
after(() => cleanupTestDatabase(dbName));
test("analytics date window is inclusive/exclusive and isolates demo data and area groupings", async () => {
  const d = (await analytics().expect(200)).body.data;
  assert.equal(d.reports.total, 4);
  assert.equal(d.reports.verified, 1);
  assert.equal(d.reports.pendingVerification, 2);
  assert.equal(d.reports.rejected, 1);
  assert.equal(d.reports.unverified, 3);
  assert.equal(
    d.reports.byDay.reduce((n, r) => n + r.count, 0),
    4,
  );
  assert.equal(
    d.operational.areas.find((a) => a.areaId === "AREA_01").reports,
    2,
  );
  assert.equal(d.operational.areas.find((a) => a.areaId === null).reports, 1);
  assert.equal(
    (await analytics({ areaId: "AREA_01" }).expect(200)).body.data.reports
      .total,
    2,
  );
  assert.equal(
    (await analytics({ demo: "true" }).expect(200)).body.data.reports.total,
    1,
  );
  assert.equal(d.current.activeCases, 1);
  assert.equal(d.current.emergingCases, 1);
  assert.equal(
    d.severityDistribution.find((s) => s.level === "CRITICAL").count,
    1,
  );
});
test("allocation counts follow individual action timestamps, not current-state or creation-only counts", async () => {
  const d = (await analytics().expect(200)).body.data;
  assert.deepEqual(d.allocations, {
    recommended: 1,
    approved: 1,
    rejected: 1,
    assigned: 1,
    states: [{ status: "COMPLETED", count: 1 }],
    conflicts: 1,
  });
  assert.equal(
    (await analytics({ areaId: "AREA_02" }).expect(200)).body.data.allocations
      .rejected,
    1,
  );
});
test("accepted completion litres, pending cohorts and valid timing denominators exclude incomplete records", async () => {
  const d = (await analytics().expect(200)).body.data;
  assert.equal(d.deliveries.completed, 4);
  assert.equal(d.deliveries.litres, 1750);
  assert.equal(d.deliveries.excludedCompletedRecords, 2);
  assert.equal(d.deliveries.response.count, 2);
  assert.equal(d.deliveries.response.averageMinutes, 82.5);
  assert.equal(d.deliveries.completion.averageMinutes, 45);
  assert.equal(
    d.deliveries.response.distribution.reduce((n, b) => n + b.count, 0),
    2,
  );
  assert.ok(
    d.deliveries.states.some((s) => s.status === "ARRIVED" && s.count === 1),
  );
  assert.equal(d.deliveries.failedOtpEvents[0].count, 1);
  assert.equal(d.deliveries.recovered, 1);
  assert.equal(
    d.operational.areas.find((a) => a.areaId === "AREA_01").completedDeliveries,
    4,
  );
});
test("report milestone joins count one earliest delivery per report despite overlapping event associations", async () => {
  const t = (await analytics().expect(200)).body.data.reports.timings;
  assert.equal(t.cohortSize, 3);
  assert.equal(t.reportToDelivery.count, 2);
  assert.equal(t.reportToDelivery.averageMinutes, 90);
  assert.equal(t.reportToRecommendation.count, 1);
  assert.equal(t.reportToAssignment.count, 1);
  assert.equal(t.pendingElapsed.count, 1);
  assert.equal(t.pendingElapsed.averageMinutes, 1260);
});
test("fleet snapshot uses operational eligibility, excludes reserved and stale tankers, and retains unknowns", async () => {
  const d = (await analytics().expect(200)).body.data;
  assert.equal(d.operational.fleetCount, 3);
  assert.equal(d.operational.availableTankers, 1);
  assert.equal(d.operational.busyTankers, 1);
  assert.equal(d.operational.utilizationPercent, 33.3);
  assert.equal(d.reports.reviewTime.averageMinutes, null);
  assert.equal(d.current.resolvedCases, null);
  assert.equal(d.operational.estimatedPeopleServed, null);
});
test("observed alert cohorts and saved forecasts remain separate and available without Gemini", async () => {
  const d = (await analytics().expect(200)).body.data;
  assert.equal(d.alerts.created, 1);
  assert.deepEqual(d.alerts.risks, [{ riskLevel: "HIGH", count: 1 }]);
  assert.deepEqual(d.alerts.states, [{ status: "ACKNOWLEDGED", count: 1 }]);
  assert.equal(d.predictions.providerRequested, false);
  assert.equal(d.predictions.status, "NOT_EVALUATED");
  assert.equal(d.predictions.highRiskAreas, null);
});
test("analytics reads do not write or recalculate source records and do not disclose private evidence", async () => {
  const snapshot = async () =>
    Promise.all(
      [Report, Allocation, Delivery, Tanker, EarlyWarningAlert].map((m) =>
        m.collection.find({}).sort({ _id: 1 }).toArray(),
      ),
    );
  const before = await snapshot(),
    r = await analytics().expect(200);
  assert.deepEqual(await snapshot(), before);
  for (const privateValue of [
    "PRIVATE",
    "20.011",
    "73.79",
    "otpHash",
    "reporterKeyHash",
  ])
    assert.equal(JSON.stringify(r.body).includes(privateValue), false);
});
test("analytics and audit guard every role before validating filters; production demo access is rejected", async () => {
  for (const path of [
    "/api/dashboard/analytics",
    "/api/audit",
    "/api/audit/invalid",
  ]) {
    await request(app).get(path).expect(401);
    await get(path, opToken).expect(403);
    await get(path, citizen.token).expect(403);
  }
  for (const q of [
    { limit: "51" },
    { page: "101" },
    { actorId: "$ne" },
    { from: "invalid", to: f.to.toISOString() },
    { unknown: "x" },
  ])
    await history(q).expect(422);
  for (const q of [
    { areaId: "UNLISTED" },
    { from: "invalid" },
    { from: f.to.toISOString(), to: f.from.toISOString() },
    { unknown: "x" },
  ])
    await analytics(q).expect(422);
  const production = createApp({ ...config, NODE_ENV: "production" });
  for (const path of [
    "/api/audit?demo=true",
    "/api/dashboard/analytics?demo=true",
  ])
    await request(production)
      .get(path)
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
});
test("audit union pagination, filters, detail and redaction retain target references and unknown legacy roles", async () => {
  const first = (await history({ limit: "2" }).expect(200)).body.data;
  const second = (await history({ limit: "2", page: "2" }).expect(200)).body
    .data;
  assert.equal(first.events.length, 2);
  assert.equal(first.hasMore, true);
  assert.equal(
    first.events.some((e) => second.events.some((s) => e.id === s.id)),
    false,
  );
  const all = (await history({ limit: "50" }).expect(200)).body.data.events;
  for (const type of [
    "REPORT",
    "ALLOCATION",
    "DELIVERY",
    "EARLY_WARNING_ALERT",
  ])
    assert.ok(all.some((e) => e.targetType === type));
  for (const value of [
    "PRIVATE",
    '"otpHash":',
    '"description":',
    '"location":',
    '"reason":',
  ])
    assert.equal(JSON.stringify(all).includes(value), false);
  const events = (
    await history({
      eventType: "ALLOCATION_APPROVED",
      actorId: String(admin._id).toUpperCase(),
      targetType: "ALLOCATION",
      targetId: String(f.allocationId),
      outcome: "SUCCESS",
      correlationId: f.correlationId,
    }).expect(200)
  ).body.data.events;
  assert.equal(events.length, 1);
  assert.equal(events[0].actorRole, "ADMIN");
  assert.deepEqual(events[0].before, { status: "RECOMMENDED" });
  assert.deepEqual(events[0].after, { status: "APPROVED" });
  assert.deepEqual(
    (await get(`/api/audit/${events[0].id}`).expect(200)).body.data,
    events[0],
  );
  await get(`/api/audit/${events[0].id}?demo=true`).expect(404);
  const legacy = all.find((e) => e.eventType === "ALERT_CREATED");
  assert.equal(legacy.actorRole, null);
  assert.equal(legacy.correlationId, null);
  assert.equal(legacy.outcome, "SUCCESS");
  assert.deepEqual(
    (await get(`/api/audit/${legacy.id}`).expect(200)).body.data,
    legacy,
  );
  assert.equal(
    (await history({ outcome: "FAILURE" }).expect(200)).body.data.events.length,
    2,
  );
  assert.equal(
    (await history({ outcome: "RECOVERED" }).expect(200)).body.data.events
      .length,
    1,
  );
});
test("citizen creation records an authenticated actor and server correlation atomically, once on replay", async () => {
  const payload = {
    submissionId: randomUUID(),
    location: { lat: 20.011, lng: 73.79 },
    locationSource: "MANUAL",
    locality: "Private citizen test",
    problem: "NO_WATER",
    waterLevel: "EMPTY",
    householdSize: 4,
  };
  const submit = () =>
    request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${citizen.token}`)
      .set("X-Request-ID", "untrusted")
      .send(payload);
  const created = await submit().expect(201);
  await submit().expect(200);
  const r = await Report.findById(created.body.data.id);
  assert.equal(r.audit.length, 1);
  assert.equal(String(r.audit[0].actorId), citizen.id);
  assert.equal(r.audit[0].actorRole, "CITIZEN");
  assert.equal(r.audit[0].correlationId, created.headers["x-request-id"]);
  assert.notEqual(r.audit[0].correlationId, "untrusted");
  assert.equal(created.body.data.audit, undefined);
});
test("application models protect journals against editing, deletion and replacement", async () => {
  const id = f.reports[0]._id;
  for (const update of [
    { $pull: { audit: { action: "REPORT_CREATED" } } },
    { $set: { audit: [] } },
    { $push: { audit: { $each: [], $slice: 0 } } },
  ])
    await assert.rejects(Report.updateOne({ _id: id }, update), /audit/i);
  await assert.rejects(Report.deleteOne({ _id: id }), /audit/i);
  await assert.rejects(Report.replaceOne({ _id: id }, {}), /replaced/i);
  const r = await Report.findById(id);
  r.audit[0].action = "PRIVATE";
  // Exercise the audit save guard independently of legacy-field validation.
  await assert.rejects(r.save({ validateBeforeSave: false }), /append-only/i);
  // Verify the same middleware is installed on all journal-bearing models.
  for (const model of [
    Allocation,
    Delivery,
    Tanker,
    EarlyWarningAlert,
    AllocationEvidence,
  ])
    await assert.rejects(
      model.updateOne({}, { $unset: { audit: 1 } }),
      /append-only/i,
    );
  const schema = new mongoose.Schema({ audit: Array });
  protectAuditTrail(schema);
  assert.ok(schema.indexes().some(([index]) => index["audit.at"] === -1));
});
