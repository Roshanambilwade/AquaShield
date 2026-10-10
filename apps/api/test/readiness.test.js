import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import request from "supertest";
import { parseEnv } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { runtimeLog, startRuntime } from "../src/runtime.js";
import { validateBuildEnv } from "../../web/scripts/buildEnv.js";

const production = {
  NODE_ENV: "production",
  CORS_ORIGIN: "https://frontend.example",
  MONGODB_URI: "mongodb+srv://fixture:fixture@db.example/aquashield",
};

test("production is explicit, authenticated, TLS-only and independent of Gemini credentials", () => {
  const config = parseEnv(production);
  assert.equal(config.GEMINI_API_KEY, "");
  assert.equal(config.DEMO_AI_MODE, false);
  assert.throws(
    () =>
      parseEnv({ NODE_ENV: "production", CORS_ORIGIN: production.CORS_ORIGIN }),
    /MONGODB_URI/,
  );
  assert.throws(
    () => parseEnv({ ...production, CORS_ORIGIN: "http://frontend.example" }),
    /CORS_ORIGIN/,
  );
  for (const field of [
    "DEMONSTRATION_MODE",
    "DEMO_AI_MODE",
    "DEMO_SEED_ENABLED",
  ])
    assert.throws(
      () => parseEnv({ ...production, [field]: "true" }),
      new RegExp(field),
    );
  assert.throws(
    () =>
      parseEnv({
        ...production,
        MONGODB_TEST_DB_NAME: `aquashield_test_${"a".repeat(32)}`,
      }),
    /MONGODB_TEST_DB_NAME/,
  );
  assert.throws(
    () => parseEnv({ ...production, AI_PROVIDER: "bedrock" }),
    /AI_PROVIDER/,
  );
});

test("production refuses unauthenticated, ambiguous, test/demo and insecure Mongo targets without leaking credentials", () => {
  for (const uri of [
    "mongodb://fixture:fixture@db.example/aquashield",
    "mongodb+srv://db.example/aquashield",
    "mongodb+srv://fixture:fixture@db.example/",
    "mongodb+srv://fixture:fixture@db.example/aquashield_demo",
    "mongodb+srv://fixture:fixture@db.example/aquashield_test_abc",
    "mongodb+srv://fixture:fixture@db.example/admin",
    "mongodb+srv://fixture:fixture@db.example/aquashield?tls=false",
    "mongodb+srv://fixture:fixture@db.example/aquashield?tlsAllowInvalidCertificates=true",
    "mongodb+srv://fixture:fixture@db.example/aquashield?tlsAllowInvalidHostnames=true",
    "mongodb+srv://fixture:fixture@db.example/aquashield?tlsInsecure=true",
    "mongodb+srv://fixture:fixture@db.example/aquashield?TLS=false",
    "mongodb+srv://fixture:fixture@db.example/aquashield?tls=true&tls=false",
    "mongodb+srv://fixture:fixture@db.example/aquashield?tlsallowinvalidcertificates=true",
  ])
    assert.throws(
      () => parseEnv({ ...production, MONGODB_URI: uri }),
      (error) =>
        error.message.includes("MONGODB_URI") &&
        !error.message.includes("fixture"),
    );
  assert.doesNotThrow(() =>
    parseEnv({
      ...production,
      MONGODB_URI: "mongodb://fixture:fixture@db.example/aquashield?tls=true",
    }),
  );
  assert.doesNotThrow(() =>
    parseEnv({
      ...production,
      MONGODB_URI:
        "mongodb://fixture:fixture@host1:27017,host2:27017/aquashield?tls=true",
    }),
  );
});

test("liveness bypasses database/provider; readiness requires Mongo but never claims provider health", async () => {
  let pings = 0;
  const config = parseEnv({});
  const app = createApp(config, {
    databaseStatus: async () => {
      pings++;
      return "unavailable";
    },
  });
  await request(app).get("/api/health/live").expect(200);
  assert.equal(pings, 0);
  const down = await request(app).get("/api/health/ready").expect(503);
  assert.equal(down.body.code, "DATABASE_UNAVAILABLE");
  const ready = createApp(
    {
      ...config,
      GEMINI_API_KEY: "synthetic-private-canary",
      GEMINI_MODEL_ID: "fixture-model",
    },
    {
      databaseStatus: async () => "connected",
      aiDependencies: {
        generate: () => {
          throw new Error("Provider must never be invoked");
        },
      },
    },
  );
  const result = await request(ready).get("/api/health/ready").expect(200);
  assert.deepEqual(result.body.data.ai, {
    provider: "gemini",
    configured: true,
    mode: "REAL",
    availability: "NOT_PROBED",
    requiredForReadiness: false,
  });
  assert.equal(
    JSON.stringify(result.body).includes("synthetic-private-canary"),
    false,
  );
  assert.equal(result.headers["cache-control"], "no-store");
  assert.equal(result.headers["x-content-type-options"], "nosniff");
  assert.equal(result.headers["x-frame-options"], "DENY");
  assert.equal(result.headers["referrer-policy"], "no-referrer");
  const optional = await request(
    createApp(config, { databaseStatus: async () => "connected" }),
  )
    .get("/api/health/ready")
    .expect(200);
  assert.equal(optional.body.data.ai.configured, false);
});

test("production frontend rejects credential URLs and public secret variables", () => {
  assert.doesNotThrow(() =>
    validateBuildEnv({ VITE_USER_NODE_ENV: "development" }),
  );
  assert.throws(
    () => validateBuildEnv({ VITE_USER_NODE_ENV: "private" }),
    /Unsupported public/,
  );
  for (const value of [
    "/api",
    "https://api.example/api",
    "https://api.example/api/",
  ])
    assert.doesNotThrow(() => validateBuildEnv({ VITE_API_BASE_URL: value }));
  for (const value of [
    "http://api.example/api",
    "https://name:private@api.example/api",
    "https://api.example/api?key=private",
    "//api.example/api",
    "https://api.example/api#private",
  ])
    assert.throws(
      () => validateBuildEnv({ VITE_API_BASE_URL: value }),
      (error) =>
        !error.message.includes("private") &&
        /VITE_API_BASE_URL/.test(error.message),
    );
  assert.throws(
    () => validateBuildEnv({ VITE_GEMINI_API_KEY: "private" }),
    /Unsupported public/,
  );
});

test("structured runtime logs drop secret-bearing fields and unknown events", () => {
  let output;
  runtimeLog(
    "API_LISTENING",
    {
      port: 5000,
      apiKey: "private",
      uri: "private",
      error: new Error("private"),
      request: { authorization: "private" },
    },
    (entry) => {
      output = entry;
    },
  );
  assert.deepEqual(JSON.parse(output), { event: "API_LISTENING", port: 5000 });
  assert.throws(() => runtimeLog("private"), /Unknown runtime/);
});

test("SIGTERM drains HTTP, disconnects Mongo once and stops connection retries", async (t) => {
  const signals = new EventEmitter();
  const logs = [];
  let attempts = 0;
  let disconnects = 0;
  let exitCode;
  const config = { ...parseEnv({}), PORT: 0, MONGODB_RETRY_INTERVAL_MS: 100 };
  const runtime = startRuntime(config, {
    app: createApp(config),
    signals,
    connect: async () => {
      attempts++;
      throw new Error("private URI");
    },
    disconnect: async () => {
      disconnects++;
    },
    log: (event) => logs.push(event),
    setExitCode: (code) => {
      exitCode = code;
    },
  });
  t.after(() => runtime.shutdown());
  await once(runtime.server, "listening");
  await request(runtime.server).get("/api/health/live").expect(200);
  signals.emit("SIGTERM");
  await runtime.shutdown();
  await runtime.shutdown();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(runtime.server.listening, false);
  assert.equal(attempts, 1);
  assert.equal(disconnects, 1);
  assert.equal(exitCode, 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
  assert.ok(logs.includes("API_STOPPED"));
});

test("shutdown deadline bounds a stuck database attempt", async () => {
  let forced;
  const config = { ...parseEnv({}), PORT: 0, SHUTDOWN_TIMEOUT_MS: 1000 };
  const runtime = startRuntime(config, {
    app: createApp(config),
    signals: new EventEmitter(),
    connect: () => new Promise(() => {}),
    disconnect: async () => {},
    log: () => {},
    exit: (code) => {
      forced = code;
    },
  });
  await once(runtime.server, "listening");
  void runtime.shutdown();
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(forced, 1);
  assert.equal(runtime.server.listening, false);
});
