import { Agent, tool, configureLogging } from "@strands-agents/sdk";
import { GoogleModel } from "@strands-agents/sdk/models/google";
import { z } from "zod";
import { roles, adviceSchema, invalidOutput } from "./contracts.js";
import { agentPrompt } from "./prompts.js";
import { modelEvidence } from "./evidence.js";
import { GoogleGenAI } from "@google/genai";
import { observeGoogleStream } from "./streamDiagnostics.js";

// SDK diagnostics can contain prompts/provider errors. Expose only sanitized
// service errors; never print raw SDK messages, tools or model output.
configureLogging({ debug() {}, info() {}, warn() {}, error() {} });

export function createGeminiAgent(
  config,
  role,
  facts,
  signal,
  client,
  progress,
) {
  const snapshot = JSON.stringify(modelEvidence(facts));
  const model = new GoogleModel({
    apiKey: config.GEMINI_API_KEY,
    modelId: config.GEMINI_MODEL_ID,
    client: observeGoogleStream(
      client ||
        new GoogleGenAI({
          apiKey: config.GEMINI_API_KEY,
          httpOptions: { timeout: config.AI_TIMEOUT_MS },
        }),
      progress,
    ),
    clientConfig: {
      httpOptions: {
        timeout: config.AI_TIMEOUT_MS,
        // In @google/genai 2.6.0, omitting retryOptions uses one fetch and
        // preserves HTTP ApiError status. attempts:1 discards status/payload
        // in the retry wrapper, masking auth, model and quota failures.
      },
    },
    params: {
      temperature: 0.1,
      maxOutputTokens: 3000,
      abortSignal: signal,
    },
  });
  return new Agent({
    name: roles[role],
    model,
    systemPrompt: agentPrompt(role),
    printer: false,
    retryStrategy: null,
    contextManager: false,
    tools: [
      tool({
        name: "get_shortage_evidence",
        description:
          "Read the authorized immutable aggregate evidence snapshot. No mutations or new database access.",
        inputSchema: z.object({}).strict(),
        callback: () => snapshot,
      }),
    ],
    structuredOutputSchema: adviceSchema,
  });
}

export async function invokeGemini({
  config,
  role,
  facts,
  signal,
  client,
  progress,
}) {
  const agent = createGeminiAgent(
    config,
    role,
    facts,
    signal,
    client,
    progress,
  );
  try {
    const result = await agent.invoke(
      `Assess this backend snapshot, also available from get_shortage_evidence: ${JSON.stringify(modelEvidence(facts))}`,
      {
        cancelSignal: signal,
        limits: { turns: 3, outputTokens: 6000 },
      },
    );
    // Strands returns toolUse when its structured-output tool completes.
    if (
      !["toolUse", "endTurn"].includes(result.stopReason) ||
      !result.structuredOutput
    )
      throw invalidOutput();
    return result.structuredOutput;
  } finally {
    await agent.shutdown();
  }
}
