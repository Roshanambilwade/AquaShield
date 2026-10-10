import { loadEnv } from "../config/env.js";

// Parse only: no database connection, index creation, writes or model calls.
if (process.argv.includes("--production")) process.env.NODE_ENV = "production";
try {
  const config = loadEnv();
  console.info(
    JSON.stringify({
      event: "CONFIGURATION_VALID",
      mode: config.NODE_ENV,
      aiConfigured: Boolean(
        config.AI_PROVIDER === "gemini" &&
        config.GEMINI_API_KEY &&
        config.GEMINI_MODEL_ID,
      ),
      aiAvailability: "NOT_PROBED",
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
