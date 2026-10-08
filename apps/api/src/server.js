import { loadEnv } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { createApp } from "./app.js";

async function start() {
  let config;
  try {
    config = loadEnv();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const app = createApp(config);
  let stopping = false;
  let retryTimer;
  let connectionAttempt;
  const server = app.listen(config.PORT, () => {
    console.info(`AquaShield API listening on http://localhost:${config.PORT}`);
  });

  server.on("error", () => {
    console.error(
      "Could not start the API. Check PORT and whether it is already in use.",
    );
    void shutdown(1);
  });

  async function tryConnect() {
    try {
      await connectDatabase(config);
      console.info("MongoDB connected.");
    } catch {
      if (!stopping) {
        console.warn(
          "MongoDB unavailable. Health returns 503; connection will be retried.",
        );
        retryTimer = setTimeout(() => {
          connectionAttempt = tryConnect();
        }, config.MONGODB_RETRY_INTERVAL_MS);
      }
    }
  }

  async function shutdown(exitCode = 0) {
    if (stopping) return;
    stopping = true;
    clearTimeout(retryTimer);
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    try {
      await new Promise((resolve) => server.close(resolve));
      await connectionAttempt;
      await disconnectDatabase();
      clearTimeout(deadline);
      process.exitCode = exitCode;
    } catch {
      console.error("Could not complete shutdown cleanly.");
      process.exitCode = 1;
    }
  }

  connectionAttempt = tryConnect();
  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

start().catch(() => {
  console.error(
    "API startup failed. Check the field names in your environment configuration.",
  );
  process.exitCode = 1;
});
