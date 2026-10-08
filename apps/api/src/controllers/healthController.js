export function createHealthController(databaseStatus) {
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
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  };
}
