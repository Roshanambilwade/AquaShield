import express, { Router } from "express";
import { createReportControllers } from "../controllers/reportController.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { requireAdmin } from "../middleware/admin.js";

export function createReportRouter(databaseStatus, config) {
  const router = Router();
  const controller = createReportControllers(databaseStatus, config);
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
