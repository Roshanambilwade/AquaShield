import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter, once } from "node:events";
import request from "supertest";
import { verify, verificationSteps } from "../../../scripts/verify.js";
import { testEnvironment } from "../../../scripts/testEnvironment.js";
import { parseEnv } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { startRuntime } from "../src/runtime.js";
import { cleanupTestDatabase } from "./helpers/cleanup.js";

test("cleanup rejects shared targets and always disconnects even when dropping the owned database fails", async () => {
  const expected = `aquashield_cleanup_test_${"a".repeat(32)}`;
  for (const scenario of [
    "normal",
    "wrong-name",
    "wrong-mode",
    "drop-fails",
    "disconnected",
  ]) {
    let drops = 0,
      disconnects = 0;
    const run = () =>
      cleanupTestDatabase(expected, {
        nodeEnv: scenario === "wrong-mode" ? "production" : "test",
        connection: {
          name: scenario === "wrong-name" ? "aquashield_demo" : expected,
          readyState: scenario === "disconnected" ? 0 : 1,
          dropDatabase: async (options) => {
            drops++;
            assert.equal(options.maxTimeMS, 5000);
            if (scenario === "drop-fails")
              throw new Error("Injected cleanup failure");
          },
        },
        disconnect: async () => {
          disconnects++;
        },
      });
    if (["wrong-name", "wrong-mode", "drop-fails"].includes(scenario))
      await assert.rejects(run);
    else await run();
    assert.equal(disconnects, 1);
    assert.equal(drops, ["normal", "drop-fails"].includes(scenario) ? 1 : 0);
  }
  await assert.rejects(
    () =>
      cleanupTestDatabase("aquashield_demo", {
        disconnect: async () => {},
        nodeEnv: "test",
      }),
    /Refusing cleanup/,
  );
});

test("complete verification stops on failure, crash, signal or missing status", () => {
  for (const result of [
    { status: 2 },
    { status: null },
    { status: 0, signal: "SIGTERM" },
    { status: 0, error: new Error() },
    undefined,
  ]) {
    let calls = 0;
    assert.equal(
      verify({
        run: () => {
          calls++;
          return result;
        },
        log: () => {},
      }),
      1,
    );
    assert.equal(calls, 1);
  }
  assert.equal(
    verify({
      run: () => {
        throw new Error("private");
      },
      log: () => {},
    }),
    1,
  );
});

test("complete verification includes all offline gates, builds before browsers and never invokes live AI or seeding", () => {
  const seen = [];
  assert.equal(
    verify({
      run: (args) => {
        seen.push(args);
        return { status: 0 };
      },
      log: () => {},
    }),
    0,
  );
  assert.equal(seen.length, verificationSteps.length);
  assert.deepEqual(
    seen,
    verificationSteps.map((s) => s[1]),
  );
  assert.ok(
    seen.findIndex((a) => a.includes("build")) <
      seen.findIndex((a) => a.includes("test:e2e")),
  );
  assert.equal(/live|seed|deploy/.test(JSON.stringify(seen)), false);
});

test("automated environment isolates private Mongo, Gemini and demonstration configuration", () => {
  const env = testEnvironment({
    NODE_ENV: "production",
    MONGODB_URI: "private",
    GEMINI_API_KEY: "private",
    DEMONSTRATION_MODE: "true",
    ROUTING_BASE_URL: "private",
  });
  assert.equal(env.NODE_ENV, "test");
  assert.equal(env.MONGODB_URI, "mongodb://127.0.0.1:27017/aquashield_tests");
  assert.equal(env.GEMINI_API_KEY, "");
  assert.equal(env.GEMINI_MODEL_ID, "");
  assert.equal(env.DEMONSTRATION_MODE, "false");
  assert.equal(env.DEMO_SEED_ENABLED, "false");
  assert.equal(env.ROUTING_BASE_URL, "");
  assert.equal(
    testEnvironment({ MONGODB_TEST_URI: "explicit-test-server" }).MONGODB_URI,
    "explicit-test-server",
  );
});

test("Playwright parent ignores a caller database while workers retain the generated run database", () => {
  const provided = `aquashield_browser_test_${"a".repeat(32)}`;
  for (const worker of [false, true]) {
    const env = { ...process.env, MONGODB_TEST_DB_NAME: provided };
    if (worker) env.TEST_WORKER_INDEX = "0";
    else delete env.TEST_WORKER_INDEX;
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "await import(process.argv[1]); console.log(process.env.MONGODB_TEST_DB_NAME)",
        new URL("../../../playwright.config.js", import.meta.url).href,
      ],
      { env, encoding: "utf8", timeout: 10000, windowsHide: true },
    );
    assert.equal(result.status, 0);
    const selected = result.stdout.trim();
    assert.match(selected, /^aquashield_browser_test_[a-f0-9]{32}$/);
    if (worker) assert.equal(selected, provided);
    else assert.notEqual(selected, provided);
  }
});

test("real server process rejects invalid production configuration before listening without leaking values", () => {
  const result = spawnSync(process.execPath, ["src/server.js"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      CORS_ORIGIN: "http://invalid.example",
      MONGODB_URI: "mongodb://private-user:private-pass@invalid.example/live",
      DEMONSTRATION_MODE: "false",
      DEMO_AI_MODE: "false",
      MONGODB_TEST_DB_NAME: "",
    },
    encoding: "utf8",
    timeout: 10000,
    windowsHide: true,
  });
  assert.equal(result.status, 1);
  const output = result.stdout + result.stderr;
  assert.match(output, /CONFIGURATION_INVALID/);
  assert.doesNotMatch(
    output,
    /API_LISTENING|private-user|private-pass|invalid\.example/,
  );
});

test("startup retries recover readiness without overlapping connection attempts or requiring Gemini", async (t) => {
  let calls = 0,
    active = 0,
    peak = 0,
    connected = false;
  let recovered;
  const recovery = new Promise((resolve) => {
    recovered = resolve;
  });
  const config = { ...parseEnv({}), PORT: 0, MONGODB_RETRY_INTERVAL_MS: 10 };
  const runtime = startRuntime(config, {
    app: createApp(config, {
      databaseStatus: async () => (connected ? "connected" : "disconnected"),
    }),
    connect: async () => {
      peak = Math.max(peak, ++active);
      calls++;
      try {
        if (calls < 3) throw new Error("private URI");
        connected = true;
      } finally {
        active--;
      }
    },
    disconnect: async () => {
      connected = false;
    },
    signals: new EventEmitter(),
    log: (event) => {
      if (event === "DATABASE_CONNECTED") recovered();
    },
    setExitCode: () => {},
  });
  t.after(() => runtime.shutdown());
  await recovery;
  await request(runtime.server).get("/api/health/ready").expect(200);
  assert.equal(calls, 3);
  assert.equal(peak, 1);
  await runtime.shutdown();
  assert.equal(connected, false);
});

test("graceful shutdown drains an in-flight response before disconnecting Mongo", async (t) => {
  const app = createApp(parseEnv({}));
  let release, entered;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const accepted = new Promise((resolve) => {
    entered = resolve;
  });
  // Mount before a request; this test route is separate from production routes.
  const express = (await import("express")).default;
  const wrapper = express();
  wrapper.get("/held", async (_req, res) => {
    entered();
    await held;
    res.json({ success: true });
  });
  wrapper.use(app);
  let disconnected = false;
  const runtime = startRuntime(
    { ...parseEnv({}), PORT: 0 },
    {
      app: wrapper,
      connect: async () => {},
      disconnect: async () => {
        disconnected = true;
      },
      signals: new EventEmitter(),
      log: () => {},
      setExitCode: () => {},
    },
  );
  t.after(() => {
    release();
    return runtime.shutdown();
  });
  await once(runtime.server, "listening");
  const response = request(runtime.server)
    .get("/held")
    .expect(200)
    .then((r) => r);
  await accepted;
  const closing = runtime.shutdown();
  assert.equal(disconnected, false);
  release();
  assert.equal((await response).body.success, true);
  await closing;
  assert.equal(disconnected, true);
});
