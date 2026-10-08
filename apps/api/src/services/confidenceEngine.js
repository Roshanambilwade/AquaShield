import { detectionConfig } from "../config/detection.js";
import { distanceKm, clamp, round } from "./geography.js";

// Different browser keys are independent submissions, not verified identities.
export function calculateEventConfidence(
  reports,
  { infrastructureCorrelated = false } = {},
  config = detectionConfig(),
) {
  if (!reports.length) return { score: 0, components: [] };
  const problems = {};
  for (const report of reports)
    problems[report.problem] = (problems[report.problem] || 0) + 1;
  const independentCount = new Set(reports.map((r) => r.reporterKeyHash)).size;
  const times = reports.map((r) => new Date(r.createdAt).getTime());
  const spanHours = (Math.max(...times) - Math.min(...times)) / 3600000;
  let diameter = 0;
  for (const a of reports)
    for (const b of reports)
      diameter = Math.max(diameter, distanceKm(a.location, b.location));
  const precision =
    reports.filter(
      (r) =>
        r.locationSource !== "LOCALITY_CENTER" &&
        (r.accuracyMeters == null ||
          r.accuracyMeters <= config.CLUSTER_RADIUS_KM * 1000),
    ).length / reports.length;
  const scores = {
    consistency: (Math.max(...Object.values(problems)) / reports.length) * 100,
    geographic:
      reports.length < 2
        ? 0
        : clamp(100 - (diameter / config.CLUSTER_RADIUS_KM) * 50) *
          (0.5 + precision * 0.5),
    independent: clamp(
      (independentCount / config.CONFIDENCE_INDEPENDENT_TARGET) * 100,
    ),
    infrastructure: infrastructureCorrelated ? 100 : 0,
    time:
      reports.length < 2
        ? 0
        : clamp(100 - (spanHours / config.CLUSTER_TIME_WINDOW_HOURS) * 50),
  };
  const components = Object.entries(scores).map(([name, score]) => ({
    name,
    score: round(score),
    weight: config.CONFIDENCE_WEIGHTS[name],
    contribution: round((score * config.CONFIDENCE_WEIGHTS[name]) / 100),
  }));
  return {
    score: round(
      Object.entries(scores).reduce(
        (sum, [name, score]) =>
          sum + (score * config.CONFIDENCE_WEIGHTS[name]) / 100,
        0,
      ),
    ),
    components,
    independentCount,
    diameterKm: round(diameter),
    timeSpanHours: round(spanHours),
    preciseLocationFraction: round(precision),
  };
}
