import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  predictReportActivity,
  classifyRisk,
  backtestActivity,
} from "../src/services/predictionEngine.js";
import { predictionConfig } from "../src/config/prediction.js";
import { activityReports } from "./helpers/predictions.js";
import { runAgent } from "../src/services/ai/agentService.js";
import { buildEvidence } from "../src/services/ai/evidence.js";
import { attachPredictionEvidence } from "../src/services/ai/predictionEvidence.js";
import { parseEnv } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { ApiError } from "../src/middleware/errors.js";
import { validateAdvice } from "../src/services/ai/contracts.js";
import { ruleBasedAssessment } from "../src/services/ai/ruleBased.js";
const now = new Date("2026-10-10T12:00:00Z"),
  input = { now, areaId: "AREA_01", areaName: "Synthetic area", isDemo: false };
const predict = (reports = activityReports(), extra = {}) =>
  predictReportActivity(reports, { ...input, ...extra });
test("non-overlapping UTC windows, EWMA and normalized risk use documented exact formulas", () => {
  const r = predict();
  assert.equal(r.factors.baselineReportsPerWindow, 2);
  assert.equal(r.factors.recentEwmaReportsPerWindow, 5.75);
  assert.equal(r.forecast.estimatedEligibleReportCount, 4);
  assert.equal(r.riskScore, 85);
  assert.equal(r.riskLevel, "CRITICAL");
  assert.equal(r.quality.sampleSize, 40);
  assert.equal(r.quality.coveredWindows, 12);
  assert.equal(r.observationWindow.start, "2026-10-07T12:00:00.000Z");
  for (let i = 1; i < r.observed.length; i++)
    assert.equal(r.observed[i - 1].end, r.observed[i].start);
  assert.equal(r.forecast.start, r.observationWindow.end);
  assert.equal(r.horizonHours, 6);
  assert.equal(r.method, "DETERMINISTIC_BACKEND");
});
test("risk normalization does not punish larger areas for higher constant volume", () => {
  const a = predict(activityReports({ counts: Array(12).fill(2) })),
    b = predict(activityReports({ counts: Array(12).fill(20) }));
  assert.equal(a.riskScore, 0);
  assert.equal(b.riskScore, 0);
  assert.equal(b.riskLevel, "LOW");
});
test("classification boundaries and configurable thresholds are distinct from severity", () => {
  for (const [score, level] of [
    [null, "INSUFFICIENT_DATA"],
    [24.99, "LOW"],
    [25, "MODERATE"],
    [50, "HIGH"],
    [75, "CRITICAL"],
    [100, "CRITICAL"],
  ])
    assert.equal(classifyRisk(score), level);
  assert.equal(
    classifyRisk(60, {
      PREDICTION_CRITICAL_THRESHOLD: 60,
      PREDICTION_HIGH_THRESHOLD: 40,
    }),
    "CRITICAL",
  );
  assert.throws(() => predictionConfig({ PREDICTION_HIGH_THRESHOLD: 20 }));
  assert.throws(() => predictionConfig({ PREDICTION_WINDOW_HOURS: 1 }));
});
test("same evidence/config/clock is reproducible and input order does not affect result", () => {
  const rows = activityReports();
  assert.deepEqual(predict(rows), predict(rows.toReversed()));
  const r = predict(rows, { source: { PREDICTION_MIN_REPORTS: 20 } });
  assert.notEqual(r.configVersion, predict(rows).configVersion);
  assert.equal(r.modelVersion, "report-activity-ewma-v1");
});
test("missing windows, sparse/empty data and read overflow never invent zero or forecasts", () => {
  for (const [rows, extra, reason] of [
    [[], {}, "SMALL_SAMPLE"],
    [
      activityReports({ counts: [0, ...Array(11).fill(3)] }),
      {},
      "MISSING_OBSERVATION_WINDOWS",
    ],
    [activityReports(), { truncated: true }, "HISTORY_READ_LIMIT"],
  ]) {
    const r = predict(rows, extra);
    assert.equal(r.riskLevel, "INSUFFICIENT_DATA");
    assert.equal(r.riskScore, null);
    assert.equal(r.forecast, null);
    assert.ok(r.reasons.includes(reason));
  }
  assert.equal(predict([]).observed[0].count, null);
});
test("stale observations and future reports do not manufacture current forecasts", () => {
  const r = predict(activityReports(), { now: new Date(+now + 24 * 3600000) });
  assert.equal(r.riskLevel, "INSUFFICIENT_DATA");
  assert.equal(r.quality.freshness, "STALE");
  const future = {
    ...activityReports()[0],
    createdAt: new Date(+now + 1000),
    _id: "future",
  };
  assert.deepEqual(predict([...activityReports(), future]), predict());
});
test("duplicates/suspicious reports are excluded using existing Phase 3 rules", () => {
  const rows = activityReports(),
    duplicate = {
      ...rows.at(-1),
      _id: "duplicate",
      createdAt: new Date(+rows.at(-1).createdAt + 1000),
    };
  const suspicious = {
    ...rows.at(-1),
    _id: "suspicious",
    reporterKeyHash: "other",
    lastSupplyTime: new Date(+rows.at(-1).createdAt - 100 * 3600000),
    reportedDurationHours: 1,
  };
  const r = predict([...rows, duplicate, suspicious]);
  assert.equal(r.quality.sampleSize, 40);
  assert.equal(r.quality.excludedCount, 2);
  assert.equal(r.riskScore, 85);
});
test("low identity diversity, invalid observations and excessive exclusions return insufficient", () => {
  const rows = activityReports().map((r) => ({
    ...r,
    reporterKeyHash: "same",
  }));
  assert.ok(predict(rows).reasons.includes("TOO_FEW_INDEPENDENT_REPORTERS"));
  const invalid = {
    ...activityReports()[0],
    _id: "bad",
    location: { lat: NaN, lng: 2 },
  };
  assert.ok(
    predict([...activityReports(), invalid]).reasons.includes(
      "INVALID_EVIDENCE",
    ),
  );
  const rejected = Array.from({ length: 80 }, (_, i) => ({
    ...activityReports()[0],
    _id: `rejected${i}`,
    verificationStatus: "REJECTED",
  }));
  assert.ok(
    predict([...activityReports(), ...rejected]).reasons.includes(
      "EXCESSIVE_EXCLUDED_EVIDENCE",
    ),
  );
});
test("demo and real evidence remain isolated; verification and numerical uncertainty stay distinct", () => {
  const r = predict([
    ...activityReports(),
    ...activityReports({ isDemo: true, counts: Array(12).fill(50) }),
  ]);
  assert.equal(r.quality.sampleSize, 40);
  assert.equal(r.provenance, "RECORDED_CITIZEN_ACTIVITY");
  assert.equal(
    predict(
      activityReports().map((r) => ({ ...r, verificationStatus: "PENDING" })),
    ).uncertainty.level,
    "HIGH",
  );
});
test("outliers are bounded and reported; declines cannot produce negative forecasts", () => {
  const r = predict(activityReports({ counts: [...Array(11).fill(2), 200] }));
  assert.equal(r.factors.outlierCap, 8);
  assert.ok(r.forecast.estimatedEligibleReportCount <= 4);
  assert.ok(r.uncertainty.reasons.some((s) => s.includes("capped")));
  assert.ok(
    predict(
      activityReports({ counts: [...Array(8).fill(8), ...Array(4).fill(2)] }),
    ).forecast.estimatedEligibleReportCount >= 0,
  );
});
test("rolling-origin backtest uses past-only data and returns honest synthetic MAE", () => {
  const r = backtestActivity(
    activityReports({ counts: Array(20).fill(3) }),
    input,
  );
  assert.equal(r.sampleCount, 8);
  assert.equal(r.meanAbsoluteError, 0);
  const short = backtestActivity(activityReports(), input);
  assert.equal(short.meanAbsoluteError, null);
  assert.equal(short.validationStatus, "INSUFFICIENT_VALIDATION_DATA");
  const rows = activityReports({ counts: Array(20).fill(3) }),
    past = rows.map((r) => ({
      ...r,
      verificationStatus: "VERIFIED",
      updatedAt: new Date(+now + 1000),
    }));
  assert.equal(
    backtestActivity(past, input).samples[0].predicted,
    r.samples[0].predicted,
  );
});
test("later rejection cannot leak into a historical forecast or exclusion quality", () => {
  const later = activityReports().map((r) => ({
    ...r,
    verificationStatus: "REJECTED",
    updatedAt: new Date(+now + 1000),
  }));
  assert.equal(predict(later).riskScore, 85);
  assert.equal(predict(later).quality.excludedCount, 0);
  assert.equal(predict(later).quality.verifiedCount, 0);
});
test("Gemini outage leaves supported numerical facts available through strict rule-based explanation", async () => {
  const config = parseEnv({
    NODE_ENV: "test",
    DEMO_AI_MODE: "false",
    GEMINI_API_KEY: "synthetic-test-key",
    GEMINI_MODEL_ID: "synthetic-model",
    AI_MAX_RETRIES: "0",
  });
  const facts = buildEvidence(
    [
      {
        id: "a".repeat(24),
        areaId: "AREA_01",
        areaName: "Synthetic",
        status: "ACTIVE",
        severityScore: 60,
        severityLevel: "HIGH",
        confidenceScore: 70,
        calculatedAt: now,
        reportCount: 40,
        eligibleReportCount: 40,
        verifiedReportCount: 20,
        duplicateReportCount: 0,
        suspiciousReportCount: 0,
      },
    ],
    { tankers: null, deliveries: null },
    config,
  );
  const r = { ...predict(), retrievalStatus: "CURRENT" };
  const evidence = attachPredictionEvidence(facts, { results: [r] });
  const agent = await runAgent(
    "predict",
    config,
    {},
    {
      allowFallback: true,
      evidenceLoader: async () => evidence,
      invoke: async () => {
        throw new ApiError(
          503,
          "AI_PROVIDER_UNAVAILABLE",
          "Provider unavailable.",
        );
      },
    },
  );
  assert.equal(agent.execution.method, "RULE_BASED");
  assert.equal(agent.facts.risk.riskScore, 85);
  assert.equal(agent.assessmentStatus, "REVIEW_REQUIRED");
  assert.equal(agent.execution.aiAnalysisCompleted, false);
  assert.throws(() =>
    validateAdvice(
      {
        ...ruleBasedAssessment("predict", evidence).advice,
        summary: "The risk is 99 percent.",
      },
      "predict",
      evidence,
    ),
  );
});
test("prediction API returns safe database errors and protects anonymous access", async () => {
  const config = parseEnv({ NODE_ENV: "test" });
  const unavailable = createApp(config, {
    databaseStatus: async () => "unavailable",
  });
  await request(unavailable).get("/api/predictions").expect(401);
  const r = await request(unavailable)
    .get("/api/predictions")
    .set("Authorization", `Bearer ${"a".repeat(64)}`)
    .expect(503);
  assert.equal(r.body.code, "DATABASE_UNAVAILABLE");
  assert.equal(r.body.stack, undefined);
});
