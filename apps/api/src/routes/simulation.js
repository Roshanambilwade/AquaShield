import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { validate } from "../validation/report.js";
import { ApiError } from "../middleware/errors.js";
export const simulationCommandSchema = z.discriminatedUnion("action", [
  ...["start", "pause", "resume", "stop"].map((action) =>
    z
      .object({
        action: z.literal(action),
        scenario: z.literal("municipal-v1").optional(),
      })
      .strict(),
  ),
  z
    .object({
      action: z.literal("step"),
      tick: z.number().int().min(1).max(24),
    })
    .strict(),
  z
    .object({
      action: z.literal("speed"),
      speed: z.number().int().min(1).max(3),
    })
    .strict(),
]);
export function createSimulationRouter(config, databaseStatus, service) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus));
  router.use((_req, _res, next) => {
    if (!config.SIMULATION_ENABLED)
      throw new ApiError(
        403,
        "SIMULATION_DISABLED",
        "Simulation is not enabled in this environment.",
      );
    next();
  });
  router.get("/", async (_req, res) =>
    res.json({ success: true, data: await service.snapshot() }),
  );
  router.post(
    "/command",
    createSubmissionLimiter({ max: 60, windowMs: 60000 }),
    async (req, res) => {
      await service.command(
        validate(simulationCommandSchema, req.body),
        req.admin,
      );
      res.json({ success: true, data: await service.snapshot() });
    },
  );
  return router;
}
