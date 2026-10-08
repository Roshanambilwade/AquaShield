import { ApiError } from "../middleware/errors.js";
import {
  citizenTokenSchema,
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

function citizenToken(req, required = true) {
  const token = req.get("X-Citizen-Token");
  if (!token && !required) return undefined;
  if (!citizenTokenSchema.safeParse(token).success)
    throw new ApiError(
      400,
      "CITIZEN_KEY_REQUIRED",
      "Your browser report key is unavailable. Please reload and try again.",
    );
  return token;
}

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
      const token = citizenToken(req);
      const input = validate(reportInputSchema, req.body);
      await ready();
      const { report, created } = await createReport(input, token);
      // A saved report must still be acknowledged if derived detection fails.
      // Reads and idempotent retries re-run detection from persisted evidence.
      let detectionStatus = "COMPLETE";
      try {
        await detectShortages(config);
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
      const token = citizenToken(req, query.demo !== "true");
      await ready();
      res.json({ success: true, data: await listReports(query, token) });
    },
    async detail(req, res) {
      const id = validate(reportIdSchema, req.params.id);
      const token = citizenToken(req, false);
      await ready();
      const report = await getReport(id, token);
      let shortageEvent = null;
      let detectionStatus = "COMPLETE";
      try {
        shortageEvent = await getReportShortage(report, config);
      } catch {
        detectionStatus = "DEFERRED";
      }
      res.json({
        success: true,
        data: { ...report, shortageEvent, detectionStatus },
      });
    },
  };
}
