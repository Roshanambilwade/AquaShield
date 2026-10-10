import { cleanupTestDatabase } from "./helpers/cleanup.js";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import { seedPersistentDemo } from "../src/demo/persistentSeed.js";
import { accountDefinitions } from "../src/demo/scenario.js";
import { loginAdmin } from "../src/services/authService.js";
import { demoAdvice } from "../src/services/ai/demo.js";
import { validateAdvice } from "../src/services/ai/contracts.js";
import User from "../src/models/User.js";
import Report from "../src/models/Report.js";
import Area from "../src/models/Area.js";
import Tanker from "../src/models/Tanker.js";
import Allocation from "../src/models/Allocation.js";
import Delivery from "../src/models/Delivery.js";
import AllocationEvidence from "../src/models/AllocationEvidence.js";
import ShortageEvent from "../src/models/ShortageEvent.js";
import { allocationSnapshot } from "../src/services/operationsService.js";
import { persistedDemoAgentEvidence } from "../src/demo/agentEvidence.js";
const dbName = `aquashield_demo_test_${randomUUID().replaceAll("-", "")}`;
const passwords = Object.fromEntries(
  accountDefinitions.map((a) => [a.key, randomBytes(24).toString("hex")]),
);
let config, app, result, token, citizenToken, strangerToken, newReport;
const call = (method, path, body, auth = token, target = app) => {
  const req = request(target);
  return req[method](path).set("Authorization", `Bearer ${auth}`).send(body);
};
const logIn = async (key) =>
  (
    await loginAdmin(
      accountDefinitions.find((a) => a.key === key).email,
      passwords[key],
      config,
      ["ADMIN", "CITIZEN", "OPERATOR"],
    )
  ).token;
const records = async () =>
  Promise.all(
    [User, Area, Report, Tanker, Allocation, Delivery, AllocationEvidence].map(
      (m) => m.find().sort({ _id: 1 }).lean(),
    ),
  );
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMONSTRATION_MODE: true,
    DEMO_SEED_ENABLED: true,
    DEMO_DATABASE_NAME: "aquashield_demo",
    MONGODB_TEST_DB_NAME: dbName,
    DEMO_AI_MODE: true,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
  };
  config.MONGODB_URI = process.env.MONGODB_TEST_URI || config.MONGODB_URI;
  await connectDatabase(config);
  result = await seedPersistentDemo(config, passwords);
  app = createApp(config);
  token = await logIn("admin");
  citizenToken = await logIn("citizen-01");
  strangerToken = await logIn("citizen-16");
});
after(() => cleanupTestDatabase(dbName));
test("persisted scenario uses service transitions, valid relationships and verified delivered-water accounting", async () => {
  assert.deepEqual(result.totals, {
    citizens: 16,
    operators: 9,
    reports: 48,
    tankers: 9,
    allocations: 12,
    deliveries: 9,
  });
  assert.equal(result.aiCalls, 0);
  const trips = await Delivery.find().lean();
  assert.equal(trips.filter((d) => d.status === "DELIVERED").length, 6);
  for (const status of ["ASSIGNED", "EN_ROUTE", "ARRIVED"])
    assert.equal(trips.filter((d) => d.status === status).length, 1);
  for (const d of trips) {
    assert.ok(await Allocation.exists({ _id: d.allocationId, isDemo: true }));
    assert.ok(await User.exists({ _id: d.operatorId, role: "OPERATOR" }));
    if (d.status === "DELIVERED") {
      assert.equal(d.litresDelivered, 500);
      assert.ok(d.deliveredAt);
      assert.ok(d.verifiedAt);
      assert.equal(d.verificationMethod, "DEMO_OTP");
      assert.ok(d.audit.some((a) => a.action === "DELIVERY_VERIFIED"));
    }
  }
  assert.equal(await Area.countDocuments(), 6);
  assert.ok(await Report.exists({ verificationStatus: "PENDING" }));
  assert.ok(await Tanker.exists({ status: "UNAVAILABLE" }));
  const fleet = await Tanker.find().lean();
  assert.equal(
    fleet.reduce((n, t) => n + (t.availableLitres || 0), 0),
    55000 - 3000,
  );
  const allocations = await Allocation.find().lean();
  assert.ok(
    [...trips, ...allocations, ...fleet].reduce(
      (n, d) => n + d.audit.length,
      0,
    ) > 50,
  );
  const events = await ShortageEvent.find({
    isDemo: true,
    status: { $ne: "SUPERSEDED" },
  }).lean();
  assert.equal(new Set(events.map((e) => e.areaId)).size, 6);
  assert.ok(new Set(events.map((e) => e.severityLevel)).size >= 3);
  assert.ok(events.some((e) => e.status === "EMERGING"));
  assert.ok(
    events.reduce(
      (n, e) => n + e.duplicateReportCount + e.suspiciousReportCount,
      0,
    ) > 0,
  );
});
test("trusted environment includes new owned submissions, registration creates no reports and query flags cannot expose ownership", async () => {
  const beforeCount = await Report.countDocuments();
  const password = randomBytes(24).toString("hex"),
    email = `new-${randomUUID()}@example.test`;
  await request(app)
    .post("/api/auth/register")
    .send({ email, password, name: "New demonstration citizen" })
    .expect(201);
  assert.equal(await Report.countDocuments(), beforeCount);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password })
    .expect(200);
  const own = login.body.data.token;
  const input = {
    submissionId: randomUUID(),
    areaId: "AREA_01",
    locality: "Panchavati",
    location: { lat: 20.011, lng: 73.79 },
    locationSource: "LOCALITY_CENTER",
    problem: "NO_WATER",
    waterLevel: "EMPTY",
    householdSize: 5,
    reportedDurationHours: 24,
    lastSupplyTime: null,
  };
  newReport = (await call("post", "/api/reports", input, own).expect(201)).body
    .data;
  const saved = await Report.findById(newReport.id);
  assert.equal(saved.isDemo, true);
  assert.equal(saved.sourceType, "CITIZEN_SUBMISSION");
  assert.equal(saved.verificationStatus, "PENDING");
  await call("post", "/api/reports", input, own).expect(200);
  assert.equal(await Report.countDocuments(), beforeCount + 1);
  const history = (
    await call("get", "/api/reports", undefined, own).expect(200)
  ).body.data;
  assert.equal(history.reports.length, 1);
  await call(
    "get",
    `/api/reports/${newReport.id}`,
    undefined,
    strangerToken,
  ).expect(404);
  await request(app).get(`/api/reports/${newReport.id}`).expect(401);
  const publicDemo = await request(app)
    .get("/api/reports?demo=true")
    .expect(200);
  assert.equal(publicDemo.body.data.reports.length, 0);
  await call(
    "post",
    "/api/reports",
    { ...input, submissionId: randomUUID(), isDemo: false },
    own,
  ).expect(422);
  await call("get", "/api/reports", undefined, citizenToken).expect(200);
  await call("post", "/api/operations/demo/reset", {}, token).expect(403);
  await request(app)
    .get("/api/environment")
    .expect(200)
    .expect((r) => {
      assert.equal(r.body.data.demonstration, true);
      assert.equal(r.body.data.areas.length, 6);
    });
});
test("owned citizen handoff, operator guards, replay protection, municipal analytics and citizen status use persisted relationships", async () => {
  const arrived = await Delivery.findOne({ status: "ARRIVED" });
  const event = await ShortageEvent.findById(arrived.eventId);
  const report = await Report.findOne({
    _id: { $in: event.reportIds },
    ownerId: { $ne: null },
  }).sort({ createdAt: 1, _id: 1 });
  const user = await User.findById(report.ownerId);
  const citizenKey = accountDefinitions.find((a) => a.email === user.email).key;
  const recipientToken = await logIn(citizenKey);
  const operator = await User.findById(arrived.operatorId);
  const operatorKey = accountDefinitions.find(
    (a) => a.email === operator.email,
  ).key;
  const operatorToken = await logIn(operatorKey);
  const otherOperatorToken = await logIn(
    operatorKey === "operator-09" ? "operator-08" : "operator-09",
  );
  await call(
    "get",
    `/api/deliveries/${arrived.id}`,
    undefined,
    otherOperatorToken,
  ).expect(404);
  await call(
    "post",
    `/api/deliveries/${arrived.id}/complete`,
    { litresDelivered: 350 },
    operatorToken,
  ).expect(409);
  await call(
    "post",
    `/api/deliveries/${arrived.id}/verify`,
    { code: "000000" },
    token,
  ).expect(403);
  const issued = (
    await call(
      "post",
      `/api/reports/${report.id}/delivery-otp`,
      {},
      recipientToken,
    ).expect(200)
  ).body.data;
  assert.match(issued.recipientOtp, /^\d{6}$/);
  assert.ok(issued.notice.includes("simulated"));
  await call(
    "post",
    `/api/deliveries/${arrived.id}/verify`,
    { code: issued.recipientOtp },
    operatorToken,
  ).expect(200);
  await call(
    "post",
    `/api/deliveries/${arrived.id}/verify`,
    { code: issued.recipientOtp },
    operatorToken,
  ).expect(409);
  const starting = (await Tanker.findById(arrived.tankerId)).availableLitres;
  await call(
    "post",
    `/api/deliveries/${arrived.id}/complete`,
    { litresDelivered: 350 },
    operatorToken,
  ).expect(200);
  assert.equal(
    (await Tanker.findById(arrived.tankerId)).availableLitres,
    starting - 350,
  );
  assert.equal(
    (await Allocation.findById(arrived.allocationId)).status,
    "COMPLETED",
  );
  const detail = (
    await call(
      "get",
      `/api/reports/${report.id}`,
      undefined,
      recipientToken,
    ).expect(200)
  ).body.data;
  assert.equal(detail.responseStatus.status, "DELIVERED");
  assert.equal(JSON.stringify(detail).includes("operatorId"), false);
  const summary = (await call("get", "/api/dashboard/summary").expect(200)).body
    .data;
  assert.equal(summary.metrics.waterDelivered.value, 3350);
  const map = (await call("get", "/api/dashboard/map").expect(200)).body.data;
  assert.ok(map.zones.some((z) => z.areaName === "Panchavati"));
  const analytics = (await call("get", "/api/dashboard/analytics").expect(200))
    .body.data;
  assert.ok(analytics.reportsByHour.length > 0);
  const publicZones = (await request(app).get("/api/shortages").expect(200))
    .body.data.events;
  assert.ok(publicZones.every((e) => e.privacy?.generalized));
  assert.equal(
    publicZones.some((e) => e.areaId === "DEMO_AREA_06"),
    false,
  );
  await call("get", "/api/dashboard/map", undefined, operatorToken).expect(403);
  await call("get", "/api/dashboard/map", undefined, recipientToken).expect(
    403,
  );
});

test("all four agent roles validate mocked success and bounded provider outage using persisted scenario evidence", async () => {
  const realConfig = {
    ...config,
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "mock-only",
    GEMINI_MODEL_ID: "mock-model",
    AI_MAX_RETRIES: 0,
    AI_CIRCUIT_FAILURE_THRESHOLD: 20,
  };
  let calls = 0;
  const success = createApp(realConfig, {
    aiDependencies: {
      invoke: async ({ role, facts }) => {
        calls++;
        return demoAdvice(role, facts);
      },
    },
  });
  const outage = createApp(
    { ...realConfig },
    {
      aiDependencies: {
        invoke: async () => {
          throw Object.assign(new Error("PRIVATE_DETAIL"), { status: 503 });
        },
      },
    },
  );
  const hero = await ShortageEvent.findOne({
    areaName: "Panchavati",
    status: "ACTIVE",
  });
  const prior = await records();
  for (const role of ["detect", "allocate", "logistics", "predict"]) {
    const body = { eventId: String(hero._id) };
    const good = (
      await call("post", `/api/ai/${role}`, body, token, success).expect(200)
    ).body.data;
    assert.equal(good.execution.method, "GEMINI");
    assert.equal(good.approved, false);
    validateAdvice(good.advice, role, good.facts);
    assert.ok(good.facts.zones.length > 0);
    if (role === "allocate") {
      const snapshot = await allocationSnapshot(config, true);
      assert.deepEqual(
        good.facts.fleet.map((t) => t.id),
        snapshot.candidates.map((t) => t.id),
      );
      assert.equal(
        good.facts.allocationContext.proposedLitres,
        snapshot.proposedLitres,
      );
      for (const z of good.facts.zones) {
        const ranking = snapshot.rankings.find((r) => r.eventId === z.eventId);
        assert.equal(z.fairnessPenalty, ranking.fairnessPenalty);
        assert.equal(z.allocationPriority, ranking.priority);
      }
    }
    if (role === "logistics") {
      const latest = await Delivery.findOne({ eventId: hero._id }).sort({
        assignedAt: -1,
      });
      assert.equal(good.facts.route.tripStatus, latest.status);
    }
    if (role === "predict") assert.equal(good.facts.risk, null);
    const bad = (
      await call("post", `/api/ai/${role}`, body, token, outage).expect(200)
    ).body.data;
    assert.equal(bad.execution.method, "RULE_BASED");
    assert.equal(bad.execution.fallbackReasonCode, "AI_PROVIDER_UNAVAILABLE");
    assert.equal(bad.approved, false);
    assert.equal(bad.facts.evidenceVersion, good.facts.evidenceVersion);
    assert.equal(JSON.stringify(bad).includes("PRIVATE_DETAIL"), false);
    assert.throws(() =>
      validateAdvice(
        {
          ...good.advice,
          summary: "Confirmed 987654 people and verified delivery",
        },
        role,
        good.facts,
      ),
    );
  }
  assert.equal(calls, 4);
  const completed = await Delivery.findOne({ status: "DELIVERED" }).sort({
    deliveredAt: -1,
  });
  const logistics = (
    await call(
      "post",
      "/api/ai/logistics",
      { eventId: completed.eventId.toString() },
      token,
      success,
    ).expect(200)
  ).body.data;
  assert.equal(logistics.facts.route.tripStatus, "DELIVERED");
  for (const role of ["detect", "allocate", "logistics", "predict"]) {
    const facts = await persistedDemoAgentEvidence(role, config);
    for (const privateField of [
      "reporterKeyHash",
      "ownerId",
      "passwordHash",
      "description",
      "email",
    ])
      assert.equal(JSON.stringify(facts).includes(`"${privateField}"`), false);
  }
  const emerging = await ShortageEvent.findOne({
    areaId: "DEMO_AREA_06",
    status: "EMERGING",
  });
  const insufficient = (
    await call(
      "post",
      "/api/ai/detect",
      { eventId: emerging.id },
      token,
      outage,
    ).expect(200)
  ).body.data;
  assert.equal(insufficient.assessmentStatus, "INSUFFICIENT_DATA");
  assert.deepEqual(await records(), prior);
});
test("repeat seeding after reconnect preserves submissions and every operational record without delete/reset", async () => {
  const editable = await Tanker.findOne({ identifier: "FAC-T09" });
  await call("patch", `/api/operations/tankers/${editable.id}`, {
    revision: editable.revision,
    tanker: {
      identifier: "FAC-RENAMED-BY-ADMIN",
      name: "Municipal edited scenario unit",
      capacityLitres: editable.capacityLitres,
      availableLitres: editable.availableLitres,
      status: "UNAVAILABLE",
      operatorId: String(editable.operatorId),
      currentLocation: {
        lat: editable.currentLocation.lat,
        lng: editable.currentLocation.lng,
      },
      observedAt: editable.observedAt.toISOString(),
    },
  }).expect(200);
  const prior = await records();
  await disconnectDatabase();
  await connectDatabase(config);
  const originals = [Report, Area, Tanker, Allocation, Delivery, User].map(
    (m) => [m, m.deleteMany],
  );
  try {
    for (const [m] of originals)
      m.deleteMany = () => {
        throw new Error("Seed attempted deletion");
      };
    const repeated = await seedPersistentDemo(config, passwords);
    assert.equal(
      Object.values(repeated.counts).reduce((n, c) => n + c.inserted, 0),
      0,
    );
    assert.equal(repeated.totals.reports, 49);
  } finally {
    for (const [m, fn] of originals) m.deleteMany = fn;
  }
  assert.deepEqual(await records(), prior);
  await assert.rejects(
    seedPersistentDemo({ ...config, DEMO_SEED_ENABLED: false }, passwords),
    { code: "UNSAFE_DEMO_TARGET" },
  );
  await assert.rejects(
    seedPersistentDemo(
      { ...config, DEMO_DATABASE_NAME: "production" },
      passwords,
    ),
    { code: "UNSAFE_DEMO_TARGET" },
  );
  assert.deepEqual(await records(), prior);
});
