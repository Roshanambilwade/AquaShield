import { createHash } from "node:crypto";
import { predictionConfig } from "../config/prediction.js";
import { detectionConfig } from "../config/detection.js";
import { detectDuplicatesAndSuspicious } from "./reportClusteringService.js";
import { median } from "./geography.js";

export const PREDICTION_MODEL_VERSION = "report-activity-ewma-v1";
export const PREDICTION_TARGET = "ELIGIBLE_REPORT_ACTIVITY";
const HOUR = 3600000;
const bounded = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 100) / 100;
export const fingerprint = (v) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function classifyRisk(score, source = {}) {
  if (score == null) return "INSUFFICIENT_DATA";
  const c = predictionConfig(source);
  return score >= c.PREDICTION_CRITICAL_THRESHOLD
    ? "CRITICAL"
    : score >= c.PREDICTION_HIGH_THRESHOLD
      ? "HIGH"
      : score >= c.PREDICTION_MODERATE_THRESHOLD
        ? "MODERATE"
        : "LOW";
}
export function predictionSettings(source = {}) {
  const p = predictionConfig(source),
    d = detectionConfig(source);
  return {
    ...p,
    duplicateWindowHours: d.DUPLICATE_WINDOW_HOURS,
    duplicateRadiusKm: d.DUPLICATE_RADIUS_KM,
    clusterRadiusKm: d.CLUSTER_RADIUS_KM,
    suspiciousSpeedKmh: d.SUSPICIOUS_SPEED_KMH,
    durationConflictHours: d.DURATION_CONFLICT_HOURS,
  };
}
export function observationEnd(now, source = {}) {
  const width = predictionConfig(source).PREDICTION_WINDOW_HOURS * HOUR;
  return new Date(Math.floor(new Date(now).getTime() / width) * width);
}

// Pure calculation. No provider imports, IO, mutable clock or operational writes.
export function predictReportActivity(
  reports,
  {
    areaId,
    areaName,
    isDemo = false,
    now,
    source = {},
    truncated = false,
  } = {},
) {
  const c = predictionConfig(source),
    d = detectionConfig(source);
  const clock = new Date(now),
    end = observationEnd(clock, c),
    width = c.PREDICTION_WINDOW_HOURS * HOUR;
  if (!Number.isFinite(clock.getTime()) || !areaId)
    throw new Error("A valid observation clock and area are required.");
  const start = new Date(+end - width * c.PREDICTION_HISTORY_WINDOWS);
  const provenance = isDemo ? "SIMULATED_DEMO" : "RECORDED_CITIZEN_ACTIVITY";
  const inScope = reports.filter(
    (r) =>
      Boolean(r.isDemo) === isDemo &&
      +new Date(r.createdAt) >= +start - d.DUPLICATE_WINDOW_HOURS * HOUR &&
      +new Date(r.createdAt) < +end,
  );
  const invalid = inScope.filter(
    (r) =>
      !r.reporterKeyHash ||
      !Number.isFinite(r.location?.lat) ||
      !Number.isFinite(r.location?.lng) ||
      Math.abs(r.location.lat) > 90 ||
      Math.abs(r.location.lng) > 180,
  );
  // A later review is not evidence of verification/rejection at a historical cutoff.
  const atCutoff = inScope
    .filter((r) => !invalid.includes(r))
    .map((r) => ({
      ...r,
      verificationStatus:
        r.updatedAt && +new Date(r.updatedAt) > +clock
          ? "PENDING"
          : r.verificationStatus,
    }));
  const handling = detectDuplicatesAndSuspicious(
    atCutoff.filter((r) => r.verificationStatus !== "REJECTED"),
    d,
  );
  const eligible = handling.accepted.filter(
    (r) => r.areaId === areaId && +new Date(r.createdAt) >= +start,
  );
  const areaRows = inScope.filter(
    (r) => r.areaId === areaId && +new Date(r.createdAt) >= +start,
  );
  const excludedIds = new Set(
    [...handling.duplicates, ...handling.suspicious].map((r) => r.reportId),
  );
  const excludedCount = areaRows.filter(
    (r) =>
      excludedIds.has(String(r._id)) ||
      (r.verificationStatus === "REJECTED" &&
        (!r.updatedAt || +new Date(r.updatedAt) <= +clock)) ||
      invalid.includes(r),
  ).length;
  const observed = Array.from(
    { length: c.PREDICTION_HISTORY_WINDOWS },
    (_, i) => {
      const left = +start + i * width,
        right = left + width;
      const rows = eligible.filter(
        (r) => +new Date(r.createdAt) >= left && +new Date(r.createdAt) < right,
      );
      return {
        start: new Date(left).toISOString(),
        end: new Date(right).toISOString(),
        count: rows.length || null,
        verifiedCount: rows.filter((r) => r.verificationStatus === "VERIFIED")
          .length,
        observation: rows.length ? "REPORT_SAMPLED" : "UNKNOWN",
      };
    },
  );
  const latest = eligible.length
    ? Math.max(...eligible.map((r) => +new Date(r.createdAt)))
    : null;
  const quality = {
    sampleSize: eligible.length,
    distinctReporters: new Set(eligible.map((r) => r.reporterKeyHash)).size,
    verifiedCount: eligible.filter((r) => r.verificationStatus === "VERIFIED")
      .length,
    unverifiedCount: eligible.filter((r) => r.verificationStatus !== "VERIFIED")
      .length,
    excludedCount,
    invalidCount: invalid.filter((r) => r.areaId === areaId).length,
    coveredWindows: observed.filter((b) => b.count != null).length,
    totalWindows: observed.length,
    latestObservationAt: latest == null ? null : new Date(latest).toISOString(),
    ageHours: latest == null ? null : round((+clock - latest) / HOUR),
    freshness:
      latest == null
        ? "UNKNOWN"
        : (+clock - latest) / HOUR > c.PREDICTION_STALE_HOURS
          ? "STALE"
          : "RECENT",
    coverageMeaning:
      "Positive eligible reports sampled each window; collection uptime and unreported shortages are unknown.",
  };
  const missing = [];
  if (truncated) missing.push("HISTORY_READ_LIMIT");
  if (quality.invalidCount) missing.push("INVALID_EVIDENCE");
  if (quality.sampleSize < c.PREDICTION_MIN_REPORTS)
    missing.push("SMALL_SAMPLE");
  if (quality.distinctReporters < c.PREDICTION_MIN_REPORTERS)
    missing.push("TOO_FEW_INDEPENDENT_REPORTERS");
  if (quality.coveredWindows < quality.totalWindows)
    missing.push("MISSING_OBSERVATION_WINDOWS");
  if (quality.freshness !== "RECENT") missing.push("STALE_OR_MISSING_HISTORY");
  if (excludedCount / Math.max(areaRows.length, 1) > 0.5)
    missing.push("EXCESSIVE_EXCLUDED_EVIDENCE");
  const settings = predictionSettings(source);
  const base = {
    areaId,
    areaName,
    isDemo,
    provenance,
    target: PREDICTION_TARGET,
    horizonHours: c.PREDICTION_WINDOW_HOURS,
    generatedAt: clock.toISOString(),
    modelVersion: PREDICTION_MODEL_VERSION,
    configVersion: fingerprint(settings),
    settings,
    observationWindow: {
      start: start.toISOString(),
      end: end.toISOString(),
      windowHours: c.PREDICTION_WINDOW_HOURS,
    },
    quality,
    observed,
    reasons: missing,
    method: "DETERMINISTIC_BACKEND",
    explanationMethod: "RULE_BASED",
    limitations: [
      "Report activity is not physical water depletion or demand.",
      "Risk is an uncalibrated index, not a shortage probability.",
      "Reporting access and participation can bias activity; no municipal area is ranked by raw population or report volume.",
      "No water delivery is assumed to resolve a shortage.",
      "Sensitivity range is not a statistical confidence interval.",
    ],
  };
  if (missing.length)
    return {
      ...base,
      riskLevel: "INSUFFICIENT_DATA",
      riskScore: null,
      forecast: null,
      factors: null,
      uncertainty: { level: "UNAVAILABLE", reasons: missing },
      recommendedAction:
        "Collect independent, current reports across the missing observation windows; request municipal verification.",
    };
  const counts = observed.map((b) => b.count),
    midpoint = counts.length - 4;
  const cap = Math.max(1, median(counts) * 4);
  const clean = counts.map((v) => Math.min(v, cap));
  const baseline =
    clean.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
  const recent = clean.slice(midpoint);
  const ewma = recent.reduce((a, b) => 0.5 * b + 0.5 * a, baseline);
  const growth = (ewma - baseline) / Math.max(baseline, 1);
  const trend = bounded(growth, 0, 1);
  const persistence = recent.filter((v) => v >= baseline * 1.25).length / 4;
  const recurrence =
    clean.slice(0, midpoint).filter((v) => v >= baseline * 1.25).length /
    midpoint;
  const score = round(
    100 * (0.5 * trend + 0.35 * persistence + 0.15 * recurrence),
  );
  const estimate = bounded(ewma, 0, baseline * 2);
  const deviation =
    median(clean.map((v) => Math.abs(v - median(clean)))) /
    Math.max(median(clean), 1);
  const uncertaintyReasons = [
    "Participation and collection uptime are not measured.",
    "Outcomes are reports, not verified future physical shortages.",
  ];
  if (quality.verifiedCount / eligible.length < 0.5)
    uncertaintyReasons.push("Most sampled evidence is unverified.");
  if (deviation > 0.5)
    uncertaintyReasons.push(
      "Observed activity varies substantially between windows.",
    );
  if (counts.some((v) => v > cap))
    uncertaintyReasons.push(
      "Extreme counts were capped for calculation; recorded counts remain visible.",
    );
  return {
    ...base,
    riskScore: score,
    riskLevel: classifyRisk(score, c),
    factors: {
      baselineReportsPerWindow: round(baseline),
      recentEwmaReportsPerWindow: round(ewma),
      relativeChange: round(growth),
      trend: round(trend),
      persistence: round(persistence),
      recurrence: round(recurrence),
      outlierCap: round(cap),
      normalizedMedianDeviation: round(deviation),
      weights: { trend: 50, persistence: 35, recurrence: 15 },
    },
    forecast: {
      start: end.toISOString(),
      end: new Date(+end + width).toISOString(),
      estimatedEligibleReportCount: round(estimate),
      sensitivityRange: [
        round(Math.min(...recent, estimate)),
        round(Math.min(Math.max(...recent, estimate), baseline * 2)),
      ],
      kind: "APPROXIMATE_REPORT_ACTIVITY",
      notProbability: true,
    },
    uncertainty: {
      level: uncertaintyReasons.length > 2 ? "HIGH" : "MODERATE",
      reasons: uncertaintyReasons,
    },
    recommendedAction:
      score >= c.PREDICTION_HIGH_THRESHOLD
        ? "Prioritize municipal investigation of rising eligible report activity; verify supply conditions and review preparedness."
        : "Review report activity and gather independent supply evidence; continue authorized monitoring.",
  };
}

// Rolling-origin evaluation: the feature engine receives no reports after cutoff.
export function backtestActivity(reports, input) {
  const c = predictionConfig(input.source),
    width = c.PREDICTION_WINDOW_HOURS * HOUR,
    end = observationEnd(input.now, c);
  const samples = [],
    skipped = [];
  for (let i = 8; i >= 1; i--) {
    const cutoff = new Date(+end - width * i);
    const forecast = predictReportActivity(
      reports.filter((r) => +new Date(r.createdAt) < +cutoff),
      { ...input, now: cutoff },
    );
    const handling = detectDuplicatesAndSuspicious(
      reports.filter(
        (r) =>
          Boolean(r.isDemo) === input.isDemo &&
          (r.verificationStatus !== "REJECTED" ||
            +new Date(r.updatedAt) > +cutoff + width) &&
          r.reporterKeyHash &&
          Number.isFinite(r.location?.lat) &&
          Number.isFinite(r.location?.lng) &&
          +new Date(r.createdAt) < +cutoff + width &&
          +new Date(r.createdAt) >=
            +cutoff -
              (c.PREDICTION_HISTORY_WINDOWS * width +
                detectionConfig(input.source).DUPLICATE_WINDOW_HOURS * HOUR),
      ),
      detectionConfig(input.source),
    );
    const outcome = handling.accepted.filter(
      (r) => r.areaId === input.areaId && +new Date(r.createdAt) >= +cutoff,
    ).length;
    if (!forecast.forecast || !outcome || input.truncated) {
      skipped.push({
        cutoff: cutoff.toISOString(),
        reasons: forecast.reasons.length
          ? forecast.reasons
          : ["OUTCOME_OBSERVATION_UNKNOWN"],
      });
      continue;
    }
    samples.push({
      cutoff: cutoff.toISOString(),
      predicted: forecast.forecast.estimatedEligibleReportCount,
      observed: outcome,
      absoluteError: round(
        Math.abs(forecast.forecast.estimatedEligibleReportCount - outcome),
      ),
    });
  }
  return {
    target: PREDICTION_TARGET,
    modelVersion: PREDICTION_MODEL_VERSION,
    horizonHours: c.PREDICTION_WINDOW_HOURS,
    areaId: input.areaId,
    provenance: input.isDemo ? "SIMULATED_DEMO" : "RECORDED_CITIZEN_ACTIVITY",
    validationStatus:
      samples.length >= 3
        ? "REPORT_ACTIVITY_BACKTEST"
        : "INSUFFICIENT_VALIDATION_DATA",
    sampleCount: samples.length,
    meanAbsoluteError:
      samples.length >= 3
        ? round(
            samples.reduce((a, b) => a + b.absoluteError, 0) / samples.length,
          )
        : null,
    samples,
    skipped,
    period: {
      start: new Date(+end - width * 8).toISOString(),
      end: end.toISOString(),
    },
    limitation:
      "Retrospective report-activity error only. Review status history and collection uptime are incomplete; no physical shortage accuracy is claimed.",
  };
}
