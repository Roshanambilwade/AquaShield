import { ApiError } from "../../middleware/errors.js";

const finishReasons = new Set([
  "STOP",
  "MAX_TOKENS",
  "SAFETY",
  "RECITATION",
  "OTHER",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "MALFORMED_FUNCTION_CALL",
  "UNEXPECTED_TOOL_CALL",
  "FINISH_REASON_UNSPECIFIED",
]);
const usageFields = [
  "promptTokenCount",
  "candidatesTokenCount",
  "thoughtsTokenCount",
  "totalTokenCount",
  "toolUsePromptTokenCount",
  "cachedContentTokenCount",
];

// Only fixed labels, lengths and numerical usage. Never contents, arguments,
// model reasoning, keys, headers, provider messages or unknown tool names.
export function observeGoogleStream(client, progress = () => {}) {
  let requests = 0;
  return {
    models: {
      async *generateContentStream(request) {
        const requestNumber = ++requests;
        const started = Date.now();
        const tools = new Set();
        const usage = {};
        let chunks = 0;
        let finishReason = null;
        progress({
          progress: "GOOGLE_GENERATION_REQUEST_STARTED",
          requestNumber,
          maxOutputTokens: request.config?.maxOutputTokens ?? null,
          inputCharacters: JSON.stringify(request.contents ?? []).length,
        });
        const stream = await client.models.generateContentStream(request);
        progress({ progress: "GOOGLE_STREAM_OPENED", requestNumber });
        for await (const chunk of stream) {
          chunks++;
          if (chunks === 1)
            progress({
              progress: "GOOGLE_FIRST_CHUNK_RECEIVED",
              requestNumber,
            });
          for (const field of usageFields) {
            const value = chunk.usageMetadata?.[field];
            if (Number.isSafeInteger(value) && value >= 0) usage[field] = value;
          }
          const candidate = chunk.candidates?.[0];
          if (
            candidate?.finishReason &&
            candidate.finishReason !== "FINISH_REASON_UNSPECIFIED"
          )
            finishReason = finishReasons.has(candidate.finishReason)
              ? candidate.finishReason
              : "UNKNOWN";
          for (const part of candidate?.content?.parts ?? []) {
            if (part.functionCall)
              tools.add(
                part.functionCall.name === "get_shortage_evidence"
                  ? "EVIDENCE_READ"
                  : part.functionCall.name === "strands_structured_output"
                    ? "STRUCTURED_OUTPUT"
                    : "OTHER",
              );
          }
          const summary = () => ({
            progress: "GOOGLE_GENERATION_FINISHED",
            requestNumber,
            finishReason,
            chunks,
            elapsedMs: Date.now() - started,
            toolCalls: [...tools],
            usage,
          });
          // The installed adapter prioritizes toolUse over MAX_TOKENS. Reject here
          // even if a partial function call happens to contain parseable JSON.
          if (finishReason === "MAX_TOKENS") {
            progress(summary());
            throw new ApiError(
              502,
              "AI_INVALID_OUTPUT",
              "Google reached its per-request output limit before completing the assessment.",
              {
                category: "MODEL_OUTPUT_LIMIT",
                providerFinishReason: "MAX_TOKENS",
                usage: { ...usage },
              },
            );
          }
          yield chunk;
        }
        progress({
          progress: "GOOGLE_GENERATION_FINISHED",
          requestNumber,
          finishReason,
          chunks,
          elapsedMs: Date.now() - started,
          toolCalls: [...tools],
          usage,
        });
        if (!finishReason)
          throw new ApiError(
            502,
            "AI_INVALID_OUTPUT",
            "The provider stream ended without a completion reason.",
            { category: "PROVIDER_STREAM_INCOMPLETE" },
          );
      },
    },
  };
}
