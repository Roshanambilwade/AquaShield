import express, { Router } from "express";
import { createReportControllers } from "../controllers/reportController.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { requireAdmin } from "../middleware/admin.js";
import { citizenDeliveryOtp } from "../services/deliveryService.js";
import { validate, reportIdSchema } from "../validation/report.js";
import { emptyTripInput } from "../validation/delivery.js";

export function createReportRouter(databaseStatus, config) {
  const router = Router();
  const controller = createReportControllers(databaseStatus, config);
  router.post(
    "/:id/delivery-otp",
    createSubmissionLimiter({ max: 20 }),
    requireAdmin(databaseStatus, ["CITIZEN"]),
    express.json({ limit: "2kb" }),
    async (req, res) => {
      validate(emptyTripInput, req.body);
      const id = validate(reportIdSchema, req.params.id);
      const data = await citizenDeliveryOtp(id, req.admin, config);
      res.json({ success: true, data });
    },
  );
  // The larger limit is restricted to report submission for a bounded photo.
  router.post(
    "/",
    createSubmissionLimiter(),
    requireAdmin(databaseStatus, ["CITIZEN"]),
    express.json({ limit: "3mb" }),
    controller.create,
  );
  router.get("/", controller.list);
  router.get("/:id", controller.detail);
  return router;
}
