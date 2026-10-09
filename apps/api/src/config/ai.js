import { z } from "zod";
import { ApiError } from "../middleware/errors.js";

export const aiSchema = z.object({
  AI_PROVIDER: z.string().trim().max(40).default("gemini"),
  GEMINI_API_KEY: z.string().trim().max(512).default(""),
  GEMINI_MODEL_ID: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._/-]*$/)
    .max(120)
    .default(""),
  DEMO_AI_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  AI_FAIRNESS_MAX_ADJUSTMENT: z.coerce.number().min(0).max(30).default(15),
});

export function aiStatus(config) {
  if (config.DEMO_AI_MODE)
    return {
      status: config.NODE_ENV === "production" ? "DEMO_DISABLED" : "DEMO",
      message: "Demo AI simulation — no Gemini execution.",
    };
  if (
    config.AI_PROVIDER !== "gemini" ||
    !config.GEMINI_API_KEY ||
    !config.GEMINI_MODEL_ID
  )
    return {
      status: "NOT_CONFIGURED",
      message:
        "Set backend AI_PROVIDER=gemini, GEMINI_API_KEY and GEMINI_MODEL_ID, or enable DEMO_AI_MODE locally.",
    };
  return {
    status: "READY",
    message: "Gemini via Strands · execution occurs only when requested.",
  };
}

export function requireAiConfiguration(config) {
  const status = aiStatus(config);
  if (status.status === "DEMO_DISABLED")
    throw new ApiError(
      403,
      "DEMO_DISABLED",
      "Demo AI is disabled in production.",
    );
  if (status.status === "NOT_CONFIGURED")
    throw new ApiError(503, "AI_NOT_CONFIGURED", status.message);
}
