import { test } from "node:test";
import assert from "node:assert/strict";
import { createAiReliability } from "../src/services/ai/reliability.js";
import { providerRetryAfterMs } from "../src/services/ai/providerErrors.js";
import { parseEnv } from "../src/config/env.js";
import { runAgent } from "../src/services/ai/agentService.js";
import { buildEvidence } from "../src/services/ai/evidence.js";
import { buildShortageEvents } from "../src/services/reportClusteringService.js";
import { demoReports, DEMO_OBSERVED_AT } from "../src/demo/reports.js";
import { demoAreas } from "../src/demo/areas.js";
import { demoAdvice } from "../src/services/ai/demo.js";
import { ApiError } from "../src/middleware/errors.js";

const config = parseEnv({
  NODE_ENV: "test",
  GEMINI_API_KEY: "mock-only-key",
  GEMINI_MODEL_ID: "mock-model",
  AI_TIMEOUT_MS: "10000",
});
function harness(overrides = {}) {
  let time = 1000;
  const sleeps = [],
    logs = [];
  const c = { ...config, AI_CIRCUIT_FAILURE_THRESHOLD: 10, ...overrides };
  const layer = createAiReliability(c, {
    now: () => time,
    random: () => 0,
    sleep: async (ms) => {
      sleeps.push(ms);
      time += ms;
    },
    log: (event) => logs.push(event),
  });
  return {
    layer,
    sleeps,
    logs,
    config: c,
    advance: (ms) => {
      time += ms;
    },
  };
}
const error = (status) =>
  Object.assign(new Error("SECRET prompt key URL"), { status });
const events = buildShortageEvents(
  demoReports(),
  demoAreas(),
  config,
  DEMO_OBSERVED_AT,
).map((e, i) => ({ ...e, id: `test-${i}` }));
const facts = buildEvidence(
  events,
  { tankers: null, deliveries: null },
  config,
  { demo: false },
);

test("retryable HTTP and network errors use bounded exponential jitter and stop at the configured limit", async () => {
  for (const failure of [
    error(429),
    error(500),
    error(502),
    error(503),
    error(504),
    Object.assign(Error("SECRET"), { code: "ECONNRESET" }),
    Object.assign(Error("SECRET"), { code: "ETIMEDOUT" }),
  ]) {
    const h = harness({ AI_MAX_RETRIES: 2 });
    let calls = 0;
    await assert.rejects(
      h.layer.execute(async () => {
        calls++;
        throw failure;
      }),
      (e) => {
        assert.equal(e.details.attempts, 3);
        assert.equal(JSON.stringify(e).includes("SECRET"), false);
        return true;
      },
    );
    assert.equal(calls, 3);
    assert.deepEqual(h.sleeps, [250, 500]);
    assert.equal(JSON.stringify(h.logs).includes("SECRET"), false);
    assert.equal(h.layer.snapshot().active, 0);
  }
});
test("success after transient failure preserves the validated result and resets failure count", async () => {
  const h = harness();
  let calls = 0;
  const result = await h.layer.execute(async () => {
    if (++calls === 1) throw error(503);
    return "valid";
  });
  assert.equal(result.value, "valid");
  assert.equal(result.attempts, 2);
  assert.equal(h.layer.snapshot().failures, 0);
});

test("a validated mocked success after retry has accurate Gemini completion provenance", async () => {
  const h = harness();
  let calls = 0;
  const result = await runAgent(
    "detect",
    h.config,
    {},
    {
      reliability: h.layer,
      allowFallback: true,
      evidenceLoader: async () => facts,
      invoke: async () => {
        if (++calls === 1) throw error(503);
        return demoAdvice("detect", facts);
      },
    },
  );
  assert.equal(result.execution.method, "GEMINI");
  assert.equal(result.execution.aiAnalysisCompleted, true);
  assert.equal(result.execution.attempts, 2);
  assert.equal(result.execution.fallbackReasonCode, null);
  assert.equal(result.approved, false);
});

test("insufficient remaining deadline never permits a retry delay beyond its budget", async () => {
  const h = harness({ AI_TIMEOUT_MS: 100, AI_MAX_RETRIES: 2 });
  let calls = 0;
  await assert.rejects(
    h.layer.execute(async () => {
      calls++;
      throw error(503);
    }),
    { code: "AI_PROVIDER_UNAVAILABLE" },
  );
  assert.equal(calls, 1);
  assert.deepEqual(h.sleeps, []);
});
test("Retry-After seconds, dates and wrapped Google RetryInfo are honored without early capped retries", async () => {
  assert.equal(
    providerRetryAfterMs({ headers: new Headers({ "Retry-After": "2" }) }),
    2000,
  );
  assert.equal(
    providerRetryAfterMs(
      {
        response: { headers: { "retry-after": new Date(6000).toUTCString() } },
      },
      1000,
    ),
    5000,
  );
  assert.equal(
    providerRetryAfterMs({
      cause: {
        message: JSON.stringify({
          error: {
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.RetryInfo",
                retryDelay: "1.5s",
              },
            ],
          },
        }),
      },
    }),
    1500,
  );
  assert.equal(
    providerRetryAfterMs({ headers: { "retry-after": "SECRET" } }),
    null,
  );
  const h = harness();
  let calls = 0;
  const failure = Object.assign(error(429), {
    headers: { "retry-after": "2" },
  });
  await h.layer.execute(async () => {
    if (++calls === 1) throw failure;
    return true;
  });
  assert.deepEqual(h.sleeps, [2000]);
  const long = harness();
  let count = 0;
  await assert.rejects(
    long.layer.execute(async () => {
      count++;
      throw Object.assign(error(503), { headers: { "retry-after": "60" } });
    }),
  );
  assert.equal(count, 1);
  assert.deepEqual(long.sleeps, []);
  await assert.rejects(
    long.layer.execute(() => assert.fail("cooldown bypass")),
    { code: "AI_PROVIDER_COOLDOWN" },
  );
});
test("authentication, invalid model/request, output truncation and invalid output are never retried", async () => {
  for (const failure of [
    error(400),
    error(401),
    error(403),
    error(404),
    { name: "MaxTokensError" },
    new ApiError(502, "AI_INVALID_OUTPUT", "SECRET"),
  ]) {
    const h = harness({ AI_MAX_RETRIES: 2 });
    let calls = 0;
    await assert.rejects(
      h.layer.execute(async () => {
        calls++;
        throw failure;
      }),
    );
    assert.equal(calls, 1);
    assert.deepEqual(h.sleeps, []);
  }
});
test("circuit opens across requests, admits one recovery probe, then closes only on success", async () => {
  const h = harness({ AI_MAX_RETRIES: 0, AI_CIRCUIT_FAILURE_THRESHOLD: 1 });
  await assert.rejects(
    h.layer.execute(async () => {
      throw error(503);
    }),
  );
  assert.equal(h.layer.snapshot().state, "OPEN");
  await assert.rejects(
    h.layer.execute(() => assert.fail("open circuit called")),
    { code: "AI_CIRCUIT_OPEN" },
  );
  h.advance(config.AI_CIRCUIT_RESET_MS);
  let release;
  const probe = h.layer.execute(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await Promise.resolve();
  await assert.rejects(
    h.layer.execute(() => assert.fail("parallel probe")),
    { code: "AI_CIRCUIT_OPEN" },
  );
  release("healthy");
  await probe;
  assert.equal(h.layer.snapshot().state, "CLOSED");
  assert.equal((await h.layer.execute(async () => "next")).value, "next");
});
test("failed recovery probe reopens without retrying and old concurrent success cannot close a newer open circuit", async () => {
  const h = harness({ AI_MAX_RETRIES: 2, AI_CIRCUIT_FAILURE_THRESHOLD: 1 });
  let finish;
  const old = h.layer.execute(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await Promise.resolve();
  await assert.rejects(
    h.layer.execute(async () => {
      throw error(503);
    }),
  );
  finish(true);
  await old;
  assert.equal(h.layer.snapshot().state, "OPEN");
  h.advance(config.AI_CIRCUIT_RESET_MS);
  let probes = 0;
  await assert.rejects(
    h.layer.execute(async () => {
      probes++;
      throw error(503);
    }),
  );
  assert.equal(probes, 1);
  assert.equal(h.layer.snapshot().state, "OPEN");
});
test("concurrent requests are bounded, and backoff prevents new calls from creating a retry storm", async () => {
  const h = harness({ AI_MAX_CONCURRENT: 1 });
  let release;
  const running = h.layer.execute(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await Promise.resolve();
  const blocked = await Promise.all(
    Array.from({ length: 20 }, () =>
      h.layer.execute(() => assert.fail("storm")).catch((e) => e.code),
    ),
  );
  assert.ok(blocked.every((code) => code === "AI_BUSY"));
  release(true);
  await running;
  let resume,
    calls = 0;
  const layer = createAiReliability(config, {
    log: () => {},
    sleep: () =>
      new Promise((resolve) => {
        resume = resolve;
      }),
  });
  const retried = layer
    .execute(async () => {
      calls++;
      throw error(503);
    })
    .catch((e) => e);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    layer.execute(() => assert.fail("backoff storm")),
    { code: "AI_PROVIDER_COOLDOWN" },
  );
  resume();
  await retried;
  assert.equal(calls, 1); // Fake early sleep cannot bypass cooldown.
});
test("timeouts cancel transport and cannot launch overlapping retries when cancellation is ignored", async () => {
  let observed, release;
  const layer = createAiReliability(
    { ...config, AI_TIMEOUT_MS: 15, AI_MAX_CONCURRENT: 1 },
    { log: () => {} },
  );
  await assert.rejects(
    layer.execute(({ signal }) => {
      observed = signal;
      return new Promise((resolve) => {
        release = resolve;
      });
    }),
    (e) => e.code === "AI_TIMEOUT" && e.details.category === "AGENT_DEADLINE",
  );
  assert.equal(observed.aborted, true);
  await assert.rejects(
    layer.execute(() => assert.fail("unsettled overlap")),
    { code: "AI_BUSY" },
  );
  release(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(layer.snapshot().active, 0);
});
test("client cancellation interrupts active work and retry backoff without a fallback or further calls", async () => {
  const controller = new AbortController();
  const layer = createAiReliability(config, { log: () => {} });
  const running = layer.execute(
    ({ signal }) =>
      new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve(null)),
      ),
    { signal: controller.signal },
  );
  await Promise.resolve();
  controller.abort();
  await assert.rejects(running, { code: "AI_CANCELLED" });
  assert.equal(layer.snapshot().failures, 0);
  const c = new AbortController();
  let calls = 0;
  const retry = layer.execute(
    async () => {
      calls++;
      throw error(503);
    },
    { signal: c.signal },
  );
  await new Promise((resolve) => setImmediate(resolve));
  c.abort();
  await assert.rejects(retry, { code: "AI_CANCELLED" });
  assert.equal(calls, 1);
});
for (const role of ["detect", "allocate", "logistics", "predict"])
  test(`${role}: real failures retain original facts with explicit rule-based/manual-review provenance`, async () => {
    const h = harness({ AI_MAX_RETRIES: 0 });
    const result = await runAgent(
      role,
      h.config,
      {},
      {
        reliability: h.layer,
        allowFallback: true,
        evidenceLoader: async () => facts,
        invoke: async () => {
          throw error(503);
        },
      },
    );
    assert.equal(result.execution.mode, "RULE_BASED");
    assert.equal(result.execution.isDemo, false);
    assert.equal(result.execution.aiAnalysisCompleted, false);
    assert.equal(result.execution.providerExecuted, false);
    assert.equal(
      result.execution.fallbackReasonCode,
      "AI_PROVIDER_UNAVAILABLE",
    );
    assert.deepEqual(result.facts, facts);
    assert.equal(result.approved, false);
    assert.equal(result.humanReview, "REQUIRED");
    assert.ok(result.requestId);
    if (role !== "detect")
      assert.equal(result.assessmentStatus, "INSUFFICIENT_DATA");
    assert.equal(JSON.stringify(result).includes("SECRET"), false);
    assert.equal(result.advice.summary.includes("simulation"), false);
  });
test("supported allocation/logistics facts remain reviewable and invalid model output never becomes accepted advice", async () => {
  for (const role of ["allocate", "logistics"]) {
    const supported = {
      ...facts,
      allocationContext: { recommendedFleetRef: "fleet_0" },
      fleet: [{ id: "tanker" }],
      route: { distanceKm: 2, etaMinutes: 5 },
    };
    const h = harness();
    const result = await runAgent(
      role,
      h.config,
      {},
      {
        reliability: h.layer,
        allowFallback: true,
        evidenceLoader: async () => supported,
        invoke: async () => ({
          ...demoAdvice(role, supported),
          summary: "SECRET 999 tankers dispatched",
        }),
      },
    );
    assert.equal(result.execution.fallbackReasonCode, "AI_INVALID_OUTPUT");
    assert.equal(result.execution.attempts, 1);
    assert.equal(result.assessmentStatus, "REVIEW_REQUIRED");
    assert.equal(JSON.stringify(result).includes("SECRET"), false);
    assert.deepEqual(result.facts, supported);
  }
});
test("missing configuration never calls a provider, and explicit demo remains a separate path", async () => {
  const result = await runAgent(
    "detect",
    { ...config, GEMINI_API_KEY: "" },
    {},
    {
      allowFallback: true,
      evidenceLoader: async () => facts,
      invoke: () => assert.fail("no key"),
    },
  );
  assert.equal(result.execution.fallbackReasonCode, "AI_NOT_CONFIGURED");
  assert.equal(result.execution.attempts, 0);
  const demo = await runAgent(
    "detect",
    { ...config, DEMO_AI_MODE: true },
    {},
    {
      allowFallback: true,
      evidenceLoader: async () => facts,
      invoke: () => assert.fail("demo provider"),
    },
  );
  assert.equal(demo.execution.mode, "DEMO_SIMULATION");
  assert.equal(demo.execution.method, "DEMO");
  assert.equal(demo.execution.fallbackReasonCode, null);
});
test("reliability environment bounds reject retry storms and unbounded deadlines", () => {
  for (const invalid of [
    { AI_MAX_RETRIES: 3 },
    { AI_MAX_RETRIES: -1 },
    { AI_MAX_CONCURRENT: 50 },
    { AI_CIRCUIT_RESET_MS: 0 },
    { AI_RETRY_MAX_DELAY_MS: 60000 },
    { AI_ATTEMPT_TIMEOUT_MS: 0 },
  ])
    assert.throws(() => parseEnv(invalid), /Invalid environment/);
});
