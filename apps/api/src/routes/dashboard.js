import { listShortages } from "../services/shortageService.js";
import { Router } from "express";
import { datasetDemo } from "../config/demonstration.js";
import { z } from "zod";
import { parseAnalyticsQuery } from "../validation/analytics.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { requireAdmin } from "../middleware/admin.js";
import { ApiError } from "../middleware/errors.js";
import {
  validate,
  reportIdSchema,
  reportQuerySchema,
} from "../validation/report.js";
import {
  dashboardSummary,
  dashboardMap,
  dashboardAnalytics,
  dashboardDetail,
  dashboardReports,
  dashboardReport,
} from "../services/dashboardService.js";
export function createDashboardRouter(config, databaseStatus) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus));
  const analyticsLimit = createSubmissionLimiter({ max: 30, windowMs: 60000 });
  router.use("/analytics", analyticsLimit);
  router.use((req, _res, next) => {
    if (req.path === "/analytics")
      req.analyticsQuery = parseAnalyticsQuery(req.query);
    req.demo =
      validate(
        req.path === "/analytics"
          ? z
              .object({ demo: z.enum(["true", "false"]).default("false") })
              .passthrough()
          : req.path === "/reports"
            ? reportQuerySchema
            : z
                .object({ demo: z.enum(["true", "false"]).default("false") })
                .strict(),
        req.query,
      ).demo === "true";
    req.demo = datasetDemo(config, req.demo);
    if (req.demo && config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Demo dashboard data is disabled in production.",
      );
    next();
  });
  router.get("/reports", async (req, res) =>
    res.json({
      success: true,
      data: await dashboardReports(
        validate(reportQuerySchema, req.query),
        req.demo,
      ),
    }),
  );
  router.get("/reports/:id", async (req, res) =>
    res.json({
      success: true,
      data: await dashboardReport(
        validate(reportIdSchema, req.params.id),
        req.demo,
      ),
    }),
  );
  for (const [path, service] of [
    ["shortages", listShortages],
    ["summary", dashboardSummary],
    ["map", dashboardMap],
    ["analytics", dashboardAnalytics],
  ])
    router.get(`/${path}`, async (req, res) =>
      res.json({
        success: true,
        data: await service(config, req.demo, req.analyticsQuery),
      }),
    );
  router.get("/shortages/:id", async (req, res) =>
    res.json({
      success: true,
      data: await dashboardDetail(
        validate(reportIdSchema, req.params.id),
        config,
        req.demo,
      ),
    }),
  );
  return router;
}
