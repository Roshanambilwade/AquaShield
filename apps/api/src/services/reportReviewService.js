import Report from "../models/Report.js";
import { ApiError } from "../middleware/errors.js";
import { auditEntry } from "./auditContext.js";
import { detectShortages } from "./shortageService.js";

export async function reviewReport(id, input, actor, config, demo) {
  if (actor.role !== "ADMIN")
    throw new ApiError(403, "ADMIN_REQUIRED", "Administrator access required.");
  const provenance = demo
    ? "SIMULATED_ADMIN_EVIDENCE_REVIEW"
    : "ADMIN_SUBMITTED_EVIDENCE_REVIEW";
  const report = await Report.findOneAndUpdate(
    { _id: id, isDemo: demo, verificationStatus: "PENDING" },
    {
      $set: {
        verificationStatus: input.status,
        verificationSource: provenance,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewNote: input.note,
      },
      $push: {
        audit: {
          ...auditEntry(
            input.status === "VERIFIED" ? "REPORT_VERIFIED" : "REPORT_REJECTED",
            actor,
            { before: { status: "PENDING" }, after: { status: input.status } },
          ),
          reason: input.note,
          provenance,
        },
      },
    },
    // This private service is the only sanctioned update of the immutable review field.
    { returnDocument: "after", runValidators: true, overwriteImmutable: true },
  );
  if (!report) {
    if (!(await Report.exists({ _id: id, isDemo: demo })))
      throw new ApiError(
        404,
        "REPORT_NOT_FOUND",
        "This report is not available.",
      );
    throw new ApiError(
      409,
      "OPERATION_CONFLICT",
      "This report was already reviewed. Refresh its current status.",
    );
  }
  // Saved review is authoritative even if a bounded derived refresh fails.
  let assessmentRefresh = "UPDATED";
  try {
    await detectShortages(config, { demo, force: true });
  } catch {
    assessmentRefresh = "PENDING_RETRY";
  }
  return {
    verificationStatus: report.verificationStatus,
    reviewedAt: report.reviewedAt,
    verificationSource: provenance,
    assessmentRefresh,
  };
}
