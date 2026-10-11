import Report from "../models/Report.js";
import User from "../models/User.js";
import Allocation from "../models/Allocation.js";
import Delivery from "../models/Delivery.js";
import ForecastObservation from "../models/ForecastObservation.js";
import Prediction from "../models/Prediction.js";
import EarlyWarningAlert from "../models/EarlyWarningAlert.js";
import { listTankers } from "./operationsService.js";
import { predictionAreas, readHistory } from "./predictionService.js";
import { predictReportActivity } from "./predictionEngine.js";
import { assertDemoObservationTarget } from "./tankerObservationService.js";
export async function demoReadiness(config, now = new Date()) {
  assertDemoObservationTarget(config);
  const [
    areas,
    fleet,
    reports,
    operators,
    reservations,
    trips,
    fixtureCount,
    predictionCount,
    alertCount,
  ] = await Promise.all([
    predictionAreas(true),
    listTankers(config, true),
    Report.aggregate([
      { $match: { isDemo: true } },
      {
        $group: {
          _id: { areaId: "$areaId", source: "$sourceType" },
          count: { $sum: 1 },
        },
      },
    ]).option({ maxTimeMS: 5000 }),
    User.countDocuments({ role: "OPERATOR", disabled: false }),
    Allocation.countDocuments({
      isDemo: true,
      status: { $in: ["ASSIGNING", "RECONCILING", "ASSIGNED", "RESETTING"] },
    }),
    Delivery.countDocuments({ isDemo: true, status: { $ne: "DELIVERED" } }),
    ForecastObservation.countDocuments(),
    Prediction.countDocuments({ isDemo: true }),
    EarlyWarningAlert.countDocuments({ isDemo: true }),
  ]);
  const history = await readHistory(config, true, now);
  const synthetic = config.FORECAST_DEMO_ENABLED
    ? await readHistory(config, true, now, false, "SYNTHETIC_FORECAST")
    : null;
  const assess = (input, a) => {
    if (!input) return { status: "NOT CONFIGURED" };
    const r = predictReportActivity(input.reports, {
      areaId: a.id,
      areaName: a.name,
      isDemo: true,
      now,
      source: config,
      truncated: input.truncated,
    });
    return {
      status: r.forecast ? "READY" : "INSUFFICIENT_DATA",
      sampleSize: r.quality.sampleSize,
      reporterKeys: r.quality.distinctReporters,
      coveredWindows: r.quality.coveredWindows,
      totalWindows: r.quality.totalWindows,
      reasons: r.reasons,
    };
  };
  return {
    readOnly: true,
    checkedAt: now,
    fleetStatus: fleet.tankers.some((t) => t.eligibility.eligible)
      ? "READY"
      : "NOT READY",
    eligibleTankers: fleet.tankers.filter((t) => t.eligibility.eligible).length,
    tankers: fleet.tankers.map((t) => ({
      identifier: t.identifier,
      status: t.status,
      eligible: t.eligibility.eligible,
      reasons: t.eligibility.reasons,
      observedAt: t.observedAt,
    })),
    activeOperators: operators,
    activeReservations: reservations,
    activeTrips: trips,
    reportCounts: reports.map((r) => ({ ...r._id, count: r.count })),
    fixtureObservations: fixtureCount,
    persistedPredictions: predictionCount,
    persistedAlerts: alertCount,
    sourceSeparation:
      "SEPARATE_COLLECTION_AND_EXPLICIT_SOURCE; operational paths exclude synthetic forecasts",
    areas: areas.map((a) => ({
      areaId: a.id,
      operationalHistory: assess(history, a),
      syntheticHistory: assess(synthetic, a),
    })),
  };
}
