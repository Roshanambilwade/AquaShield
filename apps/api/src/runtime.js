const EVENTS = new Set([
  "API_LISTENING",
  "DATABASE_CONNECTED",
  "DATABASE_UNAVAILABLE",
  "API_LISTEN_FAILED",
  "API_STOPPING",
  "API_STOPPED",
  "API_SHUTDOWN_FAILED",
  "API_SHUTDOWN_DEADLINE",
  "CONFIGURATION_INVALID",
  "API_STARTUP_FAILED",
]);

// Allowlisted fields only: never pass errors, requests, environment objects or URIs.
export function runtimeLog(event, fields = {}, sink = console.info) {
  if (!EVENTS.has(event)) throw new Error("Unknown runtime event");
  sink(
    JSON.stringify({
      event,
      ...(Number.isInteger(fields.port) ? { port: fields.port } : {}),
      ...(Number.isInteger(fields.exitCode)
        ? { exitCode: fields.exitCode }
        : {}),
    }),
  );
}

export function startRuntime(
  config,
  {
    app,
    connect,
    disconnect,
    log = runtimeLog,
    exit = (code) => process.exit(code),
    setExitCode = (code) => {
      process.exitCode = code;
    },
    signals = process,
  },
) {
  let stopping = false;
  let retryTimer;
  let connectionAttempt;
  let shutdownPromise;
  const server = app.listen(config.PORT, "0.0.0.0", () =>
    log("API_LISTENING", { port: server.address().port }),
  );

  async function tryConnect() {
    try {
      await connect(config);
      if (!stopping) log("DATABASE_CONNECTED");
    } catch {
      if (!stopping) {
        log("DATABASE_UNAVAILABLE");
        retryTimer = setTimeout(() => {
          connectionAttempt = tryConnect();
        }, config.MONGODB_RETRY_INTERVAL_MS);
      }
    }
  }

  function shutdown(exitCode = 0) {
    if (shutdownPromise) return shutdownPromise;
    stopping = true;
    clearTimeout(retryTimer);
    log("API_STOPPING", { exitCode });
    const deadline = setTimeout(() => {
      log("API_SHUTDOWN_DEADLINE");
      exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS);
    deadline.unref();
    shutdownPromise = (async () => {
      try {
        await new Promise((resolve) => {
          server.close(resolve);
          server.closeIdleConnections();
        });
        await connectionAttempt;
        await disconnect();
        clearTimeout(deadline);
        setExitCode(exitCode);
        log("API_STOPPED", { exitCode });
      } catch {
        log("API_SHUTDOWN_FAILED");
        setExitCode(1);
        // Keep the deadline armed if database cleanup did not complete.
      } finally {
        signals.removeListener("SIGINT", stop);
        signals.removeListener("SIGTERM", stop);
      }
    })();
    return shutdownPromise;
  }

  function stop() {
    void shutdown();
  }
  server.on("error", () => {
    log("API_LISTEN_FAILED");
    void shutdown(1);
  });
  connectionAttempt = tryConnect();
  signals.once("SIGINT", stop);
  signals.once("SIGTERM", stop);
  return { server, shutdown };
}
