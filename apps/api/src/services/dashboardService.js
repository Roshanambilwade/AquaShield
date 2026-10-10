import mongoose from "mongoose";
import { tankerEligibility } from "./allocationEngine.js";
import { z } from "zod";
import Report from "../models/Report.js";
import ShortageEvent from "../models/ShortageEvent.js";
import { listShortages, getShortage } from "./shortageService.js";
import { aiStatus } from "../config/ai.js";
import User from "../models/User.js";
import { serializeReport } from "./reportService.js";
import { ApiError } from "../middleware/errors.js";
import Allocation from "../models/Allocation.js";
import { operationalAnalytics } from "./operationalAnalytics.js";
import { predictionSummary } from "./predictionService.js";

const coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const tankerSchema = z.object({
  _id: z.any(),
  status: z.enum([
    "AVAILABLE",
    "ASSIGNED",
    "UNAVAILABLE",
    "EN_ROUTE",
    "ARRIVED",
    "OFFLINE",
  ]),
  currentLocation: coordinates.nullable().optional(),
  capacityLitres: z.number().positive().optional(),
  availableLitres: z.number().nullable().optional(),
  operatorId: z.any().optional(),
  activeAllocationId: z.any().optional(),
  observedAt: z.date().nullable().optional(),
});
const deliverySchema = z.object({
  _id: z.any(),
  eventId: z.any().optional(),
  areaId: z.string().nullable(),
  status: z.literal("DELIVERED"),
  otpVerified: z.literal(true),
  litresDelivered: z.number().nonnegative(),
  deliveredAt: z.date(),
  requestedAt: z.date().optional(),
});
// Read-only dashboard integration; fleet mutations belong to the operations service.
export async function operations(
  demo,
  config = { OPERATIONS_STALE_HOURS: 12 },
) {
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
  const operators = await User.find({ role: "OPERATOR", disabled: false })
    .select("_id")
    .lean();
  const valid = new Set(operators.map((o) => String(o._id)));
  const now = new Date();
  return {
    tankers:
      tankers?.map((t) => ({
        ...t,
        eligibility: tankerEligibility(
          {
            ...t,
            operatorId: valid.has(String(t.operatorId)) ? t.operatorId : null,
          },
          config,
          now,
        ),
        observationAgeHours: t.observedAt
          ? (now - t.observedAt) / 3600000
          : null,
        observationStatus: !t.observedAt
          ? "UNKNOWN"
          : t.observedAt > now ||
              now - t.observedAt > config.OPERATIONS_STALE_HOURS * 3600000
            ? "STALE"
            : "RECENT",
      })) ?? null,
    deliveries,
  };
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
  const [shortages, ops, predictions] = await Promise.all([
    listShortages(config, demo),
    operations(demo, config),
    predictionSummary(config, demo),
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
      ops.tankers?.filter((t) => t.eligibility.eligible).length ?? null,
      "tankers",
      false,
      "Eligible for allocation: positive water quantity, recent observation, active operator and no reservation.",
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
      predictions.results.some(
        (r) => r.retrievalStatus === "CURRENT" && r.forecast,
      )
        ? predictions.highRiskAreas
        : null,
      "areas",
      false,
      "Current supported HIGH/CRITICAL report-activity risk; unknown when history is inadequate, stale or not evaluated. Emerging evidence is separate.",
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
    recordedAvailableTankers:
      ops.tankers?.filter((t) => t.status === "AVAILABLE").length ?? null,
    emergingAreas: shortages.summary.emergingAreas,
    activity,
    isDemo: demo,
    generatedAt: new Date(),
    ai: aiStatus(config),
  };
}

export async function dashboardMap(config, demo) {
  const [shortages, ops, reports] = await Promise.all([
    listShortages(config, demo),
    operations(demo, config),
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
          observedAt: t.observedAt ?? null,
          observationAgeHours: t.observationAgeHours,
          observationStatus: t.observationStatus,
          eligibility: t.eligibility,
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
  const [shortages, ops, allocations] = await Promise.all([
    listShortages(config, demo),
    operations(demo, config),
    Allocation.find({ isDemo: demo })
      .select("eventId status")
      .limit(1001)
      .lean(),
  ]);
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
    operational: operationalAnalytics(
      shortages.events,
      ops,
      allocations.length > 1000 ? null : allocations,
    ),
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
    operations(demo, config),
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
  const previous = ops.deliveries
    ?.filter(
      (d) =>
        String(d.eventId) === event.id ||
        (event.areaId != null && d.areaId === event.areaId),
    )
    .sort((a, b) => b.deliveredAt - a.deliveredAt)[0];
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
    deliveryDataAvailable: ops.deliveries != null,
    recommendedAction: {
      source: "DETERMINISTIC_ASSESSMENT_GUIDANCE",
      text: recommendedAction(event),
    },
  };
}

async function reporterSources(records) {
  const owners = await User.find({
    _id: { $in: records.filter((r) => r.ownerId).map((r) => r.ownerId) },
  })
    .select("name email emailVerifiedAt")
    .lean();
  const byId = new Map(owners.map((u) => [String(u._id), u]));
  return records.map((report) => {
    const owner = byId.get(String(report.ownerId));
    return {
      ...serializeReport(report, true),
      reporter: owner
        ? {
            name: owner.name,
            email: owner.email,
            emailVerified: owner.emailVerifiedAt != null,
            identityVerified: false,
            residencyVerified: false,
            source: "CITIZEN_ACCOUNT",
            note: "Name and email are account-provided. Residence and identity have not been verified.",
          }
        : {
            name: null,
            email: null,
            emailVerified: false,
            identityVerified: false,
            residencyVerified: false,
            source: report.isDemo ? "SIMULATED_DEMO" : "LEGACY_OR_IMPORTED",
            note: report.isDemo
              ? "Fictional report; no real citizen account is associated."
              : "No citizen account is associated. Legacy ownership was preserved without assigning an owner.",
          },
    };
  });
}
export async function dashboardReports(query, demo) {
  const filter = { isDemo: demo };
  const [records, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Report.countDocuments(filter),
  ]);
  return {
    reports: await reporterSources(records),
    pagination: {
      page: query.page,
      pages: Math.ceil(total / query.limit),
      total,
    },
  };
}
export async function dashboardReport(id, demo) {
  const report = await Report.findOne({ _id: id, isDemo: demo }).select(
    "+photo",
  );
  if (!report)
    throw new ApiError(
      404,
      "REPORT_NOT_FOUND",
      "This report is not available.",
    );
  return (await reporterSources([report]))[0];
}
