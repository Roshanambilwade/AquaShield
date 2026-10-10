import { cleanupTestDatabase } from "./helpers/cleanup.js";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import {
  createAdmin,
  createOperator,
  loginAdmin,
} from "../src/services/authService.js";
import { citizenSession } from "./helpers/citizen.js";
import { seedOperations } from "../src/demo/seedOperations.js";
import { initializeOperations } from "../src/services/operationsService.js";
import {
  ensureDelivery,
  initializeDeliveries,
} from "../src/services/deliveryService.js";
import { generateOtp } from "../src/services/deliveryOtp.js";
import Delivery from "../src/models/Delivery.js";
import Allocation from "../src/models/Allocation.js";
import Tanker from "../src/models/Tanker.js";
import ShortageEvent from "../src/models/ShortageEvent.js";
import Report from "../src/models/Report.js";
const dbName = `aquashield_delivery_test_${randomUUID().replaceAll("-", "")}`;
let config,
  app,
  actor,
  operator,
  token,
  opToken,
  otherToken,
  citizen,
  stranger,
  capturedCode;
const call = (method, path, body, as = opToken, target = app) =>
  request(target)[method](path).set("Authorization", `Bearer ${as}`).send(body);
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: true,
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
  const admin = await createAdmin({ email: "admin@delivery.test", password });
  actor = { id: String(admin._id), role: "ADMIN" };
  token = (await loginAdmin(admin.email, password, config)).token;
  operator = await createOperator({
    email: "operator@delivery.test",
    name: "Delivery operator",
    password,
  });
  opToken = (await loginAdmin(operator.email, password, config, ["OPERATOR"]))
    .token;
  const other = await createOperator({
    email: "other@delivery.test",
    name: "Other operator",
    password,
  });
  otherToken = (await loginAdmin(other.email, password, config, ["OPERATOR"]))
    .token;
  citizen = await citizenSession(config);
  stranger = await citizenSession(config);
  await seedOperations(config, actor);
  await initializeDeliveries();
});
after(() => cleanupTestDatabase(dbName));
async function fixture({ live = false } = {}) {
  assert.equal(mongoose.connection.name, dbName);
  // Clean only this suite's generated isolated database, never the root database.
  await Delivery.collection.deleteMany({});
  await Allocation.collection.deleteMany({});
  await Tanker.collection.deleteMany({});
  capturedCode = null;
  app = createApp(config, {
    deliveryDependencies: {
      handoff: async ({ code }) => {
        capturedCode = code;
      },
    },
  });
  let event;
  if (live) {
    const report = await call(
      "post",
      "/api/reports",
      {
        submissionId: randomUUID(),
        location: { lat: 20.011, lng: 73.79 },
        locationSource: "LOCALITY_CENTER",
        areaId: "AREA_01",
        locality: "Panchavati",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        householdSize: 5,
        reportedDurationHours: 24,
        lastSupplyTime: null,
      },
      citizen.token,
    ).expect(201);
    event = await ShortageEvent.findOne({
      isDemo: false,
      status: { $ne: "SUPERSEDED" },
      $or: [
        { reportIds: report.body.data.id },
        { duplicateReportIds: report.body.data.id },
        { suspiciousReportIds: report.body.data.id },
      ],
    });
  } else
    event = await ShortageEvent.findOne({
      isDemo: true,
      areaName: "Panchavati",
      status: "ACTIVE",
    });
  await initializeOperations();
  const tanker = await Tanker.create({
    identifier: "TEST-T01",
    name: "Controlled fixture tanker",
    capacityLitres: 10000,
    availableLitres: 8000,
    status: "AVAILABLE",
    operatorId: operator._id,
    currentLocation: { lat: 20, lng: 73.78 },
    observedAt: new Date(),
    isDemo: !live,
  });
  const evidence = {
    proposedLitres: 6000,
    rankings: [
      {
        eventId: String(event._id),
        area: event.areaName,
        center: event.center,
      },
    ],
    candidates: [],
  };
  const allocation = await Allocation.create({
    eventId: event._id,
    tankerId: tanker._id,
    operatorId: operator._id,
    status: "ASSIGNED",
    isDemo: !live,
    requestId: randomUUID(),
    createdBy: actor.id,
    approvedBy: actor.id,
    approvedAt: new Date(),
    assignedAt: new Date(),
    evidence,
  });
  await Tanker.updateOne(
    { _id: tanker._id },
    { $set: { status: "ASSIGNED", activeAllocationId: allocation._id } },
  );
  const delivery = await ensureDelivery(allocation);
  return {
    delivery,
    allocation,
    tanker,
    event,
    path: `/api/deliveries/${delivery.id}`,
  };
}
async function arrived(f) {
  await call("post", `${f.path}/start`, {}).expect(200);
  await call("post", `${f.path}/arrive`, {}).expect(200);
}
async function verified(f) {
  await arrived(f);
  const r = await call(
    "post",
    `${f.path}/${f.delivery.isDemo ? "demo-otp" : "otp"}`,
    {},
  ).expect(200);
  const code = r.body.data.demoOtp || capturedCode;
  await call("post", `${f.path}/verify`, { code }).expect(200);
  return code;
}
test("trips enforce operator ownership, admin read-only controls and strict authority fields", async () => {
  const f = await fixture();
  await call("get", f.path, undefined, otherToken).expect(404);
  await call("post", `${f.path}/start`, {}, otherToken).expect(404);
  await call("get", f.path, undefined, citizen.token).expect(403);
  await call("post", `${f.path}/start`, {}, token).expect(403);
  await call("get", f.path, undefined, token).expect(200);
  await call("get", `/api/operator/assignments/${f.allocation.id}`).expect(200);
  await call(
    "get",
    `/api/operator/assignments/${f.allocation.id}`,
    undefined,
    otherToken,
  ).expect(404);
  for (const body of [
    { status: "DELIVERED" },
    { operatorId: actor.id },
    { destination: { lat: 1, lng: 1 } },
  ])
    await call("post", `${f.path}/start`, body).expect(422);
  await call("post", `${f.path}/recover`, {}).expect(403);
});

test("a failed logistics explanation cannot block authorized trip, OTP, litre accounting or completion audit", async () => {
  const f = await fixture();
  let calls = 0;
  app = createApp(
    {
      ...config,
      DEMO_AI_MODE: false,
      GEMINI_API_KEY: "mock-only",
      GEMINI_MODEL_ID: "mock-model",
      AI_MAX_RETRIES: 0,
    },
    {
      aiDependencies: {
        invoke: async () => {
          calls++;
          throw Object.assign(new Error("PRIVATE"), { status: 503 });
        },
      },
    },
  );
  const result = await call(
    "post",
    "/api/ai/logistics",
    { demo: true, eventId: f.event.id },
    token,
  ).expect(200);
  assert.equal(result.body.data.execution.method, "RULE_BASED");
  assert.equal(
    result.body.data.execution.fallbackReasonCode,
    "AI_PROVIDER_UNAVAILABLE",
  );
  await call("post", `${f.path}/start`, {}, otherToken).expect(404);
  await verified(f);
  await call("post", `${f.path}/complete`, { litresDelivered: 4000 }).expect(
    200,
  );
  const stored = await Delivery.findById(f.delivery.id);
  assert.equal(stored.status, "DELIVERED");
  assert.equal(stored.litresDelivered, 4000);
  assert.equal(
    stored.audit.filter((a) => a.action === "DELIVERY_COMPLETED").length,
    1,
  );
  assert.equal(calls, 1);
});
test("trip lifecycle rejects skipped/repeated states and persists tanker projections", async () => {
  const f = await fixture();
  await call("post", `${f.path}/arrive`, {}).expect(409);
  await call("post", `${f.path}/complete`, { litresDelivered: 100 }).expect(
    409,
  );
  await call("post", `${f.path}/demo-otp`, {}).expect(409);
  await call("post", `${f.path}/start`, {}).expect(200);
  assert.equal((await Tanker.findById(f.tanker._id)).status, "EN_ROUTE");
  await call("post", `${f.path}/start`, {}).expect(409);
  const dashboard = await call(
    "get",
    "/api/dashboard/summary?demo=true",
    undefined,
    token,
  ).expect(200);
  assert.equal(dashboard.body.data.metrics.tankersEnRoute.value, 1);
  await call("post", `${f.path}/arrive`, {}).expect(200);
  assert.equal((await Tanker.findById(f.tanker._id)).status, "ARRIVED");
  await call("post", `${f.path}/arrive`, {}).expect(409);
  await call("post", `${f.path}/complete`, { litresDelivered: 100 }).expect(
    409,
  );
  const d = await Delivery.findById(f.delivery._id);
  assert.ok(d.startedAt && d.arrivedAt);
  assert.deepEqual(
    d.audit.map((a) => a.action),
    ["TRIP_STARTED", "TANKER_ARRIVED"],
  );
});
test("OTP is hashed, bounded, not ordinarily exposed and rate limited", async () => {
  const f = await fixture();
  await arrived(f);
  const r = await call("post", `${f.path}/demo-otp`, {}).expect(200),
    code = r.body.data.demoOtp;
  const stored = await Delivery.findById(f.delivery._id).select(
    "+otpHash +otpSalt",
  );
  assert.notEqual(stored.otpHash, code);
  assert.equal(stored.otpHash.length, 64);
  assert.ok(stored.otpExpiresAt > stored.otpIssuedAt);
  const normal = (await call("get", f.path).expect(200)).body;
  assert.equal(JSON.stringify(normal).includes(code), false);
  assert.equal(normal.data.delivery.otpHash, undefined);
  await call("post", `${f.path}/demo-otp`, {}).expect(409);
  const wrong = String((Number(code) + 1) % 1000000).padStart(6, "0");
  for (let i = 0; i < config.DELIVERY_OTP_MAX_ATTEMPTS; i++)
    await call("post", `${f.path}/verify`, { code: wrong }).expect(422);
  await call("post", `${f.path}/verify`, { code }).expect(422);
  assert.equal(
    (await Delivery.findById(f.delivery._id)).otpAttempts,
    config.DELIVERY_OTP_MAX_ATTEMPTS,
  );
  for (let i = 0; i < 20; i++)
    await call("post", `${f.path}/verify`, { code: "bad" });
  await call("post", `${f.path}/verify`, { code }).expect(429);
});
test("expired, wrong-delivery and replayed OTPs are rejected; concurrent verification has one winner", async () => {
  const f = await fixture();
  await arrived(f);
  let r = await call("post", `${f.path}/demo-otp`, {}).expect(200);
  await Delivery.updateOne(
    { _id: f.delivery._id },
    { $set: { otpExpiresAt: new Date(0), otpNextIssueAt: new Date(0) } },
  );
  await call("post", `${f.path}/verify`, { code: r.body.data.demoOtp }).expect(
    422,
  );
  assert.ok(
    (await Delivery.findById(f.delivery._id)).audit.some(
      (a) => a.action === "DELIVERY_OTP_EXPIRED",
    ),
  );
  const wrong = await generateOtp({
    _id: new mongoose.Types.ObjectId(),
    allocationId: f.allocation._id,
    eventId: f.event._id,
  });
  await Delivery.updateOne(
    { _id: f.delivery._id },
    {
      $set: {
        otpHash: wrong.hash,
        otpSalt: wrong.salt,
        otpExpiresAt: new Date(Date.now() + 60000),
        otpNextIssueAt: new Date(0),
      },
    },
  );
  await call("post", `${f.path}/verify`, { code: wrong.code }).expect(422);
  r = await call("post", `${f.path}/demo-otp`, {}).expect(200);
  const code = r.body.data.demoOtp;
  const results = await Promise.all([
    call("post", `${f.path}/verify`, { code }),
    call("post", `${f.path}/verify`, { code }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  await call("post", `${f.path}/verify`, { code }).expect(409);
  const d = await Delivery.findById(f.delivery._id).select("+otpHash +otpSalt");
  assert.equal(d.otpHash, undefined);
  assert.equal(
    d.audit.filter((a) => a.action === "DELIVERY_VERIFIED").length,
    1,
  );
});
test("actual litres obey capacity and approved quantity; concurrent completion counts once", async () => {
  const f = await fixture();
  await verified(f);
  for (const litresDelivered of [0, -1, 1.5, 6001, 8001, 10001])
    await call("post", `${f.path}/complete`, { litresDelivered }).expect(422);
  const results = await Promise.all([
    call("post", `${f.path}/complete`, { litresDelivered: 4500 }),
    call("post", `${f.path}/complete`, { litresDelivered: 4500 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  await call("post", `${f.path}/complete`, { litresDelivered: 4500 }).expect(
    409,
  );
  const [d, a, t] = await Promise.all([
    Delivery.findById(f.delivery._id),
    Allocation.findById(f.allocation._id),
    Tanker.findById(f.tanker._id),
  ]);
  assert.equal(d.status, "DELIVERED");
  assert.equal(d.litresDelivered, 4500);
  const completion = d.audit.find((a) => a.action === "DELIVERY_COMPLETED");
  assert.equal(completion.actorRole, "OPERATOR");
  assert.equal(String(completion.actorId), String(operator._id));
  assert.equal(completion.before.status, "COMPLETING");
  assert.equal(completion.after.status, "DELIVERED");
  assert.ok(completion.correlationId);
  assert.equal(
    d.audit.filter((a) => a.action === "DELIVERY_COMPLETION_STARTED").length,
    1,
  );
  assert.equal(d.syncPending, false);
  assert.equal(
    d.audit.filter((a) => a.action === "DELIVERY_COMPLETED").length,
    1,
  );
  assert.equal(a.status, "COMPLETED");
  assert.equal(a.active, false);
  assert.equal(t.status, "AVAILABLE");
  assert.equal(t.availableLitres, 3500);
  assert.equal(t.activeAllocationId, null);
  assert.equal(t.currentLocation, null);
  const summary = await call(
    "get",
    "/api/dashboard/summary?demo=true",
    undefined,
    token,
  ).expect(200);
  assert.equal(summary.body.data.metrics.waterDelivered.value, 4500);
  assert.notEqual(summary.body.data.metrics.averageResponseTime.value, null);
  assert.equal((await ShortageEvent.findById(f.event._id)).status, "ACTIVE");
});
test("admin recovery safely resumes partial completion without double debit or duplicate audit", async () => {
  const f = await fixture();
  await verified(f);
  const original = Allocation.updateOne;
  Allocation.updateOne = () => {
    throw Error("controlled interruption");
  };
  try {
    await call("post", `${f.path}/complete`, { litresDelivered: 3000 }).expect(
      500,
    );
  } finally {
    Allocation.updateOne = original;
  }
  assert.equal((await Delivery.findById(f.delivery._id)).status, "DELIVERED");
  assert.equal((await Delivery.findById(f.delivery._id)).syncPending, true);
  assert.equal(
    (await Tanker.findById(f.tanker._id)).activeAllocationId.toString(),
    f.allocation.id,
  );
  await call("post", `${f.path}/recover`, {}, token).expect(200);
  await call("post", `${f.path}/recover`, {}, token).expect(409);
  assert.equal((await Tanker.findById(f.tanker._id)).availableLitres, 5000);
  const recovered = (await Delivery.findById(f.delivery._id)).audit.filter(
    (a) => a.action === "DELIVERY_RECOVERED",
  );
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].actorRole, "ADMIN");
  assert.equal(recovered[0].outcome, "RECOVERED");
  assert.equal(String(recovered[0].actorId), actor.id);
  assert.equal(
    (await Delivery.findById(f.delivery._id)).audit.filter(
      (a) => a.action === "DELIVERY_COMPLETED",
    ).length,
    1,
  );
});
test("live citizen responses follow persisted delivery records without private staff or OTP data", async () => {
  const f = await fixture({ live: true });
  const reportId = String(f.event.reportIds[0]);
  const check = async (status) => {
    const reports = await call(
      "get",
      "/api/reports",
      undefined,
      citizen.token,
    ).expect(200);
    const own = reports.body.data.reports.find((r) => r.id === reportId);
    assert.equal(own.responseStatus.status, status);
    for (const field of [
      "operatorId",
      "allocationId",
      "tankerId",
      "audit",
      "otpHash",
      "otp",
      "notes",
    ])
      assert.equal(own.responseStatus[field], undefined);
    const detail = await call(
      "get",
      `/api/reports/${reportId}`,
      undefined,
      citizen.token,
    ).expect(200);
    assert.equal(detail.body.data.responseStatus.status, status);
    await call(
      "get",
      `/api/reports/${reportId}`,
      undefined,
      stranger.token,
    ).expect(404);
    await call("get", `/api/reports/${reportId}`, undefined, opToken).expect(
      403,
    );
  };
  await check("ASSIGNED");
  await call("post", `${f.path}/start`, {}).expect(200);
  await check("EN_ROUTE");
  await call("post", `${f.path}/arrive`, {}).expect(200);
  await check("ARRIVED");
  const issued = await call("post", `${f.path}/otp`, {}).expect(200);
  assert.equal(issued.body.data.demoOtp, undefined);
  await call("post", `${f.path}/demo-otp`, {}).expect(403);
  await call("post", `${f.path}/verify`, { code: capturedCode }).expect(200);
  await call("post", `${f.path}/complete`, { litresDelivered: 4000 }).expect(
    200,
  );
  await check("DELIVERED");
});
test("production disables demo verification and missing real handoff fails closed", async () => {
  const f = await fixture();
  await arrived(f);
  const production = createApp({ ...config, NODE_ENV: "production" });
  await call("post", `${f.path}/demo-otp`, {}, opToken, production).expect(404);
  await call(
    "get",
    "/api/deliveries?demo=true",
    undefined,
    token,
    production,
  ).expect(403);
  const live = await fixture({ live: true });
  await arrived(live);
  const noChannel = createApp(config);
  await call("post", `${live.path}/otp`, {}, opToken, noChannel).expect(503);
  assert.equal((await Delivery.findById(live.delivery._id)).otpVersion, 0);
});

test("logistics API consumes stored routes read-only and fairness analytics reflect completed litres", async () => {
  const f = await fixture();
  const before = (await Allocation.findById(f.allocation._id)).toObject();
  const advice = await call(
    "post",
    "/api/ai/logistics",
    { demo: true, eventId: f.event.id },
    token,
  ).expect(200);
  assert.equal(advice.body.data.facts.route.tripStatus, "ASSIGNED");
  assert.equal(advice.body.data.facts.route.distanceMethod, "STRAIGHT_LINE");
  assert.equal(advice.body.data.execution.providerExecuted, false);
  assert.deepEqual(
    (await Allocation.findById(f.allocation._id)).toObject(),
    before,
  );
  assert.equal(await Delivery.countDocuments(), 1);
  await verified(f);
  await call("post", `${f.path}/complete`, { litresDelivered: 3500 }).expect(
    200,
  );
  const analytics = await call(
    "get",
    "/api/dashboard/analytics?demo=true",
    undefined,
    token,
  ).expect(200);
  const area = analytics.body.data.operational.areas.find(
    (a) => a.area === "Panchavati",
  );
  assert.equal(area.deliveredLitres, 3500);
  assert.equal(area.allocations, 1);
  assert.equal(analytics.body.data.operational.estimatedPeopleServed, null);
});

test("citizen portal OTP supports real-source completion without messaging and excludes other roles and owners", async () => {
  const f = await fixture({ live: true });
  const report = await Report.findOne({
    _id: { $in: f.event.reportIds },
    ownerId: citizen.user.id,
  });
  const endpoint = `/api/reports/${report.id}/delivery-otp`;
  const production = createApp({ ...config, NODE_ENV: "production" });
  await call("post", endpoint, {}, stranger.token, production).expect(404);
  await call("post", endpoint, {}, opToken, production).expect(403);
  await call("post", endpoint, {}, token, production).expect(403);
  await call(
    "post",
    endpoint,
    { recipientId: citizen.user.id },
    citizen.token,
    production,
  ).expect(422);
  assert.notEqual(
    (await call("post", endpoint, {}, citizen.token, production)).status,
    200,
  );
  await arrived(f);
  const results = await Promise.all(
    [0, 1].map(() => call("post", endpoint, {}, citizen.token, production)),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  const result = results.find((r) => r.status === 200);
  assert.match(result.body.data.recipientOtp, /^\d{6}$/);
  assert.deepEqual(Object.keys(result.body.data).sort(), [
    "expiresAt",
    "notice",
    "recipientOtp",
  ]);
  assert.equal(result.headers["cache-control"], "no-store");
  const stored = await Delivery.findById(f.delivery._id).select(
    "+otpHash +otpSalt",
  );
  assert.equal(String(stored.recipientId), citizen.user.id);
  assert.equal(stored.otpChannel, "CITIZEN_PORTAL_OTP");
  assert.equal(
    JSON.stringify(stored).includes(result.body.data.recipientOtp),
    false,
  );
  const staff = await call(
    "get",
    f.path,
    undefined,
    opToken,
    production,
  ).expect(200);
  assert.equal(staff.body.data.delivery.recipientId, undefined);
  await call(
    "post",
    `${f.path}/verify`,
    { code: result.body.data.recipientOtp },
    opToken,
    production,
  ).expect(200);
  await call("post", endpoint, {}, citizen.token, production).expect(409);
  await call(
    "post",
    `${f.path}/complete`,
    { litresDelivered: 3500 },
    opToken,
    production,
  ).expect(200);
  assert.equal(
    (await Delivery.findById(f.delivery._id)).verificationMethod,
    "CITIZEN_PORTAL_OTP",
  );
  assert.equal((await Tanker.findById(f.tanker._id)).availableLitres, 4500);
});
test("trip route respects missing/stale locations and demo reset refuses active trips", async () => {
  const f = await fixture();
  await Delivery.updateOne(
    { _id: f.delivery._id },
    { $set: { destination: null } },
  );
  let route = (await call("get", f.path).expect(200)).body.data.route;
  assert.equal(route.routingStatus, "MISSING_COORDINATES");
  await Delivery.updateOne(
    { _id: f.delivery._id },
    { $set: { destination: f.event.center, originObservedAt: new Date(0) } },
  );
  route = (await call("get", f.path).expect(200)).body.data.route;
  assert.equal(route.routingStatus, "STALE_ORIGIN");
  await Tanker.updateOne(
    { _id: f.tanker._id },
    { $set: { seedOwner: "aquashield-phase6" } },
  );
  await call("post", `${f.path}/start`, {}).expect(200);
  await call(
    "post",
    "/api/operations/demo/reset?demo=true",
    { confirm: "RESET_DEMO_OPERATIONS" },
    token,
  ).expect(409);
  assert.equal((await Delivery.findById(f.delivery._id)).status, "EN_ROUTE");
});

test("an interrupted tanker projection repairs on owned list read without duplicate trip audit", async () => {
  const f = await fixture();
  const original = Tanker.updateOne;
  Tanker.updateOne = () => {
    throw Error("controlled projection failure");
  };
  try {
    await call("post", `${f.path}/start`, {}).expect(500);
  } finally {
    Tanker.updateOne = original;
  }
  assert.equal((await Delivery.findById(f.delivery._id)).status, "EN_ROUTE");
  await call("get", "/api/operator/assignments").expect(200);
  assert.equal((await Tanker.findById(f.tanker._id)).status, "EN_ROUTE");
  assert.equal(
    (await Delivery.findById(f.delivery._id)).audit.filter(
      (a) => a.action === "TRIP_STARTED",
    ).length,
    1,
  );
});

test("recovery before final delivery write and after tanker release remains idempotent", async () => {
  for (const stage of ["BEFORE_DELIVERED", "AFTER_RELEASE"]) {
    const f = await fixture();
    await verified(f);
    const model = stage === "BEFORE_DELIVERED" ? Delivery : Allocation;
    const original = model.updateOne;
    model.updateOne = function (filter, ...args) {
      if (
        stage === "BEFORE_DELIVERED"
          ? filter.status === "COMPLETING"
          : filter.status === "COMPLETED" && filter.active === true
      )
        throw Error("controlled completion failure");
      return original.call(this, filter, ...args);
    };
    try {
      await call("post", `${f.path}/complete`, {
        litresDelivered: 2500,
      }).expect(500);
    } finally {
      model.updateOne = original;
    }
    assert.equal((await Delivery.findById(f.delivery._id)).syncPending, true);
    await call("post", `${f.path}/recover`, {}, token).expect(200);
    assert.equal((await Tanker.findById(f.tanker._id)).availableLitres, 5500);
    assert.equal(
      (await Delivery.findById(f.delivery._id)).audit.filter(
        (a) => a.action === "DELIVERY_COMPLETED",
      ).length,
      1,
    );
    assert.equal((await Allocation.findById(f.allocation._id)).active, false);
  }
});

test("a trip winning the reset race keeps its allocation and reservation", async () => {
  const f = await fixture();
  await Tanker.updateOne(
    { _id: f.tanker._id },
    { $set: { seedOwner: "aquashield-phase6" } },
  );
  const original = Delivery.updateMany;
  Delivery.updateMany = async function (filter, ...args) {
    if (filter.status === "ASSIGNED")
      await Delivery.updateOne(
        { _id: f.delivery._id },
        { $set: { status: "EN_ROUTE", startedAt: new Date() } },
      );
    return original.call(this, filter, ...args);
  };
  try {
    await assert.rejects(seedOperations(config, actor, { reset: true }), {
      code: "OPERATION_CONFLICT",
    });
  } finally {
    Delivery.updateMany = original;
  }
  assert.equal((await Delivery.findById(f.delivery._id)).status, "EN_ROUTE");
  assert.equal(
    (await Allocation.findById(f.allocation._id)).status,
    "ASSIGNED",
  );
  assert.equal(
    (await Tanker.findById(f.tanker._id)).activeAllocationId.toString(),
    f.allocation.id,
  );
});

test("reset of a completed owned demo preserves unrelated custom and live records", async () => {
  const f = await fixture();
  await verified(f);
  await call("post", `${f.path}/complete`, { litresDelivered: 1000 }).expect(
    200,
  );
  await Tanker.updateOne(
    { _id: f.tanker._id },
    { $set: { seedOwner: "aquashield-phase6" } },
  );
  const custom = await Tanker.create({
    identifier: "CUSTOM",
    name: "Custom preserved",
    capacityLitres: 1000,
    isDemo: true,
    seedOwner: "custom",
    status: "UNAVAILABLE",
  });
  const live = await Tanker.create({
    identifier: "REAL",
    name: "Live preserved",
    capacityLitres: 1000,
    isDemo: false,
    status: "UNAVAILABLE",
  });
  await seedOperations(config, actor, { reset: true });
  assert.equal(await Delivery.exists({ _id: f.delivery._id }), null);
  assert.equal(await Allocation.exists({ _id: f.allocation._id }), null);
  assert.ok(await Tanker.exists({ _id: custom._id }));
  assert.ok(await Tanker.exists({ _id: live._id }));
});

test("legacy delivery ledger rows without allocation references do not block new unique trips", async () => {
  const f = await fixture();
  assert.equal(mongoose.connection.name, dbName);
  await mongoose.connection.collection("deliveries").insertMany(
    [1, 2].map(() => ({
      isDemo: true,
      status: "DELIVERED",
      otpVerified: true,
      litresDelivered: 100,
      areaId: "legacy",
      deliveredAt: new Date(),
    })),
  );
  const records = (
    await call("get", "/api/deliveries?demo=true", undefined, token).expect(200)
  ).body.data.deliveries;
  assert.equal(records.length, 3);
  assert.equal(records.find((d) => d.id === f.delivery.id).status, "ASSIGNED");
  for (const row of records.filter((d) => d.id !== f.delivery.id))
    assert.equal(row.verificationMethod, null);
  assert.equal(
    await Delivery.countDocuments({ allocationId: f.allocation._id }),
    1,
  );
});
