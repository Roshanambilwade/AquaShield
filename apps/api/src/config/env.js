import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { detectionSchema } from "./detection.js";
import { aiSchema } from "./ai.js";
import { operationsSchema } from "./operations.js";

const rootEnvPath = fileURLToPath(new URL("../../../../.env", import.meta.url));

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    MONGODB_TEST_DB_NAME: z
      .string()
      .regex(/^aquashield_[a-z0-9_]+_[a-f0-9]{32}$/)
      .optional(),
    ADMIN_SESSION_HOURS: z.coerce.number().min(0.1).max(24).default(8),
    PUBLIC_MIN_HOUSEHOLDS: z.coerce.number().int().min(3).max(100).default(5),
    PUBLIC_LOCATION_GRID_DEGREES: z.coerce
      .number()
      .min(0.01)
      .max(1)
      .default(0.02),
    DETECTION_REFRESH_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(60000)
      .default(15000),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(?:\+srv)?:\/\/\S+$/, "Use a MongoDB connection URI")
      .default("mongodb://127.0.0.1:27017/aquashield"),
    MONGODB_CONNECT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(60000)
      .default(5000),
    MONGODB_RETRY_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(60000)
      .default(5000),
    CORS_ORIGIN: z
      .string()
      .transform((value) => value.split(",").map((origin) => origin.trim()))
      .pipe(
        z
          .array(
            z
              .string()
              .url()
              .refine((value) => {
                try {
                  const url = new URL(value);
                  return (
                    ["http:", "https:"].includes(url.protocol) &&
                    url.origin === value
                  );
                } catch {
                  return false;
                }
              }, "Use an exact HTTP(S) origin without a trailing slash"),
          )
          .min(1),
      ),
  })
  .and(detectionSchema)
  .and(aiSchema)
  .and(operationsSchema);

export function parseEnv(source) {
  // Explicit lists always win. Local defaults apply only outside production.
  const result = schema.safeParse({
    ...source,
    CORS_ORIGIN:
      source.CORS_ORIGIN ??
      (source.NODE_ENV === "production"
        ? undefined
        : "http://localhost:5173,http://127.0.0.1:5173"),
  });
  if (!result.success) {
    // Report field names, never environment values that may contain credentials.
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  return Object.freeze(result.data);
}

export function loadEnv() {
  dotenv.config({ path: rootEnvPath, quiet: true });
  return parseEnv(process.env);
}
