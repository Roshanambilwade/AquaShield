import { loadEvidence } from "../services/ai/evidence.js";
import { buildAllocationEvidence } from "../services/ai/allocationEvidence.js";
import { loadLogisticsEvidence } from "../services/ai/logisticsEvidence.js";
import { allocationSnapshot } from "../services/operationsService.js";
import { assertSeedTarget } from "../config/demonstration.js";
import { loadPredictionEvidence } from "../services/ai/predictionEvidence.js";

// Same allowlisted aggregates as the protected APIs. No citizen records or
// secrets enter the model prompt. A read never creates trips or dispatches water.
export async function persistedDemoAgentEvidence(role, config) {
  assertSeedTarget(config, true);
  if (role === "allocate")
    return buildAllocationEvidence(
      await allocationSnapshot(config, true),
      config,
    );
  if (role === "logistics")
    return loadLogisticsEvidence(config, { demo: true });
  if (role === "predict") return loadPredictionEvidence(config, { demo: true });
  return loadEvidence(config, { demo: true });
}
