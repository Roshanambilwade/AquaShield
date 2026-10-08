import express, { Router } from "express";
import { createReportControllers } from "../controllers/reportController.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";

export function createReportRouter(databaseStatus) {
  const router = Router();
  const controller = createReportControllers(databaseStatus);
  // The larger limit is restricted to report submission for a bounded photo.
  router.post(
    "/",
    createSubmissionLimiter(),
    express.json({ limit: "3mb" }),
    controller.create,
  );
  router.get("/", controller.list);
  router.get("/:id", controller.detail);
  return router;
}
