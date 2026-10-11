import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
import request from "supertest";
import mongoose from "mongoose";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import {
  prepareSimulation,
  createSimulationService,
} from "../src/services/simulationService.js";
import { simulationAccounts } from "../src/simulation/scenario.js";
import { cleanupTestDatabase } from "./helpers/cleanup.js";
import SimulationRun from "../src/models/SimulationRun.js";
import Report from "../src/models/Report.js";
import Tanker from "../src/models/Tanker.js";
import User from "../src/models/User.js";
import Allocation from "../src/models/Allocation.js";
import Delivery from "../src/models/Delivery.js";
import ForecastObservation from "../src/models/ForecastObservation.js";
import Prediction from "../src/models/Prediction.js";
const dbName = `aquashield_simulation_test_${randomUUID().replaceAll("-", "")}`;
const passwords = Object.fromEntries(
  simulationAccounts.map((a) => [a.key, randomBytes(24).toString("hex")]),
);
let config, app, admin, token, opToken, citizenToken;
const api = (method, path, body, auth = token) => {
  const client = request(app);
  return client[method](`/api${path}`)
    .set("Authorization", `Bearer ${auth || ""}`)
    .send(body);
};
before(async () => {
  const base = loadEnv();
  config = {
    ...base,
    NODE_ENV: "test",
    SIMULATION_ENABLED: true,
    SIMULATION_PREPARE_ENABLED: true,
    SIMULATION_DATABASE_NAME: dbName,
    MONGODB_TEST_DB_NAME: dbName,
    MONGODB_URI: base.MONGODB_URI.replace(
      /(mongodb(?:\+srv)?:\/\/[^/]+\/)[^?]*/,
      `$1${dbName}`,
    ),
    DEMONSTRATION_MODE: true,
    DEMO_AI_MODE: true,
    FORECAST_DEMO_ENABLED: true,
    SIMULATION_TICK_INTERVAL_MS: 5000,
    GEMINI_API_KEY: "",
    ROUTING_BASE_URL: "",
  };
  await connectDatabase(config);
  await prepareSimulation(config, passwords);
  app = createApp(config);
  const signIn = async (key) =>
    (
      await api("post", "/auth/login", {
        email: simulationAccounts.find((a) => a.key === key).email,
        password: passwords[key],
      })
    ).body.data;
  const session = await signIn("admin");
  admin = { id: session.user.id, role: "ADMIN" };
  token = session.token;
  opToken = (await signIn("operator-1")).token;
  citizenToken = (await signIn("citizen-1")).token;
});
after(async () => {
  if (app) await app.locals.simulation.close();
  await cleanupTestDatabase(dbName);
});
test("preparation is insert-only and accounts/fleet are explicitly simulation sourced", async () => {
  const before = await Tanker.find().lean();
  const users = await User.find().lean();
  assert.equal(users.length, 75);
  assert.ok(
    users.every(
      (u) => u.isDemo && u.simulation?.source === "DYNAMIC_SIMULATION",
    ),
  );
  await prepareSimulation(config, passwords);
  assert.deepEqual(await Tanker.find().lean(), before);
  assert.equal(await User.countDocuments(), 75);
  assert.equal(await Report.countDocuments(), 0);
  await assert.rejects(
    () =>
      prepareSimulation(
        { ...config, SIMULATION_DATABASE_NAME: "aquashield_demo" },
        passwords,
      ),
    (e) => e.code === "UNSAFE_SIMULATION_TARGET",
  );
});
test("simulation API enforces roles and disabled mode without losing sessions", async () => {
  assert.equal((await api("get", "/simulation", undefined, "")).status, 401);
  for (const auth of [citizenToken, opToken]) {
    assert.equal(
      (await api("get", "/simulation", undefined, auth)).status,
      403,
    );
    assert.equal(
      (await api("post", "/simulation/command", { action: "start" }, auth))
        .status,
      403,
    );
  }
  const disabled = createApp({ ...config, SIMULATION_ENABLED: false });
  assert.equal(
    (
      await request(disabled)
        .get("/api/simulation")
        .set("Authorization", `Bearer ${token}`)
    ).body.code,
    "SIMULATION_DISABLED",
  );
  assert.equal(
    (await api("get", "/auth/me", undefined, citizenToken)).status,
    200,
  );
});
test("a failed tick retains partial records, rejects overlap and retries idempotently", async () => {
  await api("get", "/simulation");
  let release, entered;
  const waiting = new Promise((r) => {
    entered = r;
  });
  const barrier = new Promise((r) => {
    release = r;
  });
  const service = createSimulationService(config, {
    afterReports: async () => {
      entered();
      await barrier;
      throw new Error("synthetic failure");
    },
  });
  await service.initialize();
  const running = service.command({ action: "step", tick: 1 }, admin);
  await waiting;
  await assert.rejects(
    () => service.command({ action: "step", tick: 1 }, admin),
    (e) => e.code === "SIMULATION_CONFLICT",
  );
  release();
  await assert.rejects(
    () => running,
    (e) => e.code === "SIMULATION_TICK_FAILED",
  );
  assert.equal((await SimulationRun.findById("municipal-v1")).status, "FAILED");
  assert.equal(await Report.countDocuments(), 3);
  const recovered = await api("post", "/simulation/command", {
    action: "step",
    tick: 1,
  });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.data.run.tick, 1);
  const rows = await Report.find().lean();
  const run = await SimulationRun.findById("municipal-v1").lean();
  const retry = await api("post", "/simulation/command", {
    action: "step",
    tick: 1,
  });
  assert.equal(retry.status, 200);
  assert.deepEqual(await Report.find().lean(), rows);
  assert.deepEqual(await SimulationRun.findById("municipal-v1").lean(), run);
  assert.ok(
    rows.every(
      (r) =>
        r.verificationStatus === "PENDING" &&
        r.audit.length === 1 &&
        r.simulation.tick === 1 &&
        r.createdAt > r.simulation.eventAt,
    ),
  );
  await service.close();
});
test("step progression uses authoritative assessments; forecast remains source-separated", async () => {
  for (let tick = 2; tick <= 6; tick++) {
    const r = await api("post", "/simulation/command", {
      action: "step",
      tick,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const data = (await api("get", "/simulation")).body.data;
  assert.equal(await Report.countDocuments(), 18);
  assert.ok(data.events.length >= 2);
  assert.ok(
    data.events.every(
      (e) =>
        e.verifiedReportCount === 0 &&
        e.confidenceScore >= 0 &&
        e.confidenceScore <= 100,
    ),
  );
  assert.ok(
    data.events.every((e) => e.simulation?.source === "DYNAMIC_SIMULATION"),
  );
  assert.ok(
    data.predictions.results.every(
      (p) => p.inputSource === "SYNTHETIC_FORECAST" && p.forecast,
    ),
  );
  assert.ok((await ForecastObservation.countDocuments()) > 0);
  assert.ok((await Prediction.countDocuments()) > 0);
  assert.equal(await Allocation.countDocuments(), 0);
  assert.equal(await Delivery.countDocuments(), 0);
  const ordinary = await api("post", "/predictions/evaluate", {
    areaIds: ["AREA_01"],
  });
  assert.equal(ordinary.status, 200);
  assert.equal(ordinary.body.data.results[0].riskLevel, "INSUFFICIENT_DATA");
});
test("start/resume scheduling is bounded; restart pauses and persists state", async () => {
  assert.equal(
    (await api("post", "/simulation/command", { action: "resume" })).status,
    200,
  );
  assert.equal(
    (await api("post", "/simulation/command", { action: "start" })).status,
    409,
  );
  assert.equal(
    (await api("post", "/simulation/command", { action: "speed", speed: 4 }))
      .status,
    422,
  );
  assert.equal(
    (await api("post", "/simulation/command", { action: "speed", speed: 1 }))
      .status,
    200,
  );
  assert.equal(
    (await api("post", "/simulation/command", { action: "pause" })).body.data
      .run.status,
    "PAUSED",
  );
  assert.equal(
    (await api("post", "/simulation/command", { action: "resume" })).status,
    200,
  );
  await app.locals.simulation.close();
  const child = fork(
    new URL("./helpers/simulationRuntime.js", import.meta.url),
    [],
    {
      execArgv: [],
      silent: true,
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: "test",
        SIMULATION_ENABLED: "true",
        SIMULATION_PREPARE_ENABLED: "false",
        SIMULATION_DATABASE_NAME: dbName,
        MONGODB_URI: config.MONGODB_URI,
        MONGODB_TEST_DB_NAME: dbName,
        DEMONSTRATION_MODE: "true",
        DEMO_AI_MODE: "true",
        FORECAST_DEMO_ENABLED: "true",
        GEMINI_API_KEY: "",
        GEMINI_MODEL_ID: "",
      },
    },
  );
  child.stdout.resume();
  child.stderr.resume();
  try {
    const ready = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Restart readiness deadline")),
        15000,
      );
      child.once("message", (m) => {
        clearTimeout(timeout);
        resolve(m);
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("Restart failed"));
      });
    });
    const response = await fetch(
      `http://127.0.0.1:${ready.port}/api/simulation`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(response.status, 200);
    const restarted = (await response.json()).data;
    assert.equal(restarted.run.status, "PAUSED");
    assert.equal(restarted.run.tick, 6);
    const exited = once(child, "exit");
    child.send("stop");
    assert.equal((await exited)[0], 0);
  } finally {
    if (child.exitCode === null) child.kill();
  }
  app = createApp(config);
  const data = (await api("get", "/simulation")).body.data;
  assert.equal(data.run.status, "PAUSED");
  assert.equal(data.run.tick, 6);
  assert.equal(data.run.errorCode, "RESTART_PAUSED");
  await new Promise((r) => setTimeout(r, 5200));
  assert.equal((await api("get", "/simulation")).body.data.run.tick, 6);
});
test("scheduled progression pauses without an overlapping or trailing tick", async () => {
  await api("post", "/simulation/command", { action: "resume" });
  const deadline = Date.now() + 12000;
  while (
    (await SimulationRun.findById("municipal-v1").lean()).tick === 6 &&
    Date.now() < deadline
  )
    await new Promise((r) => setTimeout(r, 250));
  const paused = await api("post", "/simulation/command", { action: "pause" });
  assert.equal(paused.body.data.run.tick, 7);
  assert.equal(paused.body.data.run.status, "PAUSED");
  await new Promise((r) => setTimeout(r, 5200));
  assert.equal(await Report.countDocuments(), 21);
  const run = await SimulationRun.findById("municipal-v1").lean();
  assert.equal(
    run.audit.filter(
      (a) => a.action === "SIMULATION_TICK_COMPLETED" && a.tick === 7,
    ).length,
    1,
  );
});
test("scenario stops at its record/tick limit; terminal controls are non-destructive", async () => {
  assert.equal(
    (await api("post", "/simulation/command", { action: "step", tick: 9 }))
      .status,
    409,
  );
  for (let tick = 8; tick <= 24; tick++)
    assert.equal(
      (await api("post", "/simulation/command", { action: "step", tick }))
        .status,
      200,
    );
  const count = await Report.countDocuments();
  assert.equal(count, 72);
  assert.equal(
    (await api("get", "/simulation")).body.data.run.status,
    "STOPPED",
  );
  for (const body of [
    { action: "resume" },
    { action: "step", tick: 25 },
    { action: "reset" },
  ])
    assert.ok((await api("post", "/simulation/command", body)).status >= 400);
  assert.equal(await Report.countDocuments(), count);
  // A committed retry remains a read-only success, including after Stop.
  assert.equal(
    (await api("post", "/simulation/command", { action: "step", tick: 24 }))
      .status,
    200,
  );
  assert.equal(await Report.countDocuments(), count);
  const content = await SimulationRun.findById("municipal-v1").lean();
  assert.ok(
    content.audit.some(
      (a) =>
        a.action === "SIMULATION_TICK_COMPLETED" &&
        a.tick === 24 &&
        String(a.actorId) === admin.id,
    ),
  );
});
test("control-history exhaustion stops safely instead of leaving an uncontrollable scheduler", async () => {
  // Prepare the boundary in this owned UUID fixture without 249 HTTP actions.
  await SimulationRun.updateOne(
    { _id: "municipal-v1" },
    { $set: { status: "PAUSED", commandCount: 249 } },
  );
  const count = await Report.countDocuments();
  const result = await api("post", "/simulation/command", {
    action: "speed",
    speed: 3,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.run.status, "STOPPED");
  assert.equal(result.body.data.run.commandCount, 250);
  assert.equal(result.body.data.run.errorCode, "SIMULATION_LIMIT");
  assert.equal(
    (await api("post", "/simulation/command", { action: "resume" })).status,
    409,
  );
  assert.equal(await Report.countDocuments(), count);
});
test("connection refuses an isolated namespace containing unmarked data before simulation writes", async () => {
  await mongoose.connection.db
    .collection("unsafe_sentinel")
    .insertOne({ preserve: true });
  await mongoose.disconnect();
  await assert.rejects(
    () => connectDatabase(config),
    /Unsafe simulation database contents/,
  );
  // This explicit reconnect is solely for guarded cleanup of this UUID database.
  // It never launches the application or simulator against the sentinel.
  assert.match(dbName, /^aquashield_simulation_test_[a-f0-9]{32}$/);
  await mongoose.connect(config.MONGODB_URI, {
    dbName,
    serverSelectionTimeoutMS: 5000,
  });
  assert.equal(
    await mongoose.connection.db
      .collection("unsafe_sentinel")
      .countDocuments({ preserve: true }),
    1,
  );
});
