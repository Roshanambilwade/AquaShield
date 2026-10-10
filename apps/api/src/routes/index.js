import { Router } from "express";
import {
  createHealthController,
  livenessController,
} from "../controllers/healthController.js";
import { demonstration } from "../config/demonstration.js";
import {
  LOCALITY_CENTERS,
  DEMO_LOCALITY_CENTERS,
} from "../../../../packages/shared/reportOptions.js";

export function createApiRouter(databaseStatus, config = {}) {
  const router = Router();
  router.get("/environment", (_req, res) =>
    res.set("Cache-Control", "no-store").json({
      success: true,
      data: {
        demonstration: demonstration(config),
        label: demonstration(config)
          ? "AquaShield — Demonstration Environment"
          : null,
        areas: demonstration(config)
          ? [...LOCALITY_CENTERS, ...DEMO_LOCALITY_CENTERS]
          : LOCALITY_CENTERS,
      },
    }),
  );
  router.get("/", (_req, res) =>
    res.json({
      success: true,
      data: {
        name: "AquaShield API",
        version: "0.1.0",
        phase: 8,
        endpoints: {
          health: "/api/health",
          reports: "/api/reports",
          shortages: "/api/shortages",
          auth: "/api/auth",
          dashboard: "/api/dashboard",
          ai: "/api/ai",
          operations: "/api/operations",
          operator: "/api/operator",
          deliveries: "/api/deliveries",
          predictions: "/api/predictions",
        },
      },
    }),
  );
  router.get("/health", createHealthController(databaseStatus));
  router.get("/health/live", livenessController);
  router.get("/health/ready", createHealthController(databaseStatus, config));
  return router;
}
