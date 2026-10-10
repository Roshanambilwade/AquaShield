import { Router } from "express";
import { datasetDemo } from "../config/demonstration.js";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { ApiError } from "../middleware/errors.js";
import { validate, reportIdSchema } from "../validation/report.js";
import {
  emptyTripInput,
  otpInput,
  completeInput,
} from "../validation/delivery.js";
import {
  listDeliveries,
  deliveryDetail,
  transitionTrip,
  issueDeliveryOtp,
  verifyDeliveryOtp,
  completeDelivery,
  recoverDelivery,
} from "../services/deliveryService.js";
import { operationError } from "../services/operationsService.js";
export function createDeliveryRouter(config, databaseStatus, { handoff } = {}) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus, ["ADMIN", "OPERATOR"]));
  router.use((req, _res, next) => {
    req.demo =
      validate(
        z.object({ demo: z.enum(["true", "false"]).default("false") }).strict(),
        req.query,
      ).demo === "true";
    req.demo = datasetDemo(config, req.demo);
    if (req.demo && config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Demo deliveries are disabled in production.",
      );
    next();
  });
  const mutateLimit = createSubmissionLimiter({ max: 60 });
  const otpLimit = createSubmissionLimiter({ max: 20 });
  const ok = (res, data) => res.json({ success: true, data });
  const id = (req) => validate(reportIdSchema, req.params.id);
  router.get("/", async (req, res) =>
    ok(res, { deliveries: await listDeliveries(req.admin, config, req.demo) }),
  );
  router.get("/:id", async (req, res) =>
    ok(res, await deliveryDetail(id(req), req.admin, config)),
  );
  router.post("/:id/recover", mutateLimit, async (req, res) => {
    if (req.admin.role !== "ADMIN")
      throw new ApiError(
        403,
        "ADMIN_REQUIRED",
        "Municipal administrator recovery is required.",
      );
    validate(emptyTripInput, req.body);
    ok(res, { delivery: await recoverDelivery(id(req), req.admin, config) });
  });
  router.use((req, _res, next) => {
    if (req.admin.role !== "OPERATOR")
      throw new ApiError(
        403,
        "OPERATOR_REQUIRED",
        "Only the assigned operator may control this trip.",
      );
    next();
  });
  for (const action of ["start", "arrive"])
    router.post(`/:id/${action}`, mutateLimit, async (req, res) => {
      validate(emptyTripInput, req.body);
      ok(res, {
        delivery: await transitionTrip(id(req), action, req.admin, config),
      });
    });
  for (const endpoint of ["otp", "demo-otp"])
    router.post(`/:id/${endpoint}`, otpLimit, async (req, res) => {
      validate(emptyTripInput, req.body);
      ok(
        res,
        await issueDeliveryOtp(id(req), req.admin, config, {
          revealDemo: endpoint === "demo-otp",
          handoff,
        }),
      );
    });
  router.post("/:id/verify", otpLimit, async (req, res) => {
    const input = validate(otpInput, req.body);
    ok(res, {
      delivery: await verifyDeliveryOtp(id(req), input.code, req.admin, config),
    });
  });
  router.post("/:id/complete", mutateLimit, async (req, res) => {
    const input = validate(completeInput, req.body);
    ok(res, {
      delivery: await completeDelivery(
        id(req),
        input.litresDelivered,
        req.admin,
        config,
      ),
    });
  });
  router.use((error, _req, _res, next) => next(operationError(error)));
  return router;
}
