import { loadEnv } from "../config/env.js";
import { buildShortageEvents } from "../services/reportClusteringService.js";
import { demoReports, DEMO_OBSERVED_AT } from "../demo/reports.js";
import { demoAreas } from "../demo/areas.js";
import { buildEvidence } from "../services/ai/evidence.js";
import { runAgent } from "../services/ai/agentService.js";
import { GoogleGenAI } from "@google/genai";
import { sanitizeProviderError } from "../services/ai/providerErrors.js";
import { invokeGemini } from "../services/ai/provider.js";
import { requireAiConfiguration } from "../config/ai.js";
import { ApiError } from "../middleware/errors.js";
import { directDiagnostic } from "../services/ai/directDiagnostic.js";
import { roles } from "../services/ai/contracts.js";
import { buildAllocationEvidence } from "../services/ai/allocationEvidence.js";
import { rankAllocationEvents } from "../services/allocationEngine.js";

// Explicit live smoke command. Uses only fictional evidence and no database.
const config = { ...loadEnv(), DEMO_AI_MODE: false };
const role =
  process.argv.find((arg) => arg.startsWith("--role="))?.slice(7) || "detect";
if (!Object.hasOwn(roles, role))
  throw new Error("Choose --role=detect|allocate|logistics|predict.");
const startedAt = Date.now();
let stage = "CONFIGURATION";
console.log(
  JSON.stringify({
    stage,
    provider: config.AI_PROVIDER,
    model: config.GEMINI_MODEL_ID,
    keyConfigured: Boolean(config.GEMINI_API_KEY),
    realMode: !config.DEMO_AI_MODE,
    timeoutMs: config.AI_TIMEOUT_MS,
  }),
);
if (!config.GEMINI_API_KEY || !config.GEMINI_MODEL_ID) {
  console.log(
    "SKIPPED: set backend GEMINI_API_KEY and GEMINI_MODEL_ID to verify a real Strands/Gemini request. Live execution remains unverified.",
  );
} else {
  try {
    requireAiConfiguration(config);
    if (
      process.argv.includes("--direct") ||
      process.argv.includes("--direct-stream")
    ) {
      stage = "DIRECT_GOOGLE_DIAGNOSTIC";
      const directClient = new GoogleGenAI({
        apiKey: config.GEMINI_API_KEY,
        httpOptions: { timeout: config.AI_TIMEOUT_MS },
      });
      const result = await directDiagnostic(directClient, config, {
        stream: process.argv.includes("--direct-stream"),
        progress: (event) => console.log(JSON.stringify({ stage, ...event })),
      });
      console.log(
        JSON.stringify({
          status: "DIRECT_DIAGNOSTIC_COMPLETE",
          stage,
          ...result,
        }),
      );
    } else {
      // A bounded, separate metadata request verifies endpoint/model access before
      // generation. It does not share or shorten the agent's generation deadline.
      stage = "MODEL_PREFLIGHT";
      const client = new GoogleGenAI({
        apiKey: config.GEMINI_API_KEY,
        httpOptions: {
          timeout: Math.min(config.AI_TIMEOUT_MS, 10000),
        },
      });
      await client.models.get({
        model: config.GEMINI_MODEL_ID,
      });
      console.log(
        JSON.stringify({
          stage,
          status: "GOOGLE_MODEL_ACCESS_CONFIRMED",
          model: config.GEMINI_MODEL_ID,
        }),
      );
      stage = "STRANDS_GENERATION";
      const generationClient = new GoogleGenAI({
        apiKey: config.GEMINI_API_KEY,
        httpOptions: { timeout: config.AI_TIMEOUT_MS },
      });
      const events = buildShortageEvents(
        demoReports(),
        demoAreas(),
        config,
        DEMO_OBSERVED_AT,
      ).map((event, i) => ({ ...event, id: `synthetic-${i}` }));
      const crisisFacts = buildEvidence(
        events,
        { tankers: null, deliveries: null },
        config,
        { demo: true },
      );
      const facts =
        role === "allocate"
          ? buildAllocationEvidence(
              {
                events,
                rankings: rankAllocationEvents(events, [], config),
                candidates: [],
                excluded: [],
                proposedLitres: null,
                isDemo: true,
              },
              config,
            )
          : crisisFacts;
      const generationStarted = Date.now();
      const result = await runAgent(
        role,
        config,
        { demo: true },
        {
          evidenceLoader: async () => facts,
          invoke: (args) =>
            invokeGemini({
              ...args,
              client: generationClient,
              progress: (event) =>
                console.log(JSON.stringify({ stage, ...event })),
            }),
        },
      );
      console.log(
        JSON.stringify({
          status: "VERIFIED_REAL_GEMINI",
          agent: result.agent,
          generationLatencyMs: Date.now() - generationStarted,
          validation: "PASSED",
          execution: result.execution,
          evidenceVersion: result.facts.evidenceVersion,
          humanReview: result.humanReview,
        }),
      );
    }
  } catch (error) {
    const safe =
      error instanceof ApiError ? error : sanitizeProviderError(error);
    console.error(
      JSON.stringify({
        status: "LIVE_VERIFICATION_FAILED",
        stage,
        elapsedMs: Date.now() - startedAt,
        code: safe.code,
        ...safe.details,
      }),
    );
    process.exitCode = 1;
  }
}
