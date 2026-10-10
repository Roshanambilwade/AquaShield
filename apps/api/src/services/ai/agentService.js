import { randomUUID } from "node:crypto";
import { requireAiConfiguration } from "../../config/ai.js";
import { ApiError } from "../../middleware/errors.js";
import { loadEvidence } from "./evidence.js";
import { roles, validateAdvice } from "./contracts.js";
import { demoAdvice } from "./demo.js";
import { PROMPT_VERSION } from "./prompts.js";
import { sanitizeProviderError } from "./providerErrors.js";
import { aiReliability } from "./reliability.js";
import { ruleBasedAssessment } from "./ruleBased.js";

export async function runAgent(
  role,
  config,
  input,
  {
    evidenceLoader = loadEvidence,
    invoke,
    signal,
    allowFallback = false,
    reliability = aiReliability(config),
  } = {},
) {
  if (!roles[role])
    throw new ApiError(422, "VALIDATION_ERROR", "Unknown agent role.");
  const requestId = randomUUID();
  let unavailable;
  try {
    requireAiConfiguration(config);
  } catch (error) {
    if (!allowFallback || error.code !== "AI_NOT_CONFIGURED") throw error;
    unavailable = error;
  }
  const facts =
    role === "allocate" && evidenceLoader === loadEvidence
      ? (await import("./allocationEvidence.js")).buildAllocationEvidence(
          await (
            await import("../operationsService.js")
          ).allocationSnapshot(config, input.demo),
          config,
        )
      : role === "logistics" && evidenceLoader === loadEvidence
        ? await (
            await import("./logisticsEvidence.js")
          ).loadLogisticsEvidence(config, input)
        : await evidenceLoader(config, input);
  if (signal?.aborted)
    throw new ApiError(499, "AI_CANCELLED", "The assessment was cancelled.");
  let advice,
    attempts = 0,
    circuitState = "CLOSED",
    assessmentStatus = "REVIEW_REQUIRED";
  if (config.DEMO_AI_MODE)
    advice = validateAdvice(demoAdvice(role, facts), role, facts);
  else if (!unavailable) {
    try {
      const provider = invoke || (await import("./provider.js")).invokeGemini;
      const result = await reliability.execute(
        async ({ signal: attemptSignal, timeoutMs }) => {
          const raw = await provider({
            config: { ...config, AI_TIMEOUT_MS: timeoutMs },
            role,
            facts,
            signal: attemptSignal,
          });
          return validateAdvice(raw, role, facts);
        },
        { signal, requestId, role },
      );
      advice = result.value;
      attempts = result.attempts;
      circuitState = result.circuitState;
    } catch (error) {
      if (error.code === "AI_CANCELLED" || signal?.aborted)
        throw new ApiError(
          499,
          "AI_CANCELLED",
          "The assessment was cancelled.",
        );
      const safe =
        error instanceof ApiError ? error : sanitizeProviderError(error);
      if (!allowFallback) throw safe;
      unavailable = safe;
    }
  }
  if (unavailable) {
    ({ advice, assessmentStatus } = ruleBasedAssessment(role, facts));
    attempts = unavailable.details?.attempts ?? 0;
    circuitState = reliability.snapshot().state;
    console.info(
      JSON.stringify({
        event: "AI_RULE_BASED_ASSESSMENT",
        requestId,
        role,
        reasonCode: unavailable.code,
        attempts,
        circuitState,
      }),
    );
  }
  return {
    requestId,
    generatedAt: new Date().toISOString(),
    agent: roles[role],
    role,
    execution: {
      mode: config.DEMO_AI_MODE
        ? "DEMO_SIMULATION"
        : unavailable
          ? "RULE_BASED"
          : "REAL_GEMINI",
      method: config.DEMO_AI_MODE
        ? "DEMO"
        : unavailable
          ? "RULE_BASED"
          : "GEMINI",
      isDemo: config.DEMO_AI_MODE,
      providerExecuted: !config.DEMO_AI_MODE && !unavailable,
      providerAttempted: attempts > 0,
      aiAnalysisCompleted: !config.DEMO_AI_MODE && !unavailable,
      providerStatus: config.DEMO_AI_MODE
        ? "NOT_REQUESTED"
        : unavailable?.code || "AVAILABLE",
      fallbackReasonCode: unavailable?.code ?? null,
      attempts,
      circuitState,
      framework:
        config.DEMO_AI_MODE || unavailable ? null : "Strands Agents SDK",
      provider: config.DEMO_AI_MODE || unavailable ? null : "Google Gemini",
      model: config.DEMO_AI_MODE || unavailable ? null : config.GEMINI_MODEL_ID,
      promptVersion: PROMPT_VERSION,
    },
    facts,
    advice,
    assessmentStatus,
    recommendationConfidence: null,
    humanReview: "REQUIRED",
    approved: false,
  };
}
