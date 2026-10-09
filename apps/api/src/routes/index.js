import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";

export function createApiRouter(databaseStatus) {
  const router = Router();
  router.get("/", (_req, res) =>
    res.json({
      success: true,
      data: {
        name: "AquaShield API",
        version: "0.1.0",
        phase: 6.5,
        endpoints: {
          health: "/api/health",
          reports: "/api/reports",
          shortages: "/api/shortages",
          auth: "/api/auth",
          dashboard: "/api/dashboard",
          ai: "/api/ai",
          operations: "/api/operations",
          operator: "/api/operator",
        },
      },
    }),
  );
  router.get("/health", createHealthController(databaseStatus));
  return router;
}
