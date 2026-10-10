import { loadEnv } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { createApp } from "./app.js";
import { startRuntime, runtimeLog } from "./runtime.js";

try {
  const config = loadEnv();
  startRuntime(config, {
    app: createApp(config),
    connect: connectDatabase,
    disconnect: disconnectDatabase,
  });
} catch (error) {
  const configurationError = error.message.startsWith(
    "Invalid environment configuration:",
  );
  runtimeLog(
    configurationError ? "CONFIGURATION_INVALID" : "API_STARTUP_FAILED",
  );
  if (configurationError) console.error(error.message); // Field names only.
  process.exitCode = 1;
}
