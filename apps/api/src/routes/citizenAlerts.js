import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { validate, reportIdSchema } from "../validation/report.js";
import { datasetDemo, demonstration } from "../config/demonstration.js";
import { ApiError } from "../middleware/errors.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import {
  citizenAreas,
  citizenPreference,
  citizenInbox,
  markAdvisory,
  publishAdvisory,
  municipalAdvisories,
  withdrawAdvisory,
} from "../services/citizenAlertService.js";
const areaId = z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/);
const paging = {
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};
export function createCitizenAlertsRouter(
  config,
  databaseStatus,
  municipal = false,
) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus, [municipal ? "ADMIN" : "CITIZEN"]));
  router.use(createSubmissionLimiter({ max: 120, windowMs: 60000 }));
  const dataset = (req) => {
    if (!municipal) return demonstration(config);
    const q = validate(
      z
        .object({ demo: z.enum(["true", "false"]).default("false"), ...paging })
        .strict(),
      req.query,
    );
    if (q.demo === "true" && config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Demo advisories are disabled in production.",
      );
    return datasetDemo(config, q.demo === "true");
  };
  const ok = (res, data) => res.json({ success: true, data });
  if (municipal) {
    router.get("/areas", async (req, res) =>
      ok(res, { areas: await citizenAreas(dataset(req)) }),
    );
    router.get("/", async (req, res) => {
      const q = validate(
        z
          .object({
            demo: z.enum(["true", "false"]).default("false"),
            ...paging,
          })
          .strict(),
        req.query,
      );
      ok(res, await municipalAdvisories(dataset(req), q.page, q.limit));
    });
    router.post("/", async (req, res) => {
      const input = validate(
        z
          .object({
            areaId,
            audience: z.enum(["AREA", "MUNICIPAL"]),
            category: z.enum([
              "SUPPLY_REVIEW",
              "DELIVERY_RECORDED",
              "ACTIVITY_WATCH",
              "DEMONSTRATION",
            ]),
            sourceType: z.enum([
              "REPORT",
              "DELIVERY",
              "PREDICTION",
              "SIMULATED",
            ]),
            sourceId: z.string().regex(/^[A-Za-z0-9_-]{2,100}$/),
            expiresInHours: z.number().int().min(1).max(168),
          })
          .strict(),
        req.body,
      );
      ok(res, await publishAdvisory(input, req.admin, config, dataset(req)));
    });
    router.post("/:id/withdraw", async (req, res) => {
      const input = validate(
        z.object({ revision: z.number().int().min(1) }).strict(),
        req.body,
      );
      ok(
        res,
        await withdrawAdvisory(
          validate(reportIdSchema, req.params.id),
          dataset(req),
          input.revision,
          req.admin,
        ),
      );
    });
  } else {
    router.get("/area", async (req, res) => {
      validate(z.object({}).strict(), req.query);
      ok(res, await citizenPreference(req.admin.id, dataset(req)));
    });
    router.put("/area", async (req, res) => {
      validate(z.object({}).strict(), req.query);
      const input = validate(
        z.object({ areaId: areaId.nullable() }).strict(),
        req.body,
      );
      ok(
        res,
        await citizenPreference(req.admin.id, dataset(req), input.areaId),
      );
    });
    router.get("/", async (req, res) => {
      const q = validate(
        z
          .object({
            ...paging,
            history: z.enum(["true", "false"]).default("false"),
          })
          .strict(),
        req.query,
      );
      ok(
        res,
        await citizenInbox(req.admin.id, dataset(req), {
          ...q,
          history: q.history === "true",
        }),
      );
    });
    router.put("/:id/read", async (req, res) => {
      validate(z.object({}).strict(), req.query);
      const input = validate(
        z.object({ read: z.boolean() }).strict(),
        req.body,
      );
      ok(
        res,
        await markAdvisory(
          req.admin.id,
          dataset(req),
          validate(reportIdSchema, req.params.id),
          input.read,
        ),
      );
    });
  }
  return router;
}
