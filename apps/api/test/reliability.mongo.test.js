import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase } from "../src/config/database.js";
import { cleanupTestDatabase } from "./helpers/cleanup.js";
import { createAdmin } from "../src/services/authService.js";
import { createApp } from "../src/app.js";
import { municipalAnalytics } from "../src/services/analyticsService.js";
import { predictionSummary } from "../src/services/predictionService.js";
import { parseAnalyticsQuery } from "../src/validation/analytics.js";
import Report from "../src/models/Report.js";
import ShortageEvent from "../src/models/ShortageEvent.js";
import Allocation from "../src/models/Allocation.js";
import Tanker from "../src/models/Tanker.js";
import Delivery from "../src/models/Delivery.js";

const dbName = `aquashield_reliability_test_${randomUUID().replaceAll("-", "")}`;
const password = randomBytes(24).toString("hex");
let config, child, origin, adminToken;
const api = (method, path, body, token = adminToken) => {
  const client = request(origin);
  return client[method](path)
    .set("Authorization", `Bearer ${token || ""}`)
    .send(body);
};

async function start() {
  child = fork(new URL("./helpers/runtimeProcess.js", import.meta.url), [], {
    execArgv: [],
    silent: true,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "test",
      MONGODB_URI: config.MONGODB_URI,
      MONGODB_TEST_DB_NAME: dbName,
      DEMO_AI_MODE: "false",
      DEMONSTRATION_MODE: "false",
      GEMINI_API_KEY: "",
      GEMINI_MODEL_ID: "",
      ROUTING_BASE_URL: "",
    },
  });
  // Consume but never publish child logs (tokens/credentials aren't diagnostic data).
  child.stdout.resume();
  child.stderr.resume();
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Test runtime did not become ready within 15s."));
    }, 15000);
    const fail = () => {
      cleanup();
      reject(new Error("Test runtime exited before readiness."));
    };
    const message = (value) => {
      if (value.ready) {
        cleanup();
        resolve(value);
      }
    };
    function cleanup() {
      clearTimeout(timer);
      child.off("exit", fail);
      child.off("error", fail);
      child.off("message", message);
    }
    child.on("exit", fail);
    child.on("error", fail);
    child.on("message", message);
  });
  origin = `http://127.0.0.1:${result.port}`;
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const target = child;
  const exited = once(target, "exit");
  const timer = setTimeout(() => target.kill(), 12000);
  try {
    target.send("stop");
    const [code] = await exited;
    assert.equal(code, 0);
  } finally {
    clearTimeout(timer);
    child = undefined;
  }
}
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMONSTRATION_MODE: false,
    DEMO_AI_MODE: false,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
    MONGODB_URI:
      process.env.MONGODB_TEST_URI ||
      "mongodb://127.0.0.1:27017/aquashield_tests",
  };
  await connectDatabase(config, { dbName });
  assert.equal(
    (await mongoose.connection.db.listCollections().toArray()).length,
    0,
  );
  await createAdmin({ email: "admin@reliability.test", password });
});
after(async () => {
  try {
    await stop();
  } finally {
    await cleanupTestDatabase(dbName);
  }
});

test(
  "full HTTP citizen-to-delivery lifecycle survives backend process restart with exact accounting and private ownership",
  { timeout: 90000 },
  async () => {
    await start();
    const login = async (email) =>
      (await api("post", "/api/auth/login", { email, password }).expect(200))
        .body.data.token;
    adminToken = await login("admin@reliability.test");
    const citizens = [],
      reports = [];
    for (let i = 0; i < 3; i++) {
      const email = `citizen-${i}@reliability.test`;
      await api("post", "/api/auth/register", {
        name: `Synthetic citizen ${i}`,
        email,
        password,
      }).expect(201);
      citizens.push(await login(email));
      const payload = {
        submissionId: randomUUID(),
        areaId: "AREA_01",
        locality: "Panchavati",
        location: { lat: 20.011 + i * 0.0001, lng: 73.79 },
        locationSource: "MANUAL",
        problem: "NO_WATER",
        waterLevel: "EMPTY",
        householdSize: 5,
        reportedDurationHours: 24,
        lastSupplyTime: null,
      };
      const saved = await api(
        "post",
        "/api/reports",
        payload,
        citizens[i],
      ).expect(201);
      reports.push(saved.body.data.id);
      const replay = await api(
        "post",
        "/api/reports",
        payload,
        citizens[i],
      ).expect(200);
      assert.equal(replay.body.data.id, reports[i]);
    }
    assert.equal(await Report.countDocuments({ isDemo: false }), 3);
    await api(
      "get",
      `/api/reports/${reports[0]}`,
      undefined,
      citizens[1],
    ).expect(404);
    await api("get", `/api/dashboard/reports/${reports[0]}`).expect(200);
    const event = await ShortageEvent.findOne({
      isDemo: false,
      status: "ACTIVE",
    });
    assert.ok(event);
    assert.equal(event.verifiedReportCount, 0);
    assert.equal(event.reportIds.length, 3);
    const operators = [];
    for (let i = 0; i < 2; i++) {
      const email = `operator-${i}@reliability.test`;
      const result = await api("post", "/api/operations/operators", {
        name: `Synthetic operator ${i}`,
        email,
        password,
      }).expect(200);
      operators.push({
        id: result.body.data.operator.id,
        token: await login(email),
      });
    }
    const tanker = (
      await api("post", "/api/operations/tankers", {
        identifier: "RELIABILITY-T01",
        name: "Synthetic tanker",
        capacityLitres: 10000,
        availableLitres: 8000,
        status: "AVAILABLE",
        currentLocation: { lat: 20, lng: 73.78 },
        observedAt: new Date().toISOString(),
        operatorId: operators[0].id,
      }).expect(200)
    ).body.data.tanker;
    await api("put", `/api/operations/evidence/${event.id}`, {
      demandLitres: 4000,
      recentDeliveredLitres: 0,
      source: "Controlled synthetic demand ledger",
      observedAt: new Date().toISOString(),
    }).expect(200);
    const intent = { eventId: event.id, requestId: randomUUID(), useAi: false };
    const allocation = (
      await api("post", "/api/operations/allocations/recommend", intent).expect(
        200,
      )
    ).body.data.allocation;
    const path = `/api/operations/allocations/${allocation.id}`;
    assert.equal(
      (
        await api(
          "post",
          "/api/operations/allocations/recommend",
          intent,
        ).expect(200)
      ).body.data.allocation.id,
      allocation.id,
    );
    await api("post", `${path}/assign`, {}).expect(409);
    await api("post", `${path}/approve`, {}, citizens[0]).expect(403);
    await api("post", `${path}/approve`, {}).expect(200);
    const assigned = await Promise.all([
      api("post", `${path}/assign`, {}),
      api("post", `${path}/assign`, {}),
    ]);
    assert.ok(assigned.some((r) => r.status === 200));
    assert.ok(assigned.every((r) => [200, 409].includes(r.status)));
    assert.equal(
      (await Allocation.findById(allocation.id)).audit.filter(
        (a) => a.action === "TANKER_ASSIGNED",
      ).length,
      1,
    );
    await api(
      "get",
      `/api/operator/assignments/${allocation.id}`,
      undefined,
      operators[1].token,
    ).expect(404);
    await api(
      "get",
      `/api/operator/assignments/${allocation.id}`,
      undefined,
      operators[0].token,
    ).expect(200);
    let delivery = await Delivery.findOne({ allocationId: allocation.id });
    const trip = `/api/deliveries/${delivery.id}`;
    const act = (suffix, body = {}) =>
      api("post", `${trip}/${suffix}`, body, operators[0].token);
    await act("arrive").expect(409);
    await act("complete", { litresDelivered: 3000 }).expect(409);
    const starts = await Promise.all([act("start"), act("start")]);
    assert.deepEqual(starts.map((r) => r.status).sort(), [200, 409]);
    await stop();
    await start(); // Actual new Node process, same isolated MongoDB.
    await api("get", "/api/health/ready").expect(200);
    assert.equal(
      (await api("get", trip, undefined, operators[0].token).expect(200)).body
        .data.delivery.status,
      "EN_ROUTE",
    );
    await act("arrive").expect(200);
    const codeReply = await api(
      "post",
      `/api/reports/${reports[0]}/delivery-otp`,
      {},
      citizens[0],
    ).expect(200);
    const code = codeReply.body.data.recipientOtp;
    assert.match(code, /^\d{6}$/);
    const wrong = String((Number(code) + 1) % 1000000).padStart(6, "0");
    await act("verify", { code: wrong }).expect(422);
    const verified = await Promise.all([
      act("verify", { code }),
      act("verify", { code }),
    ]);
    assert.deepEqual(verified.map((r) => r.status).sort(), [200, 409]);
    await act("complete", { litresDelivered: 4001 }).expect(422);
    const completed = await Promise.all([
      act("complete", { litresDelivered: 3000 }),
      act("complete", { litresDelivered: 3000 }),
    ]);
    assert.deepEqual(completed.map((r) => r.status).sort(), [200, 409]);
    await stop();
    await start();
    await act("complete", { litresDelivered: 3000 }).expect(409);
    delivery = await Delivery.findById(delivery.id);
    assert.equal(delivery.status, "DELIVERED");
    assert.equal(delivery.syncPending, false);
    assert.equal(delivery.litresDelivered, 3000);
    assert.equal(
      delivery.audit.filter((a) => a.action === "DELIVERY_COMPLETED").length,
      1,
    );
    assert.equal(
      (await Allocation.findById(allocation.id)).status,
      "COMPLETED",
    );
    assert.equal((await Tanker.findById(tanker.id)).availableLitres, 5000);
    const citizenView = (
      await api(
        "get",
        `/api/reports/${reports[0]}`,
        undefined,
        citizens[0],
      ).expect(200)
    ).body.data;
    assert.equal(citizenView.responseStatus.status, "DELIVERED");
    assert.equal(JSON.stringify(citizenView).includes(operators[0].id), false);
    const metrics = (await api("get", "/api/dashboard/analytics").expect(200))
      .body.data;
    assert.equal(metrics.deliveries.litres, 3000);
    assert.equal(metrics.deliveries.completed, 1);
    const history = (
      await api(
        "get",
        `/api/audit?targetType=DELIVERY&targetId=${delivery.id}&eventType=DELIVERY_COMPLETED`,
      ).expect(200)
    ).body.data;
    assert.equal(history.events.length, 1);
    assert.equal(history.events[0].actorRole, "OPERATOR");
    assert.ok(history.events[0].correlationId);
    await stop();
  },
);

test(
  "analytics capacity preserves exact counts for 5001 synthetic reports; prediction retrieval has no per-area query loop",
  { timeout: 30000 },
  async (t) => {
    const now = new Date(),
      from = new Date(+now - 3600000);
    // A separate provenance avoids touching the lifecycle fixture. Raw insertion
    // models legacy/imported history without triggering expensive report detection.
    await Report.collection.insertMany(
      Array.from({ length: 5001 }, (_, i) => ({
        submissionId: `bounded-${i}`,
        isDemo: true,
        areaId: i % 2 ? "AREA_01" : "AREA_02",
        createdAt: new Date(+from + 1000),
        verificationStatus: "PENDING",
        audit: [],
      })),
    );
    await Report.createIndexes();
    let summaryQueries = 0;
    mongoose.set("debug", (collection, method) => {
      if (
        collection === "predictions" &&
        ["aggregate", "findOne", "find"].includes(method)
      )
        summaryQueries++;
    });
    const started = performance.now();
    try {
      const data = await municipalAnalytics(
        config,
        true,
        parseAnalyticsQuery({
          from: from.toISOString(),
          to: now.toISOString(),
        }),
        now,
      );
      assert.equal(data.reports.total, 5001);
      assert.equal(data.reports.timings.status, "CAPACITY_EXCEEDED");
      assert.equal(data.reports.timings.reportToDelivery, null);
      assert.equal(
        data.reports.byDay.reduce((n, r) => n + r.count, 0),
        5001,
      );
      assert.equal(summaryQueries, 1);
      summaryQueries = 0;
      await predictionSummary(config, true, now);
      assert.equal(summaryQueries, 1);
      t.diagnostic(
        `bounded fixture: 5001 reports, two areas; analytics plus prediction summary ${Math.round(performance.now() - started)}ms; one prediction query per summary`,
      );
    } finally {
      mongoose.set("debug", false);
    }
  },
);

test("analytics and audit rate limits remain independent, bounded and preserve authenticated reads", async () => {
  const app = createApp(config);
  for (const [path, count] of [
    ["/api/dashboard/analytics", 30],
    ["/api/audit", 60],
  ]) {
    // Invalid filters exercise the same authenticated limiter without repeatedly
    // aggregating history. Production limits are not changed for the test.
    for (let i = 0; i < count; i++)
      await request(app)
        .get(`${path}?unexpected=true`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(422);
    const limited = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(429);
    assert.ok(Number(limited.headers["retry-after"]) > 0);
    assert.equal(limited.body.code, "RATE_LIMITED");
  }
  await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
});
