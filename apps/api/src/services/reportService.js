import { reportResponses } from "./reportResponseService.js";
import { createHash } from "node:crypto";
import Report, { initializeReportStorage } from "../models/Report.js";
import { ApiError } from "../middleware/errors.js";
import { processPhoto } from "./photoService.js";

export function hashCitizenToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function serializeReport(report, includePhoto = false) {
  const result = {
    id: report.id,
    location: { lat: report.location.lat, lng: report.location.lng },
    locationSource: report.locationSource,
    accuracyMeters: report.accuracyMeters,
    areaId: report.areaId,
    locality: report.locality,
    problem: report.problem,
    lastSupplyTime: report.lastSupplyTime,
    reportedDurationHours: report.reportedDurationHours,
    waterLevel: report.waterLevel,
    householdSize: report.householdSize,
    description: report.description,
    verificationStatus: report.verificationStatus,
    isDemo: report.isDemo,
    hasPhoto: report.hasPhoto,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
  if (includePhoto && report.photo)
    result.photo = `data:${report.photo.contentType};base64,${report.photo.data.toString("base64")}`;
  return result;
}

export async function createReport(input, citizen) {
  if (citizen?.role !== "CITIZEN" || !/^[a-f0-9]{24}$/i.test(citizen.id || ""))
    throw new ApiError(
      401,
      "AUTH_REQUIRED",
      "Sign in with a citizen account to submit a report.",
    );
  await initializeReportStorage();
  const identity = {
    ownerId: citizen.id,
    reporterKeyHash: hashCitizenToken(`citizen:${citizen.id}`),
    submissionId: input.submissionId,
  };
  const existing = await Report.findOne(identity);
  if (existing) return { report: serializeReport(existing), created: false };
  const { photo: dataUrl, ...fields } = input;
  const photo = await processPhoto(dataUrl);
  try {
    const report = await Report.create({
      ...fields,
      ...identity,
      photo,
      hasPhoto: Boolean(photo),
    });
    return { report: serializeReport(report), created: true };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const duplicate = await Report.findOne(identity);
    if (!duplicate) throw error;
    return { report: serializeReport(duplicate), created: false };
  }
}

export async function listReports(query, citizen) {
  const filter =
    query.demo === "true"
      ? { isDemo: true }
      : { ownerId: citizen.id, isDemo: false };
  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Report.countDocuments(filter),
  ]);
  const responses = await reportResponses(reports);
  return {
    reports: reports.map((report) => ({
      ...serializeReport(report),
      responseStatus: responses.get(report.id) ?? null,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
}

export async function getReport(id, citizen, allowDemo = true) {
  const allowed = allowDemo ? [{ isDemo: true }] : [];
  if (citizen) allowed.push({ ownerId: citizen.id, isDemo: false });
  if (!allowed.length)
    throw new ApiError(
      404,
      "REPORT_NOT_FOUND",
      "This report is not available.",
    );
  const report = await Report.findOne({ _id: id, $or: allowed }).select(
    "+photo",
  );
  if (!report)
    throw new ApiError(
      404,
      "REPORT_NOT_FOUND",
      "This report was not found or is not available to your account.",
    );
  return serializeReport(report, true);
}
