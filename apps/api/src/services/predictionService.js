import Report from "../models/Report.js";
import Area from "../models/Area.js";
import ShortageEvent from "../models/ShortageEvent.js";
import Prediction from "../models/Prediction.js";
import EarlyWarningAlert from "../models/EarlyWarningAlert.js";
import {
  LOCALITY_CENTERS,
  DEMO_LOCALITY_CENTERS,
} from "../../../../packages/shared/reportOptions.js";
import { predictionConfig } from "../config/prediction.js";
import { detectionConfig } from "../config/detection.js";
import { ApiError } from "../middleware/errors.js";
import {
  predictReportActivity,
  backtestActivity,
  observationEnd,
  fingerprint,
  predictionSettings,
} from "./predictionEngine.js";

const MAX_HISTORY = 5000,
  HOUR = 3600000,
  MAX_AUDIT = 1000;
export async function predictionAreas(demo) {
  const stored = await Area.find({ isDemo: demo })
    .select("_id name center")
    .sort({ _id: 1 })
    .limit(51)
    .maxTimeMS(5000)
    .lean();
  if (stored.length > 50)
    throw new ApiError(
      503,
      "PREDICTION_CAPACITY",
      "Area catalog exceeds the evaluation limit.",
    );
  const map = new Map(
    [...LOCALITY_CENTERS, ...(demo ? DEMO_LOCALITY_CENTERS : [])].map((a) => [
      a.id,
      { id: a.id, name: a.name, center: { lat: a.lat, lng: a.lng } },
    ]),
  );
  for (const a of stored)
    map.set(a._id, { id: a._id, name: a.name, center: a.center });
  return [...map.values()];
}
async function readHistory(config, demo, now, backtest = false) {
  const c = predictionConfig(config),
    d = detectionConfig(config);
  const end = observationEnd(now, c);
  const start = new Date(
    +end -
      (c.PREDICTION_WINDOW_HOURS *
        (c.PREDICTION_HISTORY_WINDOWS + (backtest ? 8 : 0)) +
        d.DUPLICATE_WINDOW_HOURS) *
        HOUR,
  );
  const reports = await Report.find({
    isDemo: demo,
    createdAt: { $gte: start, $lt: end },
  })
    .select(
      "_id areaId createdAt updatedAt verificationStatus location lastSupplyTime reportedDurationHours isDemo +reporterKeyHash",
    )
    .sort({ createdAt: 1, _id: 1 })
    .limit(MAX_HISTORY + 1)
    .maxTimeMS(5000)
    .lean();
  return {
    reports: reports.slice(0, MAX_HISTORY),
    truncated: reports.length > MAX_HISTORY,
  };
}
const ranks = {
  INSUFFICIENT_DATA: -1,
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
};
const conflict = () =>
  new ApiError(
    409,
    "OPERATION_CONFLICT",
    "The alert changed. Refresh before trying again.",
  );
function publicAlert(a) {
  if (!a) return null;
  // Only municipal aggregates, no raw reports, reporter hashes or contact data.
  return {
    id: String(a._id),
    areaId: a.areaId,
    areaName: a.areaName,
    status: a.status,
    revision: a.revision,
    cycle: a.cycle,
    result: a.result,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    acknowledgedAt: a.acknowledgedAt,
    resolvedAt: a.resolvedAt,
    isDemo: a.isDemo,
    audit: a.audit,
  };
}
export async function reconcileAlert(result, predictionKey, actorId, now) {
  const key = fingerprint([result.isDemo, result.areaId, result.horizonHours]);
  // Config changes update the same area/horizon alert, preserving its audit trail.
  const { generatedAt, currentSeverity, ...condition } = result;
  void generatedAt;
  void currentSeverity;
  const conditionKey = fingerprint({
    ...condition,
    quality: { ...condition.quality, ageHours: undefined },
  });
  let a = await EarlyWarningAlert.findOne({ key }).lean();
  const urgent = ranks[result.riskLevel] >= 2;
  if (!a && !urgent) return null;
  if (!a) {
    try {
      a = await EarlyWarningAlert.create({
        key,
        areaId: result.areaId,
        areaName: result.areaName,
        horizonHours: result.horizonHours,
        modelVersion: result.modelVersion,
        configVersion: result.configVersion,
        isDemo: result.isDemo,
        provenance: result.provenance,
        conditionKey,
        predictionKey,
        result,
        audit: [
          {
            type: "CREATED",
            at: now,
            actorId,
            revision: 1,
            riskLevel: result.riskLevel,
            status: "ACTIVE",
            predictionKey,
          },
        ],
      });
      return publicAlert(a);
    } catch (e) {
      if (e.code !== 11000) throw e;
      a = await EarlyWarningAlert.findOne({ key }).lean();
    }
  }
  if (a.conditionKey === conditionKey) return publicAlert(a);
  if (+new Date(a.result.generatedAt) > +new Date(result.generatedAt))
    throw conflict();
  if (a.audit.length >= MAX_AUDIT)
    throw new ApiError(
      409,
      "PREDICTION_CAPACITY",
      "Alert audit capacity reached; archive planning is required before further updates.",
    );
  const oldLevel = a.result.riskLevel;
  const reopen = a.status === "RESOLVED" && urgent;
  const escalation = ranks[result.riskLevel] > ranks[oldLevel] && urgent;
  const status = reopen || escalation ? "ACTIVE" : a.status;
  const type = reopen
    ? "REOPENED"
    : result.riskLevel === "INSUFFICIENT_DATA"
      ? "DATA_UNAVAILABLE"
      : ranks[result.riskLevel] > ranks[oldLevel]
        ? "ESCALATED"
        : ranks[result.riskLevel] < ranks[oldLevel]
          ? "DEESCALATED"
          : "UPDATED";
  const updated = await EarlyWarningAlert.findOneAndUpdate(
    { _id: a._id, revision: a.revision },
    {
      $set: {
        conditionKey,
        predictionKey,
        result,
        status,
        modelVersion: result.modelVersion,
        configVersion: result.configVersion,
        ...(reopen || escalation
          ? {
              acknowledgedAt: null,
              acknowledgedBy: null,
              resolvedAt: null,
              resolvedBy: null,
            }
          : {}),
      },
      $inc: { revision: 1, ...(reopen ? { cycle: 1 } : {}) },
      $push: {
        audit: {
          type,
          at: now,
          actorId,
          revision: a.revision + 1,
          previousRiskLevel: oldLevel,
          riskLevel: result.riskLevel,
          previousStatus: a.status,
          status,
          predictionKey,
        },
      },
    },
    { new: true, runValidators: true },
  ).lean();
  if (!updated) {
    const concurrent = await EarlyWarningAlert.findOne({ key }).lean();
    if (concurrent?.conditionKey === conditionKey)
      return publicAlert(concurrent);
    throw conflict();
  }
  return publicAlert(updated);
}
const initialized = new WeakMap();
async function initializeStorage() {
  const db = Prediction.db.db;
  if (!initialized.has(db))
    initialized.set(
      db,
      Promise.all([
        Prediction.createIndexes(),
        EarlyWarningAlert.createIndexes(),
      ]).catch((e) => {
        initialized.delete(db);
        throw e;
      }),
    );
  await initialized.get(db);
}
export async function evaluatePredictions(
  config,
  demo,
  actorId,
  areaIds,
  now = new Date(),
) {
  const deadline = Date.now() + 15000;
  await initializeStorage();
  const catalog = await predictionAreas(demo);
  const areas = areaIds?.length
    ? catalog.filter((a) => areaIds.includes(a.id))
    : catalog;
  if (areas.length > 20 || (areaIds && areas.length !== areaIds.length))
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Select up to twenty known, distinct areas.",
    );
  const history = await readHistory(config, demo, now);
  const events = await ShortageEvent.find({
    isDemo: demo,
    areaId: { $in: areas.map((a) => a.id) },
    status: { $in: ["ACTIVE", "EMERGING"] },
    calculatedAt: { $lte: now },
  })
    .select(
      "areaId severityScore severityLevel confidenceScore calculatedAt lastReportAt",
    )
    .sort({ lastReportAt: -1, _id: -1 })
    .limit(101)
    .maxTimeMS(5000)
    .lean();
  const results = [];
  for (const area of areas) {
    if (Date.now() > deadline)
      throw new ApiError(
        503,
        "PREDICTION_TIMEOUT",
        "Numerical evaluation reached its bounded deadline. Completed records remain saved; retry selected areas.",
      );
    const result = predictReportActivity(history.reports, {
      areaId: area.id,
      areaName: area.name,
      isDemo: demo,
      now,
      source: config,
      truncated: history.truncated,
    });
    const event = events.find((e) => e.areaId === area.id);
    result.currentSeverity = event
      ? {
          score: event.severityScore,
          level: event.severityLevel,
          shortageConfidence: event.confidenceScore,
          calculatedAt: event.calculatedAt,
          note: "Observed shortage context; not an input to the activity-risk calculation.",
        }
      : null;
    const { generatedAt, ...stable } = result;
    void generatedAt;
    // Freshness is a state, not a continuously changing fingerprint.
    const key = fingerprint({
      ...stable,
      quality: { ...stable.quality, ageHours: undefined },
    });
    let stored;
    try {
      stored = await Prediction.findOneAndUpdate(
        { key },
        {
          $setOnInsert: {
            key,
            areaId: area.id,
            horizonHours: result.horizonHours,
            isDemo: demo,
            generatedAt: now,
            actorId,
            result,
          },
        },
        { upsert: true, new: true, runValidators: true },
      ).lean();
    } catch (e) {
      if (e.code !== 11000) throw e;
      stored = await Prediction.findOne({ key }).lean();
    }
    await reconcileAlert(stored.result, key, actorId, now);
    results.push(stored.result);
  }
  return {
    results,
    evaluatedAreas: results.length,
    method: "DETERMINISTIC_BACKEND",
    providerRequested: false,
  };
}
function presented(result, config, now) {
  const expired =
    +now - +new Date(result.observationWindow.end) >=
      predictionConfig(config).PREDICTION_WINDOW_HOURS * HOUR ||
    (result.quality.latestObservationAt &&
      (+now - +new Date(result.quality.latestObservationAt)) / HOUR >
        predictionConfig(config).PREDICTION_STALE_HOURS);
  const changed =
    result.configVersion !== fingerprint(predictionSettings(config));
  return {
    ...result,
    retrievalStatus: changed ? "CONFIG_CHANGED" : expired ? "STALE" : "CURRENT",
    explanation: {
      method: "RULE_BASED",
      providerRequested: false,
      text: result.recommendedAction,
    },
  };
}
export async function predictionSummary(config, demo, now = new Date()) {
  const areas = await predictionAreas(demo);
  const results = [];
  for (const area of areas) {
    const p = await Prediction.findOne({
      isDemo: demo,
      areaId: area.id,
      horizonHours: predictionConfig(config).PREDICTION_WINDOW_HOURS,
    })
      .sort({ generatedAt: -1, _id: -1 })
      .maxTimeMS(5000)
      .lean();
    results.push(
      p
        ? presented(p.result, config, now)
        : {
            areaId: area.id,
            areaName: area.name,
            riskLevel: "INSUFFICIENT_DATA",
            riskScore: null,
            forecast: null,
            retrievalStatus: "NOT_EVALUATED",
            reasons: ["NOT_EVALUATED"],
            isDemo: demo,
          },
    );
  }
  return {
    results,
    highRiskAreas: results.filter(
      (r) => r.retrievalStatus === "CURRENT" && ranks[r.riskLevel] >= 2,
    ).length,
    supportedHorizonHours: predictionConfig(config).PREDICTION_WINDOW_HOURS,
    method: "DETERMINISTIC_BACKEND",
    providerRequested: false,
    isDemo: demo,
  };
}
export async function predictionHistory(areaId, demo, page, limit, config) {
  const rows = await Prediction.find({ areaId, isDemo: demo })
    .sort({ generatedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .maxTimeMS(5000)
    .lean();
  return {
    results: rows
      .slice(0, limit)
      .map((r) => presented(r.result, config, new Date())),
    page,
    limit,
    hasMore: rows.length > limit,
  };
}
export async function alertList(demo, { page, limit, status, areaId }, config) {
  const rows = await EarlyWarningAlert.find({
    isDemo: demo,
    ...(status ? { status } : {}),
    ...(areaId ? { areaId } : {}),
  })
    .sort({ updatedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .maxTimeMS(5000)
    .lean();
  return {
    alerts: rows.slice(0, limit).map((a) => ({
      ...publicAlert(a),
      result: presented(a.result, config, new Date()),
    })),
    page,
    limit,
    hasMore: rows.length > limit,
  };
}
export async function alertDetail(id, demo, config) {
  const a = await EarlyWarningAlert.findOne({ _id: id, isDemo: demo })
    .maxTimeMS(5000)
    .lean();
  if (!a)
    throw new ApiError(404, "ALERT_NOT_FOUND", "This alert is not available.");
  return { ...publicAlert(a), result: presented(a.result, config, new Date()) };
}
export async function transitionAlert(
  id,
  demo,
  action,
  revision,
  actorId,
  note,
  now = new Date(),
) {
  const from = action === "acknowledge" ? "ACTIVE" : "ACKNOWLEDGED",
    status = action === "acknowledge" ? "ACKNOWLEDGED" : "RESOLVED";
  const a = await EarlyWarningAlert.findOneAndUpdate(
    {
      _id: id,
      isDemo: demo,
      status: from,
      revision,
      "audit.999": { $exists: false },
    },
    {
      $set: {
        status,
        ...(action === "acknowledge"
          ? { acknowledgedAt: now, acknowledgedBy: actorId }
          : { resolvedAt: now, resolvedBy: actorId }),
      },
      $inc: { revision: 1 },
      $push: {
        audit: {
          type: status,
          at: now,
          actorId,
          revision: revision + 1,
          previousStatus: from,
          status,
          note,
        },
      },
    },
    { new: true, runValidators: true },
  ).lean();
  if (!a) throw conflict();
  return publicAlert(a);
}
export async function backtestPredictions(
  config,
  demo,
  areaId,
  now = new Date(),
) {
  const area = (await predictionAreas(demo)).find((a) => a.id === areaId);
  if (!area)
    throw new ApiError(422, "VALIDATION_ERROR", "Select a known area.");
  const history = await readHistory(config, demo, now, true);
  return backtestActivity(history.reports, {
    areaId,
    areaName: area.name,
    isDemo: demo,
    now,
    source: config,
    truncated: history.truncated,
  });
}
