import { LOCALITY_CENTERS } from "../../../../packages/shared/reportOptions.js";
import Report from "../models/Report.js";
import Area from "../models/Area.js";
import ShortageEvent, {
  initializeShortageStorage,
} from "../models/ShortageEvent.js";
import { buildShortageEvents } from "./reportClusteringService.js";
import { ApiError } from "../middleware/errors.js";

import mongoose from "mongoose";
import { DetectionGate } from "./detectionGate.js";
const gates = new WeakMap();
function gate(demo) {
  const db = mongoose.connection.db;
  if (!gates.has(db)) gates.set(db, new Map());
  const modes = gates.get(db);
  if (!modes.has(demo)) modes.set(demo, new DetectionGate());
  return modes.get(demo);
}
export function detectShortages(
  config,
  { demo = false, now = new Date(), force = true } = {},
) {
  return gate(demo).run(
    async () => {
      await initializeShortageStorage();
      const [reports, areas] = await Promise.all([
        Report.find({ isDemo: demo, verificationStatus: { $ne: "REJECTED" } })
          .select("+reporterKeyHash")
          .sort({ createdAt: 1, _id: 1 })
          .limit(5001)
          .lean(),
        Area.find({ isDemo: demo }).lean(),
      ]);
      if (reports.length > 5000)
        throw new ApiError(
          503,
          "DETECTION_CAPACITY_EXCEEDED",
          "This detection batch exceeds the MVP limit. A paginated worker is required.",
        );
      const events = buildShortageEvents(reports, areas, config, now);
      for (const event of events)
        await ShortageEvent.updateOne(
          { eventKey: event.eventKey },
          { $set: event },
          { upsert: true, runValidators: true },
        );
      // Keep historical records, but hide stale versions after a merge/split/deletion.
      await ShortageEvent.updateMany(
        {
          isDemo: demo,
          eventKey: { $nin: events.map((e) => e.eventKey) },
          status: { $ne: "SUPERSEDED" },
        },
        { $set: { status: "SUPERSEDED" } },
      );
      return events.length;
    },
    { force, ttl: config.DETECTION_REFRESH_MS ?? 15000 },
  );
}

export function serializeShortage(
  event,
  { publicView = false, config = {} } = {},
) {
  const e = event.toObject ? event.toObject() : event;
  // Public aggregates never include report IDs, photos, descriptions or owner keys.
  const { _id, ...data } = e;
  for (const key of [
    "__v",
    "eventKey",
    "reportIds",
    "duplicateReportIds",
    "suspiciousReportIds",
  ])
    delete data[key];
  if (publicView && !e.isDemo) {
    if (
      (e.population?.householdCount ?? 0) < (config.PUBLIC_MIN_HOUSEHOLDS ?? 5)
    )
      return null;
    const grid = config.PUBLIC_LOCATION_GRID_DEGREES ?? 0.02;
    data.center = {
      lat: Math.round(e.center.lat / grid) * grid,
      lng: Math.round(e.center.lng / grid) * grid,
    };
    data.areaName =
      LOCALITY_CENTERS.find((area) => area.id === e.areaId)?.name ??
      "Reported shortage zone";
    data.population = {
      estimate: e.estimatedAffectedPopulation,
      method:
        "Approximate aggregate; household breakdown withheld for privacy.",
    };
    data.privacy = {
      generalized: true,
      gridDegrees: grid,
      householdBreakdownSuppressed: true,
    };
  }
  return { id: String(_id), ...data };
}

export async function listShortages(config, demo = false, publicView = false) {
  await detectShortages(config, { demo, force: false });
  const stored = await ShortageEvent.find({
    isDemo: demo,
    status: { $ne: "SUPERSEDED" },
  }).sort({ severityScore: -1, firstReportAt: 1, _id: 1 });
  const events = stored
    .map((e) => serializeShortage(e, { publicView, config }))
    .filter(Boolean);
  return {
    events,
    privacyNote: publicView
      ? "Small live clusters are withheld; totals cover published aggregates only. Fictional demo data is exempt."
      : null,
    summary: {
      activeShortages: events.filter((e) => e.status === "ACTIVE").length,
      criticalAreas: events.filter(
        (e) => e.status !== "HISTORICAL" && e.severityLevel === "CRITICAL",
      ).length,
      estimatedPeopleAffected: events
        .filter((e) => e.status !== "HISTORICAL")
        .reduce((sum, e) => sum + e.estimatedAffectedPopulation, 0),
      emergingAreas: events.filter((e) => e.status === "EMERGING").length,
    },
    isDemo: demo,
  };
}

export async function getShortage(
  id,
  config,
  demo = false,
  publicView = false,
) {
  await detectShortages(config, { demo, force: false });
  const event = await ShortageEvent.findOne({
    _id: id,
    isDemo: demo,
    status: { $ne: "SUPERSEDED" },
  });
  if (!event || !serializeShortage(event, { publicView, config }))
    throw new ApiError(
      404,
      "SHORTAGE_NOT_FOUND",
      "This shortage event is not available.",
    );
  return serializeShortage(event, { publicView, config });
}

export async function getReportShortage(report, config) {
  await detectShortages(config, { demo: report.isDemo, force: false });
  const event = await ShortageEvent.findOne({
    isDemo: report.isDemo,
    status: { $ne: "SUPERSEDED" },
    $or: [
      { reportIds: report.id },
      { duplicateReportIds: report.id },
      { suspiciousReportIds: report.id },
    ],
  });
  if (!event) return null;
  const handling = event.suspiciousReportIds.some(
    (id) => String(id) === report.id,
  )
    ? "SUSPICIOUS"
    : event.duplicateReportIds.some((id) => String(id) === report.id)
      ? "DUPLICATE"
      : "ELIGIBLE";
  const safe = serializeShortage(event, { publicView: true, config });
  return safe ? { ...safe, reportHandling: handling } : null;
}
