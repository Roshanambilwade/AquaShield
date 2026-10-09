import { randomUUID } from "node:crypto";
import { requireAiConfiguration } from "../../config/ai.js";
import { ApiError } from "../../middleware/errors.js";
import { loadEvidence } from "./evidence.js";
import { roles, validateAdvice } from "./contracts.js";
import { demoAdvice } from "./demo.js";
import { PROMPT_VERSION } from "./prompts.js";
import { sanitizeProviderError } from "./providerErrors.js";

export async function runAgent(
  role,
  config,
  input,
  { evidenceLoader = loadEvidence, invoke, signal } = {},
) {
  if (!roles[role])
    throw new ApiError(422, "VALIDATION_ERROR", "Unknown agent role.");
  requireAiConfiguration(config);
  const facts =
    role === "allocate" && evidenceLoader === loadEvidence
      ? (await import("./allocationEvidence.js")).buildAllocationEvidence(
          await (
            await import("../operationsService.js")
          ).allocationSnapshot(config, input.demo),
          config,
        )
      : await evidenceLoader(config, input);
  if (signal?.aborted)
    throw new ApiError(499, "AI_CANCELLED", "The assessment was cancelled.");
  let raw;
  if (config.DEMO_AI_MODE) raw = demoAdvice(role, facts);
  else {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    let timer;
    try {
      const provider = invoke || (await import("./provider.js")).invokeGemini;
      if (signal?.aborted) controller.abort();
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new ApiError(
              504,
              "AI_TIMEOUT",
              "The agent took too long. Please retry.",
              { category: "AGENT_DEADLINE" },
            ),
          );
          // Settle the explicit deadline before cancellation can cause an SDK
          // cancelled/invalid-output result to race the timeout classification.
          controller.abort();
        }, config.AI_TIMEOUT_MS);
      });
      raw = await Promise.race([
        provider({ config, role, facts, signal: controller.signal }),
        timeout,
      ]);
    } catch (error) {
      if (
        error instanceof ApiError &&
        ["AI_TIMEOUT", "AI_INVALID_OUTPUT"].includes(error.code)
      )
        throw error;
      throw sanitizeProviderError(error);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }
  const advice = validateAdvice(raw, role, facts);
  return {
    requestId: randomUUID(),
    generatedAt: new Date().toISOString(),
    agent: roles[role],
    role,
    execution: {
      mode: config.DEMO_AI_MODE ? "DEMO_SIMULATION" : "REAL_GEMINI",
      isDemo: config.DEMO_AI_MODE,
      providerExecuted: !config.DEMO_AI_MODE,
      framework: config.DEMO_AI_MODE ? null : "Strands Agents SDK",
      provider: config.DEMO_AI_MODE ? null : "Google Gemini",
      model: config.DEMO_AI_MODE ? null : config.GEMINI_MODEL_ID,
      promptVersion: PROMPT_VERSION,
    },
    facts,
    advice,
    recommendationConfidence: null,
    humanReview: "REQUIRED",
    approved: false,
  };
}
