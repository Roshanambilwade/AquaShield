import { cleanupTestDatabase } from "./helpers/cleanup.js";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import {
  createAdmin,
  createOperator,
  loginAdmin,
} from "../src/services/authService.js";
import { citizenSession } from "./helpers/citizen.js";
import Report, { initializeReportStorage } from "../src/models/Report.js";
import Prediction from "../src/models/Prediction.js";
import EarlyWarningAlert from "../src/models/EarlyWarningAlert.js";
import {
  evaluatePredictions,
  predictionSummary,
  reconcileAlert,
  transitionAlert,
} from "../src/services/predictionService.js";
import { activityReports } from "./helpers/predictions.js";
import { observationEnd } from "../src/services/predictionEngine.js";
import { ApiError } from "../src/middleware/errors.js";
const dbName = `aquashield_phase8_test_${randomUUID().replaceAll("-", "")}`;
const password = randomBytes(24).toString("hex");
let config,
  app,
  admin,
  token,
  citizen,
  operator,
  providerCalls = 0;
const api = (method, path, body, auth = token) =>
  request(app)[method](path).set("Authorization", `Bearer ${auth}`).send(body);
const id = (v) => createHash("sha256").update(v).digest("hex").slice(0, 24);
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMONSTRATION_MODE: false,
    DEMO_SEED_ENABLED: false,
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
  };
  config.MONGODB_URI = process.env.MONGODB_TEST_URI || config.MONGODB_URI;
  await connectDatabase(config, { dbName });
  admin = await createAdmin({ email: "admin@phase8.test", password });
  token = (await loginAdmin(admin.email, password, config)).token;
  citizen = await citizenSession(config);
  const op = await createOperator({
    email: "op@phase8.test",
    name: "Synthetic operator",
    password,
  });
  operator = await loginAdmin(op.email, password, config, ["OPERATOR"]);
  app = createApp(config, {
    aiDependencies: {
      invoke: async () => {
        providerCalls++;
        throw new Error("Synthetic provider outage");
      },
    },
  });
  await initializeReportStorage();
  for (const [areaId, counts, isDemo, key] of [
    ["AREA_01", undefined, false, "rising"],
    ["AREA_02", Array(12).fill(3), false, "flat"],
    ["AREA_01", Array(12).fill(3), true, "demo"],
  ]) {
    const rows = activityReports({
      now: observationEnd(new Date(), config),
      areaId,
      counts,
      isDemo,
      key,
      location: areaId === "AREA_02" ? { lat: 20.005, lng: 73.735 } : undefined,
    }).map((r) => ({
      ...r,
      _id: id(r._id),
      submissionId: randomUUID(),
      ownerId: citizen.user.id,
      locality: areaId === "AREA_02" ? "Satpur" : "Panchavati",
      problem: "NO_WATER",
      locationSource: "LOCALITY_CENTER",
      waterLevel: "LESS_THAN_25",
      householdSize: 4,
      sourceType: isDemo ? "DEMO_SEED" : "CITIZEN_SUBMISSION",
    }));
    await Report.insertMany(rows);
  }
});
after(() => cleanupTestDatabase(dbName));
test("all numerical routes enforce ADMIN authorization for anonymous/citizen/operator", async () => {
  for (const [method, path, body] of [
    ["get", "/api/predictions"],
    ["get", "/api/predictions/alerts"],
    ["get", "/api/predictions/areas/AREA_01/history"],
    ["post", "/api/predictions/evaluate", {}],
    ["post", "/api/predictions/backtest", { areaId: "AREA_01" }],
    [
      "post",
      `/api/predictions/alerts/${"a".repeat(24)}/acknowledge`,
      { revision: 1 },
    ],
  ]) {
    await request(app)[method](path).send(body).expect(401);
    await api(method, path, body, citizen.token).expect(403);
    await api(method, path, body, operator.token).expect(403);
  }
});
test("offline evaluation persists supported numerical predictions and unique alerts with zero provider calls", async () => {
  const result = await api("post", "/api/predictions/evaluate", {
    areaIds: ["AREA_01", "AREA_02", "AREA_03"],
  }).expect(200);
  assert.equal(result.body.data.providerRequested, false);
  assert.equal(providerCalls, 0);
  const [rising, flat, sparse] = result.body.data.results;
  assert.equal(rising.riskLevel, "CRITICAL");
  assert.equal(flat.riskLevel, "LOW");
  assert.equal(sparse.riskLevel, "INSUFFICIENT_DATA");
  assert.equal(await Prediction.countDocuments({ isDemo: false }), 3);
  assert.equal(await EarlyWarningAlert.countDocuments({ isDemo: false }), 1);
  const summary = await api("get", "/api/predictions").expect(200);
  assert.equal(summary.body.data.highRiskAreas, 1);
  const text = JSON.stringify(summary.body);
  for (const secret of [
    "reporterKeyHash",
    "ownerId",
    "description",
    "password",
    "mongodb://",
    "GEMINI_API_KEY",
  ])
    assert.equal(text.includes(secret), false);
  const event = await EarlyWarningAlert.findOne({ isDemo: false });
  assert.equal(event.audit[0].type, "CREATED");
  assert.equal(String(event.audit[0].actorId), String(admin._id));
  await disconnectDatabase();
  await connectDatabase(config, { dbName });
  assert.equal(await EarlyWarningAlert.countDocuments({ isDemo: false }), 1);
});
test("repeat and concurrent evaluation preserve unique snapshots/alerts and unchanged audit", async () => {
  const old = await EarlyWarningAlert.findOne({ isDemo: false });
  const now = new Date();
  await Promise.all([
    evaluatePredictions(config, false, admin._id, ["AREA_01"], now),
    evaluatePredictions(config, false, admin._id, ["AREA_01"], now),
  ]);
  assert.equal(await EarlyWarningAlert.countDocuments({ isDemo: false }), 1);
  const updated = await EarlyWarningAlert.findById(old._id);
  assert.equal(updated.audit.length, old.audit.length);
  assert.equal(
    await Prediction.countDocuments({ areaId: "AREA_01", isDemo: false }),
    1,
  );
  await assert.rejects(
    () =>
      EarlyWarningAlert.create({
        ...old.toObject(),
        _id: new mongoose.Types.ObjectId(),
      }),
    (e) => e.code === 11000,
  );
});
test("audited acknowledge/resolve use optimistic revisions and cannot mutate scores or operations", async () => {
  let a = await EarlyWarningAlert.findOne({ isDemo: false });
  await api("post", `/api/predictions/alerts/${a.id}/resolve`, {
    revision: a.revision,
    note: "premature",
  }).expect(409);
  const responses = await Promise.all([
    api("post", `/api/predictions/alerts/${a.id}/acknowledge`, {
      revision: a.revision,
    }),
    api("post", `/api/predictions/alerts/${a.id}/acknowledge`, {
      revision: a.revision,
    }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  a = await EarlyWarningAlert.findById(a._id);
  assert.equal(a.status, "ACKNOWLEDGED");
  assert.equal(a.audit.at(-1).type, "ACKNOWLEDGED");
  await api("post", `/api/predictions/alerts/${a.id}/resolve`, {
    revision: a.revision,
  }).expect(422);
  await api("post", `/api/predictions/alerts/${a.id}/resolve`, {
    revision: a.revision,
    note: "Review recorded; requires continued field verification.",
  }).expect(200);
  a = await EarlyWarningAlert.findById(a._id);
  assert.equal(a.status, "RESOLVED");
  assert.equal(a.result.riskScore, 85);
  assert.equal(
    a.audit.at(-1).note,
    "Review recorded; requires continued field verification.",
  );
});
test("risk changes escalate/de-escalate; insufficient data is never a recovery claim; resolution reopens on new urgent evidence", async () => {
  let a = await EarlyWarningAlert.findOne({ isDemo: false });
  const now = new Date();
  await reconcileAlert(
    {
      ...a.result,
      generatedAt: now.toISOString(),
      riskScore: 80,
      riskLevel: "CRITICAL",
    },
    "new-condition",
    admin._id,
    now,
  );
  a = await EarlyWarningAlert.findById(a._id);
  assert.equal(a.status, "ACTIVE");
  assert.equal(a.cycle, 2);
  assert.equal(a.audit.at(-1).type, "REOPENED");
  await transitionAlert(a.id, false, "acknowledge", a.revision, admin._id, "");
  await reconcileAlert(
    {
      ...a.result,
      generatedAt: new Date(+now + 1).toISOString(),
      riskScore: 55,
      riskLevel: "HIGH",
    },
    "lower",
    admin._id,
    new Date(+now + 1),
  );
  a = await EarlyWarningAlert.findById(a._id);
  assert.equal(a.status, "ACKNOWLEDGED");
  assert.equal(a.audit.at(-1).type, "DEESCALATED");
  await reconcileAlert(
    {
      ...a.result,
      generatedAt: new Date(+now + 2).toISOString(),
      riskScore: 90,
      riskLevel: "CRITICAL",
    },
    "higher",
    admin._id,
    new Date(+now + 2),
  );
  a = await EarlyWarningAlert.findById(a._id);
  assert.equal(a.status, "ACTIVE");
  assert.equal(a.acknowledgedAt, null);
  assert.equal(a.audit.at(-1).type, "ESCALATED");
  await reconcileAlert(
    {
      ...a.result,
      generatedAt: new Date(+now + 3).toISOString(),
      riskScore: null,
      riskLevel: "INSUFFICIENT_DATA",
      forecast: null,
    },
    "missing",
    admin._id,
    new Date(+now + 3),
  );
  a = await EarlyWarningAlert.findById(a._id);
  assert.equal(a.status, "ACTIVE");
  assert.equal(a.audit.at(-1).type, "DATA_UNAVAILABLE");
});
test("provenance isolation, history pagination, strict filters and bounded horizons", async () => {
  app = createApp(config);
  await api("post", "/api/predictions/evaluate?demo=true", {
    areaIds: ["AREA_01"],
  }).expect(200);
  const demo = await api("get", "/api/predictions?demo=true").expect(200);
  assert.equal(demo.body.data.results[0].riskLevel, "LOW");
  assert.equal(demo.body.data.results[0].isDemo, true);
  await api("get", "/api/predictions/alerts?limit=1").expect(200);
  const history = await api(
    "get",
    "/api/predictions/areas/AREA_01/history?limit=1",
  ).expect(200);
  assert.equal(history.body.data.results.length, 1);
  const paths = [
    "/api/predictions?isDemo=true",
    "/api/predictions?demo=maybe",
    "/api/predictions/alerts?limit=999",
    "/api/predictions/alerts?page=0",
    "/api/predictions/alerts?status=APPROVED",
    "/api/predictions/areas/%24where/history",
  ];
  for (const path of paths) await api("get", path).expect(422);
  for (const body of [
    { horizonHours: 24 },
    { areaIds: ["UNKNOWN"] },
    { areaIds: ["AREA_01", "AREA_01"] },
    { riskScore: 99 },
    { now: "2026-01-01" },
  ])
    await api("post", "/api/predictions/evaluate", body).expect(422);
  const other = await EarlyWarningAlert.findOne({ isDemo: false });
  await api("get", `/api/predictions/alerts/${other.id}?demo=true`).expect(404);
  const backtest = await api("post", "/api/predictions/backtest", {
    areaId: "AREA_01",
  }).expect(200);
  assert.equal(
    backtest.body.data.validationStatus,
    "INSUFFICIENT_VALIDATION_DATA",
  );
  assert.equal(backtest.body.data.meanAbsoluteError, null);
});
test("retrieval marks expired/config-changed results and does not count them as current high risk", async () => {
  const summary = await predictionSummary(
    config,
    false,
    new Date(Date.now() + 24 * 3600000),
  );
  assert.equal(summary.results[0].retrievalStatus, "STALE");
  assert.equal(summary.highRiskAreas, 0);
  const changed = await predictionSummary(
    { ...config, PREDICTION_MIN_REPORTS: 30 },
    false,
  );
  assert.equal(changed.results[0].retrievalStatus, "CONFIG_CHANGED");
  assert.equal(changed.highRiskAreas, 0);
});
test("numerical endpoints remain available without provider and rate-limit expensive evaluation", async () => {
  const isolated = createApp(config, {
    aiDependencies: {
      invoke: async () => {
        throw new Error("Outage");
      },
    },
  });
  for (let i = 0; i < 10; i++)
    await request(isolated)
      .post("/api/predictions/evaluate")
      .set("Authorization", `Bearer ${token}`)
      .send({ areaIds: ["AREA_03"] })
      .expect(200);
  await request(isolated)
    .post("/api/predictions/evaluate")
    .set("Authorization", `Bearer ${token}`)
    .send({})
    .expect(429);
  await request(isolated)
    .get("/api/predictions")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(providerCalls, 0);
});
test("actual protected Early Warning API falls back on a mocked provider outage while numerical retrieval/persistence succeeds", async () => {
  const outage = createApp(
    {
      ...config,
      GEMINI_API_KEY: "synthetic-mock-key",
      GEMINI_MODEL_ID: "synthetic-mock-model",
      AI_MAX_RETRIES: 0,
    },
    {
      aiDependencies: {
        invoke: async () => {
          throw new ApiError(
            503,
            "AI_PROVIDER_UNAVAILABLE",
            "Synthetic provider outage.",
          );
        },
      },
    },
  );
  const explanation = await request(outage)
    .post("/api/ai/predict")
    .set("Authorization", `Bearer ${token}`)
    .send({})
    .expect(200);
  assert.equal(explanation.body.data.execution.method, "RULE_BASED");
  assert.equal(explanation.body.data.execution.providerAttempted, true);
  assert.equal(explanation.body.data.execution.aiAnalysisCompleted, false);
  assert.equal(explanation.body.data.facts.risk.riskScore, 85);
  await request(outage)
    .post("/api/predictions/evaluate")
    .set("Authorization", `Bearer ${token}`)
    .send({ areaIds: ["AREA_01"] })
    .expect(200);
  const numerical = await request(outage)
    .get("/api/predictions/areas/AREA_01")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(numerical.body.data.riskScore, 85);
  assert.equal(numerical.body.data.retrievalStatus, "CURRENT");
  assert.ok(
    (await Prediction.countDocuments({ isDemo: false, areaId: "AREA_01" })) >=
      1,
  );
});
