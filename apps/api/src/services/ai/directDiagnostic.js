import { ApiError } from "../../middleware/errors.js";

// Synthetic prompt only; return counters, never generated text or raw errors.
export async function directDiagnostic(
  client,
  config,
  { stream = false, progress = () => {} } = {},
) {
  const controller = new AbortController();
  let timer;
  const startedAt = Date.now();
  const request = {
    model: config.GEMINI_MODEL_ID,
    contents: "Reply with the word OK only.",
    config: { maxOutputTokens: 128, abortSignal: controller.signal },
  };
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ApiError(
          504,
          "AI_TIMEOUT",
          "The direct Google diagnostic exceeded its deadline.",
          {
            category: "PROVIDER_OR_NETWORK_TIMEOUT",
            deadlineSource: "DIRECT_DIAGNOSTIC",
          },
        ),
      );
      controller.abort();
    }, config.AI_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        if (!stream) {
          const result = await client.models.generateContent(request);
          return {
            elapsedMs: Date.now() - startedAt,
            responseReceived: true,
            textPresent: Boolean(result.text),
            mode: "DIRECT_UNARY",
          };
        }
        const response = await client.models.generateContentStream(request);
        progress({
          progress: "GOOGLE_STREAM_OPENED",
          elapsedMs: Date.now() - startedAt,
        });
        let chunks = 0;
        let textPresent = false;
        for await (const chunk of response) {
          chunks++;
          textPresent ||= Boolean(chunk.text);
          if (chunks === 1)
            progress({
              progress: "GOOGLE_FIRST_CHUNK_RECEIVED",
              elapsedMs: Date.now() - startedAt,
            });
        }
        return {
          elapsedMs: Date.now() - startedAt,
          responseReceived: true,
          textPresent,
          chunks,
          mode: "DIRECT_STREAM",
        };
      })(),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
