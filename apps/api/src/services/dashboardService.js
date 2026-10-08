import mongoose from "mongoose";
import { z } from "zod";
import Report from "../models/Report.js";
import ShortageEvent from "../models/ShortageEvent.js";
import { listShortages, getShortage } from "./shortageService.js";

const coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const tankerSchema = z.object({
  _id: z.any(),
  status: z.enum(["AVAILABLE", "ASSIGNED", "EN_ROUTE", "ARRIVED", "OFFLINE"]),
  currentLocation: coordinates.nullable().optional(),
  capacityLitres: z.number().positive().optional(),
});
const deliverySchema = z.object({
  _id: z.any(),
  areaId: z.string(),
  status: z.literal("DELIVERED"),
  otpVerified: z.literal(true),
  litresDelivered: z.number().nonnegative(),
  deliveredAt: z.date(),
  requestedAt: z.date().optional(),
});
// Read-only integration point: no fleet, delivery or forecast workflow is enabled.
async function operations(demo) {
  const database = mongoose.connection.db;
  const names = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(
      (c) => c.name,
    ),
  );
  const read = async (name, schema) => {
    if (!names.has(name)) return null;
    const records = await database
      .collection(name)
      .find({
        isDemo: demo,
        ...(name === "deliveries"
          ? { status: "DELIVERED", otpVerified: true }
          : {}),
      })
      .limit(1001)
      .toArray();
    if (records.length > 1000) return null;
    // Invalid data is not quietly dropped and then presented as a complete count.
    const parsed = records.map((r) => schema.safeParse(r));
    return parsed.every((p) => p.success) ? parsed.map((p) => p.data) : null;
  };
  const [tankers, deliveries] = await Promise.all([
    read("tankers", tankerSchema),
    read("deliveries", deliverySchema),
  ]);
  return { tankers, deliveries };
}
const metric = (value, unit, estimated = false, note = "") => ({
  value,
  unit,
  kind: value == null ? "UNKNOWN" : estimated ? "ESTIMATE" : "RECORDED_COUNT",
  note,
});
function recommendedAction(event) {
  if (event.status === "HISTORICAL")
    return "Review whether the reported interruption is still ongoing.";
  if (event.status === "EMERGING")
    return "Seek independent reports and field verification before confirming the zone.";
  return event.severityLevel === "CRITICAL"
    ? "Request urgent municipal assessment of this critical zone."
    : event.severityLevel === "HIGH"
      ? "Prioritize field assessment and confirm household needs."
      : "Monitor the zone and verify the reported supply interruption.";
}

export async function dashboardSummary(config, demo) {
  const [shortages, ops] = await Promise.all([
    listShortages(config, demo),
    operations(demo),
  ]);
  const times =
    ops.deliveries
      ?.filter((d) => d.requestedAt && d.deliveredAt >= d.requestedAt)
      .map((d) => (d.deliveredAt - d.requestedAt) / 60000) || [];
  const metrics = {
    activeShortages: metric(shortages.summary.activeShortages, "zones"),
    criticalAreas: metric(shortages.summary.criticalAreas, "zones"),
    estimatedPeopleAffected: metric(
      shortages.summary.estimatedPeopleAffected,
      "people",
      true,
      "Approximate sum of non-historical events; households may overlap across time windows.",
    ),
    availableTankers: metric(
      ops.tankers?.filter((t) => t.status === "AVAILABLE").length ?? null,
      "tankers",
      false,
      "Read-only fleet records; no fleet feed is configured when unknown.",
    ),
    tankersEnRoute: metric(
      ops.tankers?.filter((t) => t.status === "EN_ROUTE").length ?? null,
      "tankers",
    ),
    waterDelivered: metric(
      ops.deliveries?.reduce((sum, d) => sum + d.litresDelivered, 0) ?? null,
      "L",
      false,
      "Recorded totals require DELIVERED and OTP-verified records.",
    ),
    averageResponseTime: metric(
      times.length
        ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) /
            10
        : null,
      "minutes",
      true,
      `Mean request-to-verified-delivery time; ${times.length} timed records.`,
    ),
    highRiskAreas: metric(
      null,
      "areas",
      false,
      "Forecasts are not configured. Emerging evidence is shown separately and is not a prediction.",
    ),
  };
  const recorded = await Report.find({ isDemo: demo })
    .sort({ createdAt: -1, _id: -1 })
    .limit(10)
    .select("locality createdAt verificationStatus")
    .lean();
  const activity = recorded.map((r) => ({
    id: String(r._id),
    type: "REPORT_RECEIVED",
    area: r.locality,
    timestamp: r.createdAt,
    verificationStatus: r.verificationStatus,
    isDemo: demo,
  }));
  return {
    metrics,
    emergingAreas: shortages.summary.emergingAreas,
    activity,
    isDemo: demo,
    generatedAt: new Date(),
    ai: {
      status: "NOT_CONFIGURED",
      message:
        "AI recommendations will be added in Phase 5. No recommendation has been generated.",
    },
  };
}

export async function dashboardMap(config, demo) {
  const [shortages, ops, reports] = await Promise.all([
    listShortages(config, demo),
    operations(demo),
    Report.find({ isDemo: demo })
      .sort({ createdAt: -1, _id: -1 })
      .limit(501)
      .select(
        "location locationSource accuracyMeters problem verificationStatus createdAt",
      )
      .lean(),
  ]);
  return {
    zones: shortages.events,
    reports: reports.slice(0, 500).map((r) => ({
      id: String(r._id),
      location: r.location,
      locationSource: r.locationSource,
      accuracyMeters: r.accuracyMeters,
      problem: r.problem,
      verificationStatus: r.verificationStatus,
      createdAt: r.createdAt,
      isDemo: demo,
    })),
    reportsTruncated: reports.length > 500,
    tankers:
      ops.tankers
        ?.filter((t) => t.currentLocation)
        .map((t) => ({
          id: String(t._id),
          location: t.currentLocation,
          status: t.status,
          capacityLitres: t.capacityLitres ?? null,
        })) ?? [],
    tankerDataAvailable: ops.tankers != null,
    highRiskAreas: [],
    forecastDataAvailable: false,
    emergingZones: shortages.events
      .filter((e) => e.status === "EMERGING")
      .map((e) => e.id),
    isDemo: demo,
  };
}

export async function dashboardAnalytics(config, demo) {
  const shortages = await listShortages(config, demo);
  const grouped = await Report.aggregate([
    { $match: { isDemo: demo } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%dT%H:00:00.000Z",
            date: "$createdAt",
            timezone: "UTC",
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 24 },
  ]);
  return {
    severityDistribution: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
      (level) => ({
        level,
        count: shortages.events.filter(
          (e) => e.severityLevel === level && e.status !== "HISTORICAL",
        ).length,
      }),
    ),
    reportsByHour: grouped
      .reverse()
      .map((row) => ({ hour: row._id, count: row.count })),
    evidence: {
      eligibleHouseholds: shortages.events.reduce(
        (sum, e) => sum + e.eligibleReportCount,
        0,
      ),
      verifiedReports: shortages.events.reduce(
        (sum, e) => sum + e.verifiedReportCount,
        0,
      ),
      duplicateReports: shortages.events.reduce(
        (sum, e) => sum + e.duplicateReportCount,
        0,
      ),
      suspiciousReports: shortages.events.reduce(
        (sum, e) => sum + e.suspiciousReportCount,
        0,
      ),
    },
    isDemo: demo,
    note: "Severity distribution excludes historical events. Hourly counts include all submissions, including duplicates. Household totals may overlap across time windows.",
  };
}

export async function dashboardDetail(id, config, demo) {
  const [event, ops] = await Promise.all([
    getShortage(id, config, demo),
    operations(demo),
  ]);
  const stored = await ShortageEvent.findById(id).select("reportIds");
  const records = await Report.find({
    _id: { $in: stored.reportIds },
    isDemo: demo,
  })
    .select("waterLevel")
    .lean();
  const waterLevels = records.reduce(
    (result, r) => ({
      ...result,
      [r.waterLevel]: (result[r.waterLevel] || 0) + 1,
    }),
    {},
  );
  const previous = event.areaId
    ? ops.deliveries
        ?.filter((d) => d.areaId === event.areaId)
        .sort((a, b) => b.deliveredAt - a.deliveredAt)[0]
    : null;
  return {
    event,
    waterLevels,
    previousDelivery: previous
      ? {
          litres: previous.litresDelivered,
          deliveredAt: previous.deliveredAt,
          verified: true,
          isDemo: demo,
        }
      : null,
    deliveryDataAvailable: ops.deliveries != null && event.areaId != null,
    recommendedAction: {
      source: "DETERMINISTIC_ASSESSMENT_GUIDANCE",
      text: recommendedAction(event),
    },
  };
}
