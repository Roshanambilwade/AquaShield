import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { ApiError } from "../middleware/errors.js";
import { validate, reportIdSchema } from "../validation/report.js";
import {
  dashboardSummary,
  dashboardMap,
  dashboardAnalytics,
  dashboardDetail,
} from "../services/dashboardService.js";
export function createDashboardRouter(config, databaseStatus) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus));
  router.use((req, _res, next) => {
    req.demo =
      validate(
        z.object({ demo: z.enum(["true", "false"]).default("false") }).strict(),
        req.query,
      ).demo === "true";
    if (req.demo && config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Demo dashboard data is disabled in production.",
      );
    next();
  });
  for (const [path, service] of [
    ["summary", dashboardSummary],
    ["map", dashboardMap],
    ["analytics", dashboardAnalytics],
  ])
    router.get(`/${path}`, async (req, res) =>
      res.json({ success: true, data: await service(config, req.demo) }),
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
