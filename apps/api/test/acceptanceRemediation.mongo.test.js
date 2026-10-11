import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
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
import { cleanupTestDatabase } from "./helpers/cleanup.js";
import Report from "../src/models/Report.js";
import Tanker from "../src/models/Tanker.js";
import Allocation from "../src/models/Allocation.js";
import Delivery from "../src/models/Delivery.js";
import ShortageEvent from "../src/models/ShortageEvent.js";
import ForecastObservation from "../src/models/ForecastObservation.js";
import Prediction from "../src/models/Prediction.js";
import EarlyWarningAlert from "../src/models/EarlyWarningAlert.js";
import CitizenAdvisory from "../src/models/CitizenAdvisory.js";
import { prepareForecastFixture } from "../src/demo/forecastFixture.js";
import { demoReadiness } from "../src/services/demoReadinessService.js";
const dbName = `aquashield_reliability_test_${randomUUID().replaceAll("-", "")}`;
const password = randomBytes(24).toString("hex");
let config,
  app,
  admin,
  token,
  citizens,
  operator,
  reportIds = [],
  tanker,
  notice,
  child;
const api = (method, path, body, auth = token) => {
  const client = request(app);
  return client[method](path)
    .set("Authorization", `Bearer ${auth || ""}`)
    .send(body);
};
const publish = (
  sourceId = "acceptance-area",
  audience = "AREA",
  areaId = "AREA_01",
) => ({
  areaId,
  audience,
  category: "DEMONSTRATION",
  sourceType: "SIMULATED",
  sourceId,
  expiresInHours: 24,
});
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMONSTRATION_MODE: true,
    DEMO_SEED_ENABLED: true,
    FORECAST_DEMO_ENABLED: true,
    MONGODB_TEST_DB_NAME: dbName,
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
  };
  await connectDatabase(config);
  admin = await createAdmin({
    email: "acceptance-admin@example.test",
    password,
  });
  token = (await loginAdmin(admin.email, password, config)).token;
  citizens = await Promise.all([
    citizenSession(config),
    citizenSession(config),
    citizenSession(config),
  ]);
  const op = await createOperator({
    email: "acceptance-op@example.test",
    name: "Synthetic operator",
    password,
  });
  operator = await loginAdmin(op.email, password, config, ["OPERATOR"]);
  app = createApp(config, {
    aiDependencies: {
      invoke: async () => {
        throw new Error("Synthetic Gemini outage");
      },
    },
  });
  for (const [i, citizen] of citizens.entries()) {
    const result = await api(
      "post",
      "/api/reports",
      {
        submissionId: randomUUID(),
        areaId: "AREA_01",
        locality: "Panchavati",
        location: { lat: 20.011 + i * 0.0001, lng: 73.79 },
        locationSource: "MANUAL",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        householdSize: 4,
        reportedDurationHours: 24,
      },
      citizen.token,
    ).expect(201);
    reportIds.push(result.body.data.id);
  }
});
after(async () => {
  if (child && child.exitCode === null) {
    const done = once(child, "exit");
    child.send("stop");
    await done;
  }
  await cleanupTestDatabase(dbName);
});
test("review authorization, reason and strict transitions reject client invention", async () => {
  for (const auth of [citizens[0].token, operator.token])
    await api(
      "post",
      `/api/dashboard/reports/${reportIds[0]}/review`,
      { status: "VERIFIED", note: "Evidence reviewed" },
      auth,
    ).expect(403);
  await api("post", `/api/dashboard/reports/${reportIds[0]}/review`, {
    status: "REJECTED",
    note: "",
  }).expect(422);
  await api("post", `/api/dashboard/reports/${reportIds[0]}/review`, {
    status: "PENDING",
    note: "Evidence reviewed",
  }).expect(422);
  await api(
    "post",
    "/api/reports",
    { verificationStatus: "VERIFIED" },
    citizens[0].token,
  ).expect(422);
});
test("one simultaneous review succeeds, journal records actor/time/correlation and derived count", async () => {
  const path = `/api/dashboard/reports/${reportIds[0]}/review`;
  const results = await Promise.all([
    api("post", path, {
      status: "VERIFIED",
      note: "Submitted evidence reviewed; no field visit",
    }),
    api("post", path, {
      status: "REJECTED",
      note: "Conflicting submitted evidence",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const row = await Report.findById(reportIds[0]);
  assert.notEqual(row.verificationStatus, "PENDING");
  assert.equal(row.verificationSource, "SIMULATED_ADMIN_EVIDENCE_REVIEW");
  assert.ok(row.reviewedAt);
  const entries = row.audit.filter((a) =>
    ["REPORT_VERIFIED", "REPORT_REJECTED"].includes(a.action),
  );
  assert.equal(entries.length, 1);
  assert.equal(String(entries[0].actorId), admin.id);
  assert.equal(entries[0].actorRole, "ADMIN");
  assert.ok(entries[0].correlationId);
  assert.ok(entries[0].reason);
  await api("post", path, {
    status: "VERIFIED",
    note: "Repeat review denied",
  }).expect(409);
  await api("post", `/api/dashboard/reports/${reportIds[1]}/review`, {
    status: "VERIFIED",
    note: "Synthetic submitted evidence reviewed",
  }).expect(200);
  const event = await ShortageEvent.findOne({
    reportIds: reportIds[1],
    status: { $ne: "SUPERSEDED" },
  });
  assert.ok(event.verifiedReportCount >= 1);
  const own = await api(
    "get",
    `/api/reports/${reportIds[1]}`,
    undefined,
    citizens[1].token,
  ).expect(200);
  assert.equal(own.body.data.verificationStatus, "VERIFIED");
  assert.ok(own.body.data.reviewedAt);
  assert.equal(own.body.data.reviewedBy, undefined);
});
test("rejection retains history, excludes derived evidence and audit API exposes only safe transitions", async () => {
  await api("post", `/api/dashboard/reports/${reportIds[2]}/review`, {
    status: "REJECTED",
    note: "Synthetic evidence inconsistent with review",
  }).expect(200);
  assert.equal(
    (await Report.findById(reportIds[2])).verificationStatus,
    "REJECTED",
  );
  assert.equal(
    await ShortageEvent.countDocuments({
      reportIds: reportIds[2],
      status: { $ne: "SUPERSEDED" },
    }),
    0,
  );
  const audit = await api(
    "get",
    `/api/audit?targetType=REPORT&targetId=${reportIds[2]}&eventType=REPORT_REJECTED`,
  ).expect(200);
  assert.equal(audit.body.data.events.length, 1);
  assert.equal(audit.body.data.events[0].outcome, "SUCCESS");
  assert.equal(audit.body.data.events[0].before.status, "PENDING");
  assert.equal(JSON.stringify(audit.body).includes("inconsistent"), false);
});
test("citizen preference is explicit/validated; municipal and inbox writes enforce roles", async () => {
  await api(
    "put",
    "/api/citizen/alerts/area",
    { areaId: "UNKNOWN_AREA" },
    citizens[0].token,
  ).expect(422);
  await api(
    "put",
    "/api/citizen/alerts/area",
    { areaId: "AREA_01", userId: citizens[1].id },
    citizens[0].token,
  ).expect(422);
  await api(
    "put",
    "/api/citizen/alerts/area",
    { areaId: "AREA_01" },
    citizens[0].token,
  ).expect(200);
  await api(
    "put",
    "/api/citizen/alerts/area",
    { areaId: "AREA_02" },
    citizens[1].token,
  ).expect(200);
  await api("post", "/api/advisories", publish(), citizens[0].token).expect(
    403,
  );
  await api("get", "/api/citizen/alerts", undefined, token).expect(403);
  await api("get", "/api/citizen/alerts", undefined, null).expect(401);
});
test("stable advisory identity deduplicates concurrent publication and safe projection excludes private evidence", async () => {
  const responses = await Promise.all([
    api("post", "/api/advisories", publish()).expect(200),
    api("post", "/api/advisories", publish()).expect(200),
  ]);
  notice = responses[0].body.data;
  assert.equal(responses[1].body.data.id, notice.id);
  assert.equal(await CitizenAdvisory.countDocuments(), 1);
  const result = await api(
    "get",
    "/api/citizen/alerts",
    undefined,
    citizens[0].token,
  ).expect(200);
  assert.equal(result.body.data.unreadCount, 1);
  assert.equal(result.body.data.notifications[0].areaId, "AREA_01");
  for (const field of [
    "ownerId",
    "sourceId",
    "sourceType",
    "audit",
    "location",
    "description",
    "photo",
    "publishedBy",
  ])
    assert.equal(result.body.data.notifications[0][field], undefined);
  const unrelated = await api(
    "get",
    "/api/citizen/alerts",
    undefined,
    citizens[1].token,
  ).expect(200);
  assert.equal(unrelated.body.data.notifications.length, 0);
  await api(
    "put",
    `/api/citizen/alerts/${notice.id}/read`,
    { read: true },
    citizens[1].token,
  ).expect(404);
});
test("per-citizen read/unread never changes global state and persists through renewed login", async () => {
  await api(
    "put",
    `/api/citizen/alerts/${notice.id}/read`,
    { read: true },
    citizens[0].token,
  ).expect(200);
  await api(
    "put",
    `/api/citizen/alerts/${notice.id}/read`,
    { read: true },
    citizens[0].token,
  ).expect(200);
  const session = await loginAdmin(
    citizens[0].user.email,
    citizens[0].password,
    config,
    ["CITIZEN"],
  );
  const result = await api(
    "get",
    "/api/citizen/alerts",
    undefined,
    session.token,
  ).expect(200);
  assert.equal(result.body.data.unreadCount, 0);
  assert.ok(result.body.data.notifications[0].readAt);
  assert.equal((await CitizenAdvisory.findById(notice.id)).status, "ACTIVE");
  await api(
    "put",
    `/api/citizen/alerts/${notice.id}/read`,
    { read: false },
    citizens[0].token,
  ).expect(200);
});
test("municipal audience, bounded history, expiry, withdrawal and area changes", async () => {
  await api(
    "post",
    "/api/advisories",
    publish("all-areas", "MUNICIPAL"),
  ).expect(200);
  const result = await api(
    "get",
    "/api/citizen/alerts?limit=1",
    undefined,
    citizens[0].token,
  ).expect(200);
  assert.equal(result.body.data.hasMore, true);
  assert.equal(result.body.data.notifications.length, 1);
  assert.equal(
    (await api("get", "/api/citizen/alerts", undefined, citizens[1].token)).body
      .data.notifications.length,
    1,
  );
  await api("post", `/api/advisories/${notice.id}/withdraw`, {
    revision: notice.revision,
  }).expect(200);
  await api("post", `/api/advisories/${notice.id}/withdraw`, {
    revision: notice.revision,
  }).expect(409);
  assert.equal(
    (
      await api(
        "get",
        "/api/citizen/alerts?history=true",
        undefined,
        citizens[0].token,
      )
    ).body.data.notifications.some((n) => n.status === "WITHDRAWN"),
    true,
  );
  await CitizenAdvisory.updateOne(
    { sourceId: "all-areas" },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal(
    (await api("get", "/api/citizen/alerts", undefined, citizens[1].token)).body
      .data.unreadCount,
    0,
  );
  assert.equal(
    (
      await api(
        "get",
        "/api/citizen/alerts?history=true",
        undefined,
        citizens[1].token,
      )
    ).body.data.notifications[0].status,
    "EXPIRED",
  );
  await api(
    "put",
    "/api/citizen/alerts/area",
    { areaId: "AREA_03" },
    citizens[0].token,
  ).expect(200);
  assert.equal(
    (
      await api(
        "get",
        "/api/citizen/alerts?history=true",
        undefined,
        citizens[0].token,
      )
    ).body.data.notifications.length,
    1,
  );
});
test("unverified reports and synthetic forecasts cannot publish emergency claims; validated reviewed evidence may publish", async () => {
  const body = {
    ...publish(),
    category: "SUPPLY_REVIEW",
    sourceType: "REPORT",
    sourceId: reportIds[2],
  };
  await api("post", "/api/advisories", body).expect(422);
  await api("post", "/api/advisories", {
    ...body,
    sourceId: reportIds[1],
    title: "Private invented claim",
  }).expect(422);
  const saved = await api("post", "/api/advisories", {
    ...body,
    sourceId: reportIds[1],
  }).expect(200);
  const repeated = await api("post", "/api/advisories", {
    ...body,
    sourceId: reportIds[1].toUpperCase(),
  }).expect(200);
  assert.equal(saved.body.data.id, repeated.body.data.id);
});
test("fresh server observation preserves old state and makes suitable tanker eligible", async () => {
  const created = await api("post", "/api/operations/tankers", {
    identifier: "ACCEPTANCE-T01",
    name: "Synthetic tanker",
    capacityLitres: 10000,
    availableLitres: 8000,
    status: "AVAILABLE",
    currentLocation: { lat: 20, lng: 73.78 },
    observedAt: new Date(Date.now() - 86400000).toISOString(),
    operatorId: operator.user.id,
  }).expect(200);
  tanker = created.body.data.tanker;
  const before = await api("get", "/api/operations/tankers").expect(200);
  assert.equal(before.body.data.tankers[0].eligibility.eligible, false);
  const input = {
    revision: tanker.revision,
    availableLitres: 8000,
    status: "AVAILABLE",
    currentLocation: tanker.currentLocation,
    assessment: "Present-time authorized simulated inspection",
    confirmSimulated: true,
  };
  await api("post", `/api/operations/tankers/${tanker.id}/observation`, {
    ...input,
    observedAt: "2099-01-01T00:00:00Z",
  }).expect(422);
  await api("post", `/api/operations/tankers/${tanker.id}/observation`, {
    ...input,
    availableLitres: 10001,
  }).expect(422);
  await api(
    "post",
    `/api/operations/tankers/${tanker.id}/observation`,
    input,
    citizens[0].token,
  ).expect(403);
  const results = await Promise.all([
    api("post", `/api/operations/tankers/${tanker.id}/observation`, input),
    api("post", `/api/operations/tankers/${tanker.id}/observation`, input),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const saved = await Tanker.findById(tanker.id);
  assert.equal(saved.observations.length, 1);
  assert.equal(
    +saved.observations[0].previousObservedAt,
    +new Date(tanker.observedAt),
  );
  assert.equal(saved.availableLitres, 8000);
  assert.equal(saved.audit.at(-1).action, "TANKER_OBSERVED");
  assert.equal(
    (await api("get", "/api/operations/tankers")).body.data.tankers[0]
      .eligibility.eligible,
    true,
  );
  // Rejected earlier review fixtures must not be reused as an active allocation zone.
  for (let i = 0; i < 3; i++) {
    const citizen = await citizenSession(config);
    await api(
      "post",
      "/api/reports",
      {
        submissionId: randomUUID(),
        areaId: "AREA_01",
        locality: "Panchavati",
        location: { lat: 20.011 + i * 0.0001, lng: 73.79 },
        locationSource: "MANUAL",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        householdSize: 5,
        reportedDurationHours: 24,
      },
      citizen.token,
    ).expect(201);
  }
  const context = (await api("get", "/api/operations/allocation-context")).body
    .data;
  assert.ok(context.candidates.some((t) => t.id === tanker.id));
});
test("reserved and busy tankers refuse observations, demo mutations disabled in ordinary/production mode", async () => {
  const saved = await Tanker.findById(tanker.id);
  const input = {
    revision: saved.revision,
    availableLitres: 8000,
    status: "AVAILABLE",
    currentLocation: null,
    assessment: "Present-time simulated assessment",
    confirmSimulated: true,
  };
  await Tanker.updateOne(
    { _id: tanker.id },
    { $set: { activeAllocationId: new mongoose.Types.ObjectId() } },
  );
  await api(
    "post",
    `/api/operations/tankers/${tanker.id}/observation`,
    input,
  ).expect(409);
  await Tanker.updateOne(
    { _id: tanker.id },
    { $set: { activeAllocationId: null, status: "EN_ROUTE" } },
  );
  await api(
    "post",
    `/api/operations/tankers/${tanker.id}/observation`,
    input,
  ).expect(409);
  await Tanker.updateOne({ _id: tanker.id }, { $set: { status: "AVAILABLE" } });
  for (const cfg of [
    { ...config, DEMONSTRATION_MODE: false },
    { ...config, NODE_ENV: "production" },
  ])
    await request(createApp(cfg))
      .post(`/api/operations/tankers/${tanker.id}/observation`)
      .set("Authorization", `Bearer ${token}`)
      .send(input)
      .expect(403);
});
test("fixture preparation is guarded and idempotent, separate from all operational collections", async () => {
  const counts = await Promise.all([
    Report.countDocuments(),
    Allocation.countDocuments(),
    Delivery.countDocuments(),
    Tanker.countDocuments(),
  ]);
  await assert.rejects(() =>
    prepareForecastFixture({ ...config, DEMO_SEED_ENABLED: false }),
  );
  assert.equal(await ForecastObservation.countDocuments(), 0);
  const first = await prepareForecastFixture(config);
  assert.equal(first.counts.length, 6);
  assert.ok(first.inserted >= 144);
  const repeated = await prepareForecastFixture(config);
  assert.equal(repeated.inserted, 0);
  const originalRows = await ForecastObservation.find().lean();
  await assert.rejects(
    () => prepareForecastFixture({ ...config, PREDICTION_MIN_REPORTS: 48 }),
    { code: "OPERATION_CONFLICT" },
  );
  assert.deepEqual(await ForecastObservation.find().lean(), originalRows);
  assert.deepEqual(
    await Promise.all([
      Report.countDocuments(),
      Allocation.countDocuments(),
      Delivery.countDocuments(),
      Tanker.countDocuments(),
    ]),
    counts,
  );
  console.info(
    JSON.stringify({
      fixtureCounts: first.counts,
      inserted: first.inserted,
      repeatInserted: repeated.inserted,
    }),
  );
});
test("original faculty-style history remains insufficient; separate synthetic calculation persists all six areas and alerts", async () => {
  await api("post", "/api/predictions/evaluate", {}).expect(200);
  const operational = await Prediction.find({
    inputSource: { $ne: "SYNTHETIC_FORECAST" },
  }).lean();
  assert.ok(
    operational.every((p) => p.result.riskLevel === "INSUFFICIENT_DATA"),
  );
  const result = await api(
    "post",
    "/api/predictions/evaluate?source=SYNTHETIC_FORECAST",
    {},
  ).expect(200);
  assert.equal(result.body.data.providerRequested, false);
  assert.equal(result.body.data.results.length, 6);
  for (const r of result.body.data.results) {
    assert.ok(r.forecast);
    assert.equal(r.quality.coveredWindows, 12);
    assert.ok(r.quality.distinctReporters >= 6);
    assert.equal(r.provenance, "SYNTHETIC_FORECAST_OBSERVATIONS");
    assert.equal(r.currentSeverity, null);
  }
  const count = await Prediction.countDocuments();
  await api(
    "post",
    "/api/predictions/evaluate?source=SYNTHETIC_FORECAST",
    {},
  ).expect(200);
  assert.equal(await Prediction.countDocuments(), count);
  assert.deepEqual(
    await Prediction.find({
      inputSource: { $ne: "SYNTHETIC_FORECAST" },
    }).lean(),
    operational,
  );
  assert.ok(
    (await EarlyWarningAlert.countDocuments({
      inputSource: "SYNTHETIC_FORECAST",
    })) >= 1,
  );
  const ordinary = await api("get", "/api/predictions").expect(200);
  assert.ok(
    ordinary.body.data.results.every((r) => r.inputSource === "REPORT_HISTORY"),
  );
  assert.equal(
    (await api("get", "/api/predictions/alerts")).body.data.alerts.length,
    0,
  );
  const prediction = await Prediction.findOne({
    inputSource: "SYNTHETIC_FORECAST",
    "result.riskLevel": "CRITICAL",
  });
  await api("post", "/api/advisories", {
    ...publish(),
    areaId: prediction.areaId,
    sourceId: prediction.id,
    sourceType: "PREDICTION",
    category: "ACTIVITY_WATCH",
  }).expect(422);
  console.info(
    JSON.stringify({
      numericalResults: result.body.data.results.map((r) => ({
        areaId: r.areaId,
        risk: r.riskScore,
        level: r.riskLevel,
        approximateActivity: r.forecast.estimatedEligibleReportCount,
        sample: r.quality.sampleSize,
        windows: r.quality.coveredWindows,
        reporterKeys: r.quality.distinctReporters,
      })),
      syntheticAlerts: await EarlyWarningAlert.countDocuments({
        inputSource: "SYNTHETIC_FORECAST",
      }),
    }),
  );
});
test("synthetic input cannot be selected without guarded mode and is hidden from operational analytics", async () => {
  const cfg = { ...config, DEMONSTRATION_MODE: false };
  await request(createApp(cfg))
    .post("/api/predictions/evaluate?source=SYNTHETIC_FORECAST")
    .set("Authorization", `Bearer ${token}`)
    .send({})
    .expect(403);
  await request(createApp({ ...config, FORECAST_DEMO_ENABLED: false }))
    .get("/api/predictions?source=SYNTHETIC_FORECAST")
    .set("Authorization", `Bearer ${token}`)
    .expect(403);
  const analytics = await api("get", "/api/dashboard/analytics").expect(200);
  assert.equal(
    JSON.stringify(analytics.body).includes("SYNTHETIC_FORECAST_OBSERVATIONS"),
    false,
  );
  await api("get", "/api/predictions", undefined, citizens[0].token).expect(
    403,
  );
});
test("readiness inspection performs no writes and reports each source honestly", async () => {
  const before = await mongoose.connection.db
    .collection("tankers")
    .find()
    .toArray();
  const predictionCount = await Prediction.countDocuments();
  const reportCount = await Report.countDocuments();
  const result = await demoReadiness(config);
  assert.equal(result.readOnly, true);
  assert.equal(result.areas.length, 6);
  assert.ok(
    result.areas.every(
      (a) =>
        a.syntheticHistory.status === "READY" &&
        a.operationalHistory.status === "INSUFFICIENT_DATA",
    ),
  );
  assert.deepEqual(
    await mongoose.connection.db.collection("tankers").find().toArray(),
    before,
  );
  assert.equal(await Prediction.countDocuments(), predictionCount);
  assert.equal(await Report.countDocuments(), reportCount);
});
test("citizen preference/read state and synthetic predictions survive actual API process restart", async () => {
  await api(
    "put",
    "/api/citizen/alerts/area",
    { areaId: "AREA_01" },
    citizens[0].token,
  ).expect(200);
  const advisory = (
    await api("post", "/api/advisories", publish("restart-proof"))
  ).body.data;
  await api(
    "put",
    `/api/citizen/alerts/${advisory.id}/read`,
    { read: true },
    citizens[0].token,
  ).expect(200);
  for (let i = 0; i < 2; i++) {
    child = fork(new URL("./helpers/runtimeProcess.js", import.meta.url), [], {
      execArgv: [],
      silent: true,
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_URI: config.MONGODB_URI,
        MONGODB_TEST_DB_NAME: dbName,
        DEMONSTRATION_MODE: "true",
        DEMO_SEED_ENABLED: "false",
        FORECAST_DEMO_ENABLED: "true",
        GEMINI_API_KEY: "",
        GEMINI_MODEL_ID: "",
        DEMO_AI_MODE: "false",
      },
    });
    child.stdout.resume();
    child.stderr.resume();
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Runtime deadline")),
        15000,
      );
      child.once("message", (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      child.once("error", () => {
        clearTimeout(timer);
        reject(new Error("Runtime launch failed"));
      });
    });
    const origin = `http://127.0.0.1:${ready.port}`;
    const notices = await request(origin)
      .get("/api/citizen/alerts")
      .set("Authorization", `Bearer ${citizens[0].token}`)
      .expect(200);
    assert.ok(
      notices.body.data.notifications.find((n) => n.id === advisory.id).readAt,
    );
    const predictions = await request(origin)
      .get("/api/predictions?source=SYNTHETIC_FORECAST")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.ok(predictions.body.data.results.every((r) => r.forecast));
    const done = once(child, "exit");
    child.send("stop");
    assert.equal((await done)[0], 0);
    child = undefined;
  }
});

test("legacy prediction and alert documents hydrate without rewriting their missing immutable source", async () => {
  for (const Model of [Prediction, EarlyWarningAlert]) {
    const existing = await Model.findOne().lean();
    assert.ok(existing);
    const id = new mongoose.Types.ObjectId();
    const legacy = {
      ...existing,
      _id: id,
      key: `${existing.key}-legacy-source-regression`,
    };
    delete legacy.inputSource;
    await Model.collection.insertOne(legacy);
    const document = await Model.findById(id);
    await document.validate();
    assert.equal(document.inputSource, undefined);
    const stored = await Model.collection.findOne({ _id: id });
    assert.equal(Object.hasOwn(stored, "inputSource"), false);
    document.inputSource = "SYNTHETIC_FORECAST";
    await assert.rejects(() => document.validate(), /immutable/);
  }
});
