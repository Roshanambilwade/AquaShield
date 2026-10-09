import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { ApiError } from "../middleware/errors.js";
import { validate, reportIdSchema } from "../validation/report.js";
import { runAgent } from "../services/ai/agentService.js";

export function createAiRouter(config, databaseStatus, dependencies) {
  const router = Router();
  const limiter = createSubmissionLimiter({ max: 20 });
  let inFlight = 0;
  for (const [path, role] of Object.entries({
    detect: "detect",
    allocate: "allocate",
    logistics: "logistics",
    predict: "predict",
    "recommend-allocation": "allocate",
  })) {
    router.post(
      `/${path}`,
      (_req, res, next) => {
        res.set("Cache-Control", "no-store");
        next();
      },
      requireAdmin(databaseStatus),
      limiter,
      async (req, res) => {
        validate(z.object({}).strict(), req.query);
        const input = validate(
          z
            .object({
              eventId: reportIdSchema.optional(),
              demo: z.boolean().default(false),
            })
            .strict(),
          req.body,
        );
        if (input.demo && config.NODE_ENV === "production")
          throw new ApiError(
            403,
            "DEMO_DISABLED",
            "Demo evidence is disabled in production.",
          );
        if (inFlight >= 2)
          throw new ApiError(
            429,
            "RATE_LIMITED",
            "Agent assessments are busy. Please retry shortly.",
          );
        inFlight++;
        const controller = new AbortController();
        const cancel = () => {
          if (!res.writableEnded) controller.abort();
        };
        res.on("close", cancel);
        try {
          res.json({
            success: true,
            data: await runAgent(role, config, input, {
              ...dependencies,
              signal: controller.signal,
            }),
          });
        } finally {
          inFlight--;
          res.off("close", cancel);
        }
      },
    );
  }
  return router;
}
