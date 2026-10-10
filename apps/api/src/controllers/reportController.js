import { ApiError } from "../middleware/errors.js";
import {
  reportInputSchema,
  reportQuerySchema,
  reportIdSchema,
  validate,
} from "../validation/report.js";
import {
  createReport,
  listReports,
  getReport,
} from "../services/reportService.js";
import {
  detectShortages,
  getReportShortage,
} from "../services/shortageService.js";
import { authenticate, bearerToken } from "../services/authService.js";
import Report from "../models/Report.js";
import { reportResponses } from "../services/reportResponseService.js";
import { demonstration } from "../config/demonstration.js";
import { DEMO_LOCALITY_CENTERS } from "../../../../packages/shared/reportOptions.js";

export function createReportControllers(databaseStatus, config) {
  async function ready() {
    if ((await databaseStatus()) !== "connected")
      throw new ApiError(
        503,
        "DATABASE_UNAVAILABLE",
        "Reports cannot be accessed right now. Please try again shortly.",
      );
  }
  return {
    async create(req, res) {
      const input = validate(reportInputSchema, req.body);
      if (
        !demonstration(config) &&
        DEMO_LOCALITY_CENTERS.some((a) => a.id === input.areaId)
      )
        throw new ApiError(
          422,
          "VALIDATION_ERROR",
          "This fictional area is available only in the demonstration environment.",
        );
      await ready();
      const { report, created } = await createReport(input, req.admin, config);
      // A saved report must still be acknowledged if derived detection fails.
      // Reads and idempotent retries re-run detection from persisted evidence.
      let detectionStatus = "COMPLETE";
      try {
        await detectShortages(config, { demo: report.isDemo });
      } catch {
        detectionStatus = "DEFERRED";
        console.warn(
          "Report saved; shortage detection will retry on the next request.",
        );
      }
      res.status(created ? 201 : 200).json({
        success: true,
        message: "Your report has been received.",
        data: { ...report, detectionStatus },
      });
    },
    async list(req, res) {
      const query = validate(reportQuerySchema, req.query);
      if (query.demo === "true" && config.NODE_ENV === "production")
        throw new ApiError(
          403,
          "DEMO_DISABLED",
          "Demo reports are disabled in production.",
        );
      const token = query.demo === "true" ? null : bearerToken(req);
      await ready();
      const citizen = token ? await authenticate(token, ["CITIZEN"]) : null;
      res.json({
        success: true,
        data: await listReports(query, citizen, config),
      });
    },
    async detail(req, res) {
      const id = validate(reportIdSchema, req.params.id);
      await ready();
      const demo =
        config.NODE_ENV !== "production" &&
        (await Report.exists({ _id: id, isDemo: true, ownerId: null }));
      const citizen = demo
        ? null
        : await authenticate(bearerToken(req), ["CITIZEN"]);
      const report = await getReport(id, citizen, Boolean(demo), config);
      let shortageEvent = null;
      let detectionStatus = "COMPLETE";
      let responseStatus = null;
      try {
        shortageEvent = await getReportShortage(report, config);
        responseStatus =
          (await reportResponses([report])).get(report.id) ?? null;
      } catch {
        detectionStatus = "DEFERRED";
      }
      res.json({
        success: true,
        data: {
          ...report,
          shortageEvent,
          detectionStatus,
          responseStatus,
          canRequestDeliveryOtp: Boolean(
            citizen && (!report.isDemo || demonstration(config)),
          ),
        },
      });
    },
  };
}
