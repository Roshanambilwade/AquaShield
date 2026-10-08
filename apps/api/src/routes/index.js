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
        phase: 1,
        endpoints: { health: "/api/health" },
      },
    }),
  );
  router.get("/health", createHealthController(databaseStatus));
  return router;
}
