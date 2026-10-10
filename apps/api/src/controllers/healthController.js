export function createHealthController(databaseStatus, config) {
  return async function healthController(_req, res) {
    const database = await databaseStatus();
    const healthy = database === "connected";
    res.set("Cache-Control", "no-store");
    res.status(healthy ? 200 : 503).json({
      success: healthy,
      message: healthy
        ? "AquaShield is ready."
        : "The API is running, but MongoDB is unavailable.",
      ...(healthy ? {} : { code: "DATABASE_UNAVAILABLE", details: {} }),
      data: {
        service: "aquashield-api",
        status: healthy ? "ok" : "degraded",
        database,
        ...(config
          ? {
              ai: {
                provider: "gemini",
                configured: Boolean(
                  config.AI_PROVIDER === "gemini" &&
                  config.GEMINI_API_KEY &&
                  config.GEMINI_MODEL_ID,
                ),
                mode: config.DEMO_AI_MODE ? "DEMO" : "REAL",
                availability: "NOT_PROBED",
                requiredForReadiness: false,
              },
            }
          : {}),
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  };
}

export function livenessController(_req, res) {
  res.set("Cache-Control", "no-store").json({
    success: true,
    data: { service: "aquashield-api", status: "alive" },
  });
}
