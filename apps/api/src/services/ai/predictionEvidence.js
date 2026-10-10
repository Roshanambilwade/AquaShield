import { createHash } from "node:crypto";
import { loadEvidence } from "./evidence.js";
import { predictionSummary } from "../predictionService.js";

// Optional explanation of an already persisted computation. Never evaluate here.
export async function loadPredictionEvidence(config, input) {
  const facts = await loadEvidence(config, input);
  const result = await predictionSummary(config, input.demo);
  return attachPredictionEvidence(facts, result);
}
export function attachPredictionEvidence(facts, summary) {
  const selected = facts.zones.find((z) => z.ref === facts.selectedRef);
  const result = summary.results.find((r) => r.areaId === selected?.areaId);
  const usable = result?.retrievalStatus === "CURRENT" && result.forecast;
  const next = {
    ...facts,
    risk: usable
      ? {
          target: result.target,
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          horizonHours: result.horizonHours,
          forecast: result.forecast,
          uncertainty: result.uncertainty,
          modelVersion: result.modelVersion,
          observationWindow: result.observationWindow,
          generatedAt: result.generatedAt,
          provenance: result.provenance,
          factors: result.factors,
          limitations: result.limitations,
        }
      : null,
    predictionStatus: result?.riskLevel ?? "INSUFFICIENT_DATA",
    missingInputs: usable
      ? facts.missingInputs.filter(
          (v) =>
            v !== "Deterministic risk model and historical supply/trend series",
        )
      : facts.missingInputs,
    trendLimitations:
      "Predictions concern report activity, not water depletion. Risk is an uncalibrated index, never a probability.",
  };
  delete next.evidenceVersion;
  return {
    ...next,
    evidenceVersion: createHash("sha256")
      .update(JSON.stringify(next))
      .digest("hex"),
  };
}
