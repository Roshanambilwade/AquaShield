import test from "node:test";
import assert from "node:assert/strict";
import { detectionConfig } from "../src/config/detection.js";
import { parseEnv } from "../src/config/env.js";
import {
  clusterReports,
  detectDuplicatesAndSuspicious,
  buildShortageEvents,
  calculateShortageDuration,
} from "../src/services/reportClusteringService.js";
import { calculateEventConfidence } from "../src/services/confidenceEngine.js";
import { estimateAffectedPopulation } from "../src/services/populationEngine.js";
import {
  calculateSeverityScore,
  calculateSeverityLevel,
  calculateDurationScore,
  calculateWaterLevelScore,
} from "../src/services/severityEngine.js";
import {
  calculatePreviousDeliveryPenalty,
  calculateAllocationPriority,
} from "../src/services/fairnessEngine.js";
import { demoReports, DEMO_OBSERVED_AT } from "../src/demo/reports.js";
import { demoAreas } from "../src/demo/areas.js";

const config = detectionConfig();
const make = (index, overrides = {}) => ({
  _id: String(index).padStart(24, "0"),
  reporterKeyHash: `key-${index}`,
  createdAt: new Date("2026-10-08T06:00:00Z"),
  location: { lat: 20, lng: 73.8 },
  locationSource: "MANUAL",
  locality: "Test",
  problem: "NO_WATER",
  lastSupplyTime: null,
  reportedDurationHours: 18,
  waterLevel: "EMPTY",
  householdSize: 5,
  verificationStatus: "PENDING",
  isDemo: false,
  ...overrides,
});

test("geographic clustering groups nearby reports without joining distant zones", () => {
  assert.deepEqual(
    clusterReports([
      make(1),
      make(2, { location: { lat: 20.003, lng: 73.8 } }),
      make(3, { location: { lat: 21, lng: 73.8 } }),
    ]).map((c) => c.length),
    [2, 1],
  );
});
test("time windows separate reports at the same coordinates", () => {
  assert.deepEqual(
    clusterReports([
      make(1),
      make(2, { createdAt: new Date("2026-10-08T11:59:00Z") }),
      make(3, { createdAt: new Date("2026-10-08T12:01:00Z") }),
    ]).map((c) => c.length),
    [2, 1],
  );
});
test("complete-link clustering prevents geographic and temporal chains", () => {
  const chain = [0, 1, 2].map((i) =>
    make(i, { location: { lat: 20 + i * 0.007, lng: 73.8 } }),
  );
  assert.deepEqual(
    clusterReports(chain).map((c) => c.length),
    [2, 1],
  );
  const times = [0, 5, 10].map((i) =>
    make(i, { createdAt: new Date(Date.UTC(2026, 9, 8, 6 + i)) }),
  );
  assert.deepEqual(
    clusterReports(times).map((c) => c.length),
    [2, 1],
  );
});
test("configurable distance and time thresholds change cluster membership", () => {
  const reports = [
    make(1),
    make(2, {
      location: { lat: 20.004, lng: 73.8 },
      createdAt: new Date("2026-10-08T08:00:00Z"),
    }),
  ];
  assert.equal(clusterReports(reports).length, 1);
  assert.equal(
    clusterReports(reports, detectionConfig({ CLUSTER_RADIUS_KM: 0.1 })).length,
    2,
  );
  assert.equal(
    clusterReports(reports, detectionConfig({ CLUSTER_TIME_WINDOW_HOURS: 1 }))
      .length,
    2,
  );
});
test("repeat keys are excluded; different keys sharing a locality center are retained", () => {
  const reports = [make(1), make(2, { reporterKeyHash: "key-1" }), make(3)];
  const result = detectDuplicatesAndSuspicious(reports);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.duplicates[0].duplicateOf, reports[0]._id);
  const event = buildShortageEvents(reports)[0];
  assert.equal(event.reportCount, 3);
  assert.equal(event.eligibleReportCount, 2);
  assert.equal(event.population.reportedHouseholdPopulation, 10);
});
test("same key beyond duplicate radius still contributes only once in one cluster", () => {
  const events = buildShortageEvents([
    make(1),
    make(2, { reporterKeyHash: "key-1", location: { lat: 20.004, lng: 73.8 } }),
  ]);
  assert.equal(events[0].eligibleReportCount, 1);
  assert.equal(events[0].duplicateReportCount, 1);
  assert.equal(events[0].duplicateReportIds.length, 1);
  assert.deepEqual(events[0].center, { lat: 20, lng: 73.8 });
});

test("suspicious evidence is counted once across overlapping time clusters", () => {
  const reports = [
    make(1),
    make(2, { createdAt: new Date("2026-10-08T12:01:00Z") }),
    make(3, {
      createdAt: new Date("2026-10-08T09:00:00Z"),
      lastSupplyTime: new Date("2026-10-08T08:00:00Z"),
      reportedDurationHours: 18,
    }),
  ];
  const events = buildShortageEvents(reports);
  assert.equal(events.length, 2);
  assert.equal(
    events.reduce((sum, e) => sum + e.suspiciousReportCount, 0),
    1,
  );
});
test("implausible movement and conflicting supply duration are suspicious", () => {
  const result = detectDuplicatesAndSuspicious([
    make(1),
    make(2, { reporterKeyHash: "key-1", location: { lat: 30, lng: 73.8 } }),
    make(3, {
      lastSupplyTime: new Date("2026-10-08T05:00:00Z"),
      reportedDurationHours: 20,
    }),
  ]);
  assert.equal(result.suspicious.length, 2);
  assert.equal(result.accepted.length, 1);
});
test("confidence comes from weighted evidence, with uncertain centers discounted", () => {
  const reports = Array.from({ length: 10 }, (_, i) => make(i));
  assert.equal(
    calculateEventConfidence(reports, { infrastructureCorrelated: true }).score,
    100,
  );
  assert.equal(calculateEventConfidence(reports).score, 90);
  assert.equal(calculateEventConfidence([make(1)]).score, 37);
  assert.equal(
    calculateEventConfidence(
      reports.map((r) => ({ ...r, locationSource: "LOCALITY_CENTER" })),
    ).score,
    77.5,
  );
  assert.equal(calculateEventConfidence([]).score, 0);
  const mixed = reports.map((r, i) => ({
    ...r,
    problem: i % 2 ? "LOW_PRESSURE" : "NO_WATER",
  }));
  assert.equal(calculateEventConfidence(mixed).score, 72.5);
});
test("population is an approximate coverage-based estimate from unique household keys", () => {
  const population = estimateAffectedPopulation([
    make(1),
    make(2, { householdSize: 3 }),
    make(3, { reporterKeyHash: "key-1" }),
  ]);
  assert.equal(population.reportedHouseholdPopulation, 8);
  assert.equal(population.estimate, 32);
  assert.equal(population.averageHouseholdSize, 4);
  assert.equal(
    estimateAffectedPopulation([make(1)], { populationEstimate: 10 }).estimate,
    10,
  );
  assert.equal(population.range.upper, null);
  assert.equal(
    estimateAffectedPopulation(
      [make(1)],
      null,
      detectionConfig({ POPULATION_REPORT_COVERAGE: 0.5 }),
    ).estimate,
    10,
  );
});
test("duration uses elapsed supply time or reported duration plus age; unknown remains null", () => {
  const clock = new Date("2026-10-08T08:00:00Z");
  assert.equal(calculateShortageDuration([make(1)], clock), 20);
  assert.equal(
    calculateShortageDuration(
      [make(1, { lastSupplyTime: new Date("2026-10-07T08:00:00Z") })],
      clock,
    ),
    24,
  );
  assert.equal(
    calculateShortageDuration(
      [make(1, { reportedDurationHours: null })],
      clock,
    ),
    null,
  );
});
test("severity uses the exact default weights and deterministic normalized components", () => {
  const severity = calculateSeverityScore({
    durationHours: 24,
    estimatedAffectedPopulation: 620,
    waterLevel: "LESS_THAN_25",
    temperatureC: 43,
    vulnerableRatio: 0.175,
    confidenceScore: 94,
  });
  const expected =
    Math.round(
      (96 * 0.25 +
        (620 / 750) * 100 * 0.2 +
        90 * 0.2 +
        (18 / 19) * 100 * 0.15 +
        70 * 0.1 +
        94 * 0.1) *
        10,
    ) / 10;
  assert.equal(severity.score, expected);
  assert.equal(severity.level, "CRITICAL");
  assert.equal(severity.complete, true);
  assert.deepEqual(
    severity.components.map((c) => c.weight),
    [25, 20, 20, 15, 10, 10],
  );
  assert.equal(calculateDurationScore(100), 100);
  assert.equal(calculateWaterLevelScore("UNKNOWN"), null);
});
test("unknown severity inputs produce a partial score and explicit upper bound", () => {
  const severity = calculateSeverityScore({ confidenceScore: 80 });
  assert.equal(severity.score, 8);
  assert.equal(severity.upperBound, 98);
  assert.equal(severity.complete, false);
  assert.equal(severity.missingInputs.length, 5);
});
test("all severity classification boundaries and configurable thresholds work", () => {
  for (const [score, level] of [
    [0, "LOW"],
    [29.9, "LOW"],
    [30, "MEDIUM"],
    [59.9, "MEDIUM"],
    [60, "HIGH"],
    [79.9, "HIGH"],
    [80, "CRITICAL"],
    [100, "CRITICAL"],
  ])
    assert.equal(calculateSeverityLevel(score), level);
  assert.equal(
    calculateSeverityLevel(
      70,
      detectionConfig({
        SEVERITY_THRESHOLDS: '{"medium":10,"high":20,"critical":70}',
      }),
    ),
    "CRITICAL",
  );
});
test("configured weights alter confidence and severity without client supplied outputs", () => {
  const confidenceConfig = detectionConfig({
    CONFIDENCE_WEIGHTS:
      '{"consistency":0,"geographic":0,"independent":100,"infrastructure":0,"time":0}',
  });
  assert.equal(
    calculateEventConfidence([make(1), make(2)], {}, confidenceConfig).score,
    20,
  );
  const severityConfig = detectionConfig({
    SEVERITY_WEIGHTS:
      '{"duration":100,"population":0,"waterLevel":0,"environmental":0,"vulnerability":0,"confidence":0}',
  });
  const severity = calculateSeverityScore(
    { durationHours: 24 },
    severityConfig,
  );
  assert.equal(severity.score, 96);
  assert.equal(severity.complete, true);
});

test("invalid weights, thresholds, and environment controls are rejected without leaking values", () => {
  for (const input of [
    { CLUSTER_RADIUS_KM: 0 },
    { SEVERITY_WEIGHTS: '{"duration":100}' },
    { CONFIDENCE_WEIGHTS: "broken" },
    { SEVERITY_THRESHOLDS: '{"medium":80,"high":30,"critical":60}' },
    { POPULATION_REPORT_COVERAGE: 1.1 },
  ])
    assert.throws(() => parseEnv(input), /Invalid environment configuration/);
});
test("demo and private reports cannot corroborate each other; historical events are labeled", () => {
  assert.equal(clusterReports([make(1), make(2, { isDemo: true })]).length, 2);
  assert.equal(
    buildShortageEvents(
      [make(1)],
      [],
      config,
      new Date("2026-10-10T06:00:00Z"),
    )[0].status,
    "HISTORICAL",
  );
  assert.equal(
    buildShortageEvents([make(1)], [], config, DEMO_OBSERVED_AT)[0]
      .verifiedReportCount,
    0,
  );
});
test("deterministic multi-area demo derives four severity levels and emerging evidence", () => {
  const first = buildShortageEvents(demoReports(), demoAreas(), config);
  assert.equal(first.length, 5);
  assert.deepEqual(
    first,
    buildShortageEvents(
      [...demoReports()].reverse(),
      demoAreas(),
      config,
      new Date("2030-01-01"),
    ),
  );
  assert.deepEqual(
    new Set(first.map((e) => e.severityLevel)),
    new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  );
  const hero = first.find((e) => e.areaId === "AREA_01");
  assert.equal(hero.verifiedReportCount, 31);
  assert.equal(hero.eligibleReportCount, 37);
  assert.equal(hero.duplicateReportCount, 2);
  assert.equal(hero.suspiciousReportCount, 1);
  assert.equal(hero.severityLevel, "CRITICAL");
  assert.equal(first.find((e) => e.areaId === "AREA_05").status, "EMERGING");
  assert.ok(new Set(first.map((e) => e.confidenceScore)).size > 3);
  const changed = demoReports().map((r) => ({ ...r, waterLevel: "ABOVE_50" }));
  assert.ok(
    buildShortageEvents(changed, demoAreas(), config).find(
      (e) => e.areaId === "AREA_01",
    ).severityScore < hero.severityScore,
  );
});
test("fairness helpers require actual delivery evidence and never invent missing history", () => {
  assert.equal(calculatePreviousDeliveryPenalty(null, 10000), null);
  assert.equal(calculateAllocationPriority(90, null), null);
  assert.equal(calculatePreviousDeliveryPenalty(30000, 10000), 100);
  assert.equal(calculateAllocationPriority(90, 100), 75);
  assert.equal(calculateAllocationPriority(85, 0), 85);
});
