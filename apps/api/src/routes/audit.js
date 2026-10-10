import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { datasetDemo } from "../config/demonstration.js";
import { ApiError } from "../middleware/errors.js";
import { validate } from "../validation/report.js";
import { auditQuery, auditId, dateWindow } from "../validation/analytics.js";
import { auditHistory, auditDetail } from "../services/auditService.js";
import { analyticsBound } from "../services/analyticsBound.js";
export function createAuditRouter(config, databaseStatus) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus));
  router.use(createSubmissionLimiter({ max: 60, windowMs: 60000 }));
  function dataset(value) {
    const demo = datasetDemo(config, value === "true");
    if (demo && config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Demo audit data is disabled in production.",
      );
    return demo;
  }
  router.get("/", async (req, res) => {
    const q = validate(auditQuery, req.query);
    res.json({
      success: true,
      data: await analyticsBound(() =>
        auditHistory(q, dataset(q.demo), dateWindow(q)),
      ),
    });
  });
  router.get("/:id", async (req, res) => {
    const q = validate(
      z.object({ demo: z.enum(["true", "false"]).default("false") }).strict(),
      req.query,
    );
    res.json({
      success: true,
      data: await analyticsBound(() =>
        auditDetail(validate(auditId, req.params.id), dataset(q.demo)),
      ),
    });
  });
  return router;
}
