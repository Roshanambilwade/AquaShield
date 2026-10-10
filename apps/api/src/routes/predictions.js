import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { datasetDemo } from "../config/demonstration.js";
import { predictionConfig } from "../config/prediction.js";
import { ApiError } from "../middleware/errors.js";
import { validate, reportIdSchema } from "../validation/report.js";
import {
  evaluatePredictions,
  predictionSummary,
  predictionHistory,
  predictionAreas,
  alertList,
  alertDetail,
  transitionAlert,
  backtestPredictions,
} from "../services/predictionService.js";
const area = z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/);
const demoQuery = z.enum(["true", "false"]).default("false");
const paging = {
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};
export function createPredictionRouter(config, databaseStatus) {
  const router = Router(),
    limiter = createSubmissionLimiter({ max: 10, windowMs: 60000 });
  let busy = false;
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus));
  function dataset(value) {
    if (value === "true" && config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Demo evidence is disabled in production.",
      );
    return datasetDemo(config, value === "true");
  }
  const query = (req, extras = {}) =>
    validate(z.object({ demo: demoQuery, ...extras }).strict(), req.query);
  const bounded = async (fn) => {
    if (busy)
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "A numerical evaluation is already running. Retry shortly.",
      );
    busy = true;
    try {
      return await fn();
    } finally {
      busy = false;
    }
  };
  router.get("/", async (req, res) => {
    const q = query(req);
    res.json({
      success: true,
      data: await predictionSummary(config, dataset(q.demo)),
    });
  });
  router.get("/areas/:areaId", async (req, res) => {
    const q = query(req),
      areaId = validate(area, req.params.areaId);
    const result = (
      await predictionSummary(config, dataset(q.demo))
    ).results.find((r) => r.areaId === areaId);
    if (!result)
      throw new ApiError(
        404,
        "PREDICTION_NOT_FOUND",
        "This area is not available.",
      );
    res.json({ success: true, data: result });
  });
  router.get("/areas/:areaId/history", async (req, res) => {
    const q = query(req, paging),
      areaId = validate(area, req.params.areaId),
      demo = dataset(q.demo);
    if (!(await predictionAreas(demo)).some((a) => a.id === areaId))
      throw new ApiError(
        404,
        "PREDICTION_NOT_FOUND",
        "This area is not available.",
      );
    res.json({
      success: true,
      data: await predictionHistory(areaId, demo, q.page, q.limit, config),
    });
  });
  router.post("/evaluate", limiter, async (req, res) => {
    const q = query(req);
    const body = validate(
      z
        .object({
          areaIds: z
            .array(area)
            .min(1)
            .max(20)
            .refine((v) => new Set(v).size === v.length)
            .optional(),
          horizonHours: z.number().optional(),
        })
        .strict(),
      req.body,
    );
    if (
      body.horizonHours != null &&
      body.horizonHours !== predictionConfig(config).PREDICTION_WINDOW_HOURS
    )
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "Unsupported forecast horizon.",
      );
    res.json({
      success: true,
      data: await bounded(() =>
        evaluatePredictions(
          config,
          dataset(q.demo),
          req.admin.id,
          body.areaIds,
        ),
      ),
    });
  });
  router.post("/backtest", limiter, async (req, res) => {
    const q = query(req),
      body = validate(z.object({ areaId: area }).strict(), req.body);
    res.json({
      success: true,
      data: await bounded(() =>
        backtestPredictions(config, dataset(q.demo), body.areaId),
      ),
    });
  });
  router.get("/alerts", async (req, res) => {
    const q = query(req, {
      ...paging,
      status: z.enum(["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]).optional(),
      areaId: area.optional(),
    });
    res.json({
      success: true,
      data: await alertList(dataset(q.demo), q, config),
    });
  });
  router.get("/alerts/:id", async (req, res) => {
    const q = query(req);
    res.json({
      success: true,
      data: await alertDetail(
        validate(reportIdSchema, req.params.id),
        dataset(q.demo),
        config,
      ),
    });
  });
  for (const action of ["acknowledge", "resolve"])
    router.post(`/alerts/:id/${action}`, limiter, async (req, res) => {
      const q = query(req),
        body = validate(
          z
            .object({
              revision: z.number().int().min(1),
              note: z.string().trim().max(300).default(""),
            })
            .strict(),
          req.body,
        );
      if (action === "resolve" && !body.note)
        throw new ApiError(
          422,
          "VALIDATION_ERROR",
          "Record why this alert is being resolved. This does not resolve a shortage.",
        );
      res.json({
        success: true,
        data: await transitionAlert(
          validate(reportIdSchema, req.params.id),
          dataset(q.demo),
          action,
          body.revision,
          req.admin.id,
          body.note,
        ),
      });
    });
  return router;
}
