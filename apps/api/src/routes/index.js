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
        phase: 2,
        endpoints: { health: "/api/health", reports: "/api/reports" },
      },
    }),
  );
  router.get("/health", createHealthController(databaseStatus));
  return router;
}
