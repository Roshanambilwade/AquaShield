import { Router } from "express";
import { z } from "zod";
import { validate, reportIdSchema } from "../validation/report.js";
import { ApiError } from "../middleware/errors.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { requireAdmin } from "../middleware/admin.js";
import {
  listShortages,
  getShortage,
  detectShortages,
} from "../services/shortageService.js";

const querySchema = z
  .object({ demo: z.enum(["true", "false"]).default("false") })
  .strict();
export function createShortageRouter(config, databaseStatus) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    req.shortageDemo = validate(querySchema, req.query).demo === "true";
    if (req.shortageDemo && config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Demo shortage data is disabled in production.",
      );
    if ((await databaseStatus()) !== "connected")
      throw new ApiError(
        503,
        "DATABASE_UNAVAILABLE",
        "Shortage evidence is temporarily unavailable. Please try again.",
      );
    next();
  });
  router.get("/", async (req, res) =>
    res.json({
      success: true,
      data: await listShortages(config, req.shortageDemo),
    }),
  );
  router.post(
    "/detect",
    requireAdmin(databaseStatus),
    createSubmissionLimiter({ max: 10 }),
    async (req, res) => {
      validate(z.object({}).strict(), req.body ?? {});
      const eventCount = await detectShortages(config, {
        demo: req.shortageDemo,
      });
      res.json({ success: true, data: { eventCount } });
    },
  );
  router.get("/:id", async (req, res) => {
    const id = validate(reportIdSchema, req.params.id);
    res.json({
      success: true,
      data: await getShortage(id, config, req.shortageDemo),
    });
  });
  router.get("/:id/severity", async (req, res) => {
    const event = await getShortage(
      validate(reportIdSchema, req.params.id),
      config,
      req.shortageDemo,
    );
    res.json({ success: true, data: event.severity });
  });
  router.post(
    "/:id/calculate-severity",
    requireAdmin(databaseStatus),
    createSubmissionLimiter({ max: 10 }),
    async (req, res) => {
      validate(z.object({}).strict(), req.body ?? {});
      const event = await getShortage(
        validate(reportIdSchema, req.params.id),
        config,
        req.shortageDemo,
      );
      res.json({ success: true, data: event.severity });
    },
  );
  return router;
}
