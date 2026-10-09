import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { serializeShortage } from "../src/services/shortageService.js";
import { DetectionGate } from "../src/services/detectionGate.js";
import { buildAllocationEvidence } from "../src/services/ai/allocationEvidence.js";
import { buildShortageEvents } from "../src/services/reportClusteringService.js";
import { rankAllocationEvents } from "../src/services/allocationEngine.js";
import { demoReports, DEMO_OBSERVED_AT } from "../src/demo/reports.js";
import { demoAreas } from "../src/demo/areas.js";
import { parseEnv } from "../src/config/env.js";
import { runAgent } from "../src/services/ai/agentService.js";
import { demoAdvice } from "../src/services/ai/demo.js";
import { roles, validateAdvice } from "../src/services/ai/contracts.js";
import { buildEvidence } from "../src/services/ai/evidence.js";
const config = parseEnv({ NODE_ENV: "test", DEMO_AI_MODE: "true" });
const events = buildShortageEvents(
  demoReports(),
  demoAreas(),
  config,
  DEMO_OBSERVED_AT,
).map((e, i) => ({ ...e, id: String(i), _id: String(i) }));
const facts = buildEvidence(
  events,
  { tankers: null, deliveries: null },
  config,
);

test("F1 suppresses singleton and small live clusters; generalizes larger aggregates; preserves municipal evidence", () => {
  for (const count of [1, 2, 4, 5, 12]) {
    const event = {
      ...events[0],
      isDemo: false,
      center: { lat: 20.01123, lng: 73.79912 },
      population: { ...events[0].population, householdCount: count },
    };
    const safe = serializeShortage(event, { publicView: true, config });
    if (count < 5) assert.equal(safe, null);
    else {
      assert.notDeepEqual(safe.center, event.center);
      for (const key of [
        "reportedHouseholdPopulation",
        "householdCount",
        "averageHouseholdSize",
        "range",
        "assumedReportCoverage",
      ])
        assert.equal(safe.population[key], undefined);
      assert.equal(
        safe.estimatedAffectedPopulation,
        event.estimatedAffectedPopulation,
      );
    }
    assert.deepEqual(serializeShortage(event).center, event.center);
    assert.deepEqual(serializeShortage(event).population, event.population);
  }
  assert.equal(
    serializeShortage(
      { ...events[0], isDemo: false, population: { householdCount: 8 } },
      { publicView: true, config: { PUBLIC_MIN_HOUSEHOLDS: 10 } },
    ),
    null,
  );
});

test("F9 concurrent reads coalesce, evidence invalidation drains once, errors retry and refresh expires", async () => {
  const gate = new DetectionGate();
  let calls = 0;
  let release;
  const work = async () => {
    calls++;
    if (calls === 1)
      await new Promise((r) => {
        release = r;
      });
    return calls;
  };
  const initial = gate.run(work);
  await Promise.resolve();
  const reads = Array.from({ length: 100 }, () => gate.run(work));
  const writes = Array.from({ length: 20 }, () =>
    gate.run(work, { force: true }),
  );
  release();
  assert.deepEqual(
    await Promise.all([initial, ...reads, ...writes]),
    Array(121).fill(2),
  );
  assert.equal(calls, 2);
  await gate.run(work);
  assert.equal(calls, 2);
  await gate.run(work, { ttl: 0 });
  assert.equal(calls, 3);
  await assert.rejects(
    gate.run(
      async () => {
        throw new Error("persistence failed");
      },
      { force: true },
    ),
  );
  await gate.run(work);
  assert.equal(calls, 4);
});

test("F9 a continuous writer cannot create an unbounded drain", async () => {
  const gate = new DetectionGate();
  let calls = 0;
  const work = async () => {
    calls++;
    gate.version++;
  };
  await assert.rejects(gate.run(work), { code: "DETECTION_BUSY" });
  assert.equal(calls, 2);
  assert.equal(gate.pending, null);
});

test("F2 allocation evidence follows authoritative fairness ordering and eligible fleet, not crisis ordering", () => {
  const input = events.filter((e) => e.status === "ACTIVE");
  const evidence = [
    {
      eventId: input[0].id,
      demandLitres: 1000,
      recentDeliveredLitres: 1000,
      observedAt: new Date(),
      source: "TEST",
    },
  ];
  const rules = { ...config, AI_FAIRNESS_MAX_ADJUSTMENT: 30 };
  const rankings = rankAllocationEvents(input, evidence, rules);
  const snapshot = {
    events: input,
    rankings,
    candidates: [],
    excluded: [{ reasons: ["Tanker is unavailable or reserved."] }],
    proposedLitres: null,
    isDemo: true,
  };
  const result = buildAllocationEvidence(snapshot, rules);
  assert.equal(
    result.zones.find((z) => z.ref === result.priorityRef).eventId,
    rankings[0].eventId,
  );
  assert.equal(
    result.zones.find((z) => z.eventId === input[0].id).allocationPriority,
    rankings.find((r) => r.eventId === input[0].id).priority,
  );
  assert.equal(result.allocationContext.recommendedFleetRef, null);
  assert.equal(result.allocationContext.excludedFleet.length, 1);
  assert.throws(
    () => buildAllocationEvidence({ ...snapshot, rankings: [] }, config),
    { code: "AI_NO_EVIDENCE" },
  );
});

for (const role of Object.keys(roles)) {
  test(`F3 ${role}: mocked provider rejects false verification, quantities, completion, unsupported references and actions`, async () => {
    const evidence = {
      ...facts,
      zones: facts.zones.map((z) => ({ ...z, verifiedReportCount: 0 })),
    };
    const valid = demoAdvice(role, evidence);
    const real = {
      ...config,
      DEMO_AI_MODE: false,
      GEMINI_API_KEY: "test-only",
      GEMINI_MODEL_ID: "test-only",
    };
    const good = await runAgent(
      role,
      real,
      {},
      { evidenceLoader: async () => evidence, invoke: async () => valid },
    );
    assert.equal(good.approved, false);
    assert.equal(good.humanReview, "REQUIRED");
    for (const summary of [
      "All reports are verified.",
      "Every report has been confirmed.",
      "Delivery is complete.",
      "We assigned the tanker.",
      "There are twenty five people affected.",
      "There are five households affected.",
      "ETA is known.",
      "The risk score is calculated.",
      "Water delivered: 8000 litres.",
    ])
      await assert.rejects(
        runAgent(
          role,
          real,
          {},
          {
            evidenceLoader: async () => evidence,
            invoke: async () => ({ ...valid, summary }),
          },
        ),
        { code: "AI_INVALID_OUTPUT" },
      );
    for (const change of [
      { evidenceRefs: ["nonexistent"] },
      { recommendedAction: "ASSIGN_TANKER" },
      { approved: true },
    ])
      assert.throws(
        () => validateAdvice({ ...valid, ...change }, role, evidence),
        { code: "AI_INVALID_OUTPUT" },
      );
  });
}

test("F6 delayed old-session 401 never erases a renewed or different-account session in either client", async () => {
  const old = {
    storage: globalThis.sessionStorage,
    window: globalThis.window,
    fetch: globalThis.fetch,
  };
  try {
    const values = new Map();
    let ended = 0;
    let finish;
    globalThis.sessionStorage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    };
    globalThis.window = { dispatchEvent: () => ended++ };
    const load = async (path) =>
      (await readFile(new URL(path, import.meta.url), "utf8")).replaceAll(
        "import.meta.env.VITE_API_BASE_URL",
        '"/api"',
      );
    const url = (source) =>
      `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
    const adminUrl = url(await load("../../web/src/lib/adminApi.js"));
    const admin = await import(adminUrl);
    const citizen = await import(
      url(
        (await load("../../web/src/lib/api.js")).replace(
          '"./adminApi.js"',
          JSON.stringify(adminUrl),
        ),
      )
    );
    for (const send of [
      () => admin.adminRequest("/auth/me"),
      () => citizen.getReports(1, false),
    ]) {
      for (const replacement of ["renewed-session", "other-account", null]) {
        values.set(admin.ADMIN_TOKEN_KEY, "old-session");
        globalThis.fetch = async () =>
          new Promise((resolve) => {
            finish = resolve;
          });
        const pending = send();
        if (replacement) values.set(admin.ADMIN_TOKEN_KEY, replacement);
        finish({
          status: 401,
          ok: false,
          json: async () => ({
            success: false,
            code: "SESSION_EXPIRED",
            message: "Expired",
          }),
        });
        await assert.rejects(pending);
        assert.equal(
          values.get(admin.ADMIN_TOKEN_KEY),
          replacement ?? undefined,
        );
      }
    }
    assert.equal(ended, 2);
  } finally {
    globalThis.sessionStorage = old.storage;
    globalThis.window = old.window;
    globalThis.fetch = old.fetch;
  }
});
