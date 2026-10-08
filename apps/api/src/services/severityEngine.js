import { detectionConfig } from "../config/detection.js";
import { clamp, round } from "./geography.js";

const normalized = (value, maximum) =>
  value == null ? null : clamp((value / maximum) * 100);
export const calculateDurationScore = (hours, config = detectionConfig()) =>
  normalized(hours, config.SEVERITY_DURATION_MAX_HOURS);
export const calculatePopulationScore = (people, config = detectionConfig()) =>
  normalized(people, config.SEVERITY_POPULATION_MAX);
export const calculateWaterLevelScore = (level) =>
  ({ EMPTY: 100, LESS_THAN_25: 90, BETWEEN_25_50: 60, ABOVE_50: 20 })[level] ??
  null;
export function calculateEnvironmentalScore(
  temperature,
  config = detectionConfig(),
) {
  return temperature == null
    ? null
    : clamp(
        ((temperature - config.SEVERITY_TEMPERATURE_MIN_C) /
          (config.SEVERITY_TEMPERATURE_MAX_C -
            config.SEVERITY_TEMPERATURE_MIN_C)) *
          100,
      );
}
export const calculateVulnerabilityScore = (
  ratio,
  config = detectionConfig(),
) => normalized(ratio, config.SEVERITY_VULNERABILITY_MAX_RATIO);
export const calculateConfidenceScore = (confidence) =>
  confidence == null ? null : clamp(confidence);
export function calculateSeverityLevel(score, config = detectionConfig()) {
  if (!Number.isFinite(score)) throw new Error("Severity must be finite.");
  const { medium, high, critical } = config.SEVERITY_THRESHOLDS;
  return score >= critical
    ? "CRITICAL"
    : score >= high
      ? "HIGH"
      : score >= medium
        ? "MEDIUM"
        : "LOW";
}

export function calculateSeverityScore(input, config = detectionConfig()) {
  const scores = {
    duration: calculateDurationScore(input.durationHours, config),
    population: calculatePopulationScore(
      input.estimatedAffectedPopulation,
      config,
    ),
    waterLevel:
      input.waterLevelScore ?? calculateWaterLevelScore(input.waterLevel),
    environmental: calculateEnvironmentalScore(input.temperatureC, config),
    vulnerability: calculateVulnerabilityScore(input.vulnerableRatio, config),
    confidence: calculateConfidenceScore(input.confidenceScore),
  };
  const components = Object.entries(scores).map(([name, score]) => ({
    name,
    score: score == null ? null : round(clamp(score)),
    weight: config.SEVERITY_WEIGHTS[name],
    contribution:
      score == null
        ? 0
        : round((clamp(score) * config.SEVERITY_WEIGHTS[name]) / 100),
  }));
  const missingInputs = components
    .filter((c) => c.score == null && c.weight > 0)
    .map((c) => c.name);
  // Unknown inputs remain unknown; the displayed score is the known contribution,
  // with an upper bound if all missing inputs were maximally severe.
  const score = round(
    Object.entries(scores).reduce(
      (sum, [name, value]) =>
        sum +
        (value == null
          ? 0
          : (clamp(value) * config.SEVERITY_WEIGHTS[name]) / 100),
      0,
    ),
  );
  const upperBound = round(
    Math.min(
      100,
      score +
        components
          .filter((c) => c.score == null)
          .reduce((sum, c) => sum + c.weight, 0),
    ),
  );
  return {
    score,
    level: calculateSeverityLevel(score, config),
    upperBound,
    missingInputs,
    components,
    complete: missingInputs.length === 0,
  };
}
