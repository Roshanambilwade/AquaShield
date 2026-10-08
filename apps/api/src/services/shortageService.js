import Report from "../models/Report.js";
import Area from "../models/Area.js";
import ShortageEvent, {
  initializeShortageStorage,
} from "../models/ShortageEvent.js";
import { buildShortageEvents } from "./reportClusteringService.js";
import { ApiError } from "../middleware/errors.js";

let processing = Promise.resolve();
export function detectShortages(
  config,
  { demo = false, now = new Date() } = {},
) {
  const operation = processing
    .catch(() => {})
    .then(async () => {
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
    });
  processing = operation;
  return operation;
}

export function serializeShortage(event) {
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
  return { id: String(_id), ...data };
}

export async function listShortages(config, demo = false) {
  await detectShortages(config, { demo });
  const events = await ShortageEvent.find({
    isDemo: demo,
    status: { $ne: "SUPERSEDED" },
  }).sort({ severityScore: -1, firstReportAt: 1, _id: 1 });
  return {
    events: events.map(serializeShortage),
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

export async function getShortage(id, config, demo = false) {
  await detectShortages(config, { demo });
  const event = await ShortageEvent.findOne({
    _id: id,
    isDemo: demo,
    status: { $ne: "SUPERSEDED" },
  });
  if (!event)
    throw new ApiError(
      404,
      "SHORTAGE_NOT_FOUND",
      "This shortage event is not available.",
    );
  return serializeShortage(event);
}

export async function getReportShortage(report, config) {
  await detectShortages(config, { demo: report.isDemo });
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
  return { ...serializeShortage(event), reportHandling: handling };
}
