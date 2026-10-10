import mongoose from "mongoose";
import Report from "../models/Report.js";
import { ApiError } from "../middleware/errors.js";
import {
  FAILED_ACTIONS,
  PENDING_ACTIONS,
  RECOVERY_ACTIONS,
  SUCCESS_ACTIONS,
} from "./auditContext.js";

export const auditSources = [
  ["REPORT", "reports"],
  ["ALLOCATION", "allocations"],
  ["TANKER", "tankers"],
  ["DELIVERY", "deliveries"],
  ["ALLOCATION_EVIDENCE", "allocationevidences"],
  ["EARLY_WARNING_ALERT", "earlywarningalerts"],
];
const allActions = [
  ...FAILED_ACTIONS,
  ...PENDING_ACTIONS,
  ...RECOVERY_ACTIONS,
  ...SUCCESS_ACTIONS,
];
const string = (input) => ({
  $convert: { input, to: "string", onError: null, onNull: null },
});
const outcomeExpression = {
  $switch: {
    branches: [
      [FAILED_ACTIONS, "FAILURE"],
      [PENDING_ACTIONS, "PENDING"],
      [RECOVERY_ACTIONS, "RECOVERED"],
      [SUCCESS_ACTIONS, "SUCCESS"],
    ].map(([actions, outcome]) => ({
      case: { $in: ["$eventType", actions] },
      then: outcome,
    })),
    default: null,
  },
};

function sourcePipeline(type, demo, q, window) {
  const date = { $gte: window.from, $lt: window.to };
  const audit = "$audit";
  const entryKey =
    type === "EARLY_WARNING_ALERT"
      ? { $concat: ["r", string("$audit.revision")] }
      : {
          $ifNull: [
            string("$audit._id"),
            { $concat: ["i", string("$entryIndex")] },
          ],
        };
  return [
    {
      $match: {
        isDemo: demo,
        audit: {
          $elemMatch: {
            at: date,
            ...(q.actorId
              ? { actorId: new mongoose.Types.ObjectId(q.actorId) }
              : {}),
            ...(q.correlationId ? { correlationId: q.correlationId } : {}),
            ...(q.eventType && type !== "ALLOCATION_EVIDENCE"
              ? {
                  [type === "EARLY_WARNING_ALERT" ? "type" : "action"]:
                    type === "EARLY_WARNING_ALERT"
                      ? q.eventType.replace(/^ALERT_/, "")
                      : q.eventType,
                }
              : {}),
          },
        },
        ...(q.targetId ? { _id: new mongoose.Types.ObjectId(q.targetId) } : {}),
      },
    },
    { $unwind: { path: audit, includeArrayIndex: "entryIndex" } },
    { $match: { "audit.at": date } },
    {
      $project: {
        _id: 0,
        id: { $concat: [type, ":", string("$_id"), ":", entryKey] },
        targetType: { $literal: type },
        targetId: string("$_id"),
        eventType:
          type === "EARLY_WARNING_ALERT"
            ? { $concat: ["ALERT_", "$audit.type"] }
            : type === "ALLOCATION_EVIDENCE"
              ? { $literal: "FAIRNESS_EVIDENCE_RECORDED" }
              : "$audit.action",
        timestamp: "$audit.at",
        actorId: string("$audit.actorId"),
        actorRole: "$audit.actorRole",
        correlationId: "$audit.correlationId",
        storedOutcome: "$audit.outcome",
        before: {
          status: {
            $ifNull: ["$audit.before.status", "$audit.previousStatus"],
          },
          riskLevel: {
            $ifNull: ["$audit.before.riskLevel", "$audit.previousRiskLevel"],
          },
          balanceLitres: "$audit.before.balanceLitres",
          otpVerified: "$audit.before.otpVerified",
        },
        after: {
          status: { $ifNull: ["$audit.after.status", "$audit.status"] },
          riskLevel: {
            $ifNull: ["$audit.after.riskLevel", "$audit.riskLevel"],
          },
          balanceLitres: "$audit.after.balanceLitres",
          otpVerified: "$audit.after.otpVerified",
        },
        isDemo: "$isDemo",
      },
    },
    { $set: { outcome: { $ifNull: ["$storedOutcome", outcomeExpression] } } },
    { $unset: "storedOutcome" },
    ...(Object.keys(q).some(
      (k) =>
        ["eventType", "actorId", "outcome", "correlationId"].includes(k) &&
        q[k],
    )
      ? [
          {
            $match: Object.fromEntries(
              ["eventType", "actorId", "outcome", "correlationId"]
                .filter((k) => q[k])
                .map((k) => [k, q[k]]),
            ),
          },
        ]
      : []),
  ];
}
const statuses = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "RECOMMENDED",
  "APPROVED",
  "ASSIGNING",
  "RECONCILING",
  "ASSIGNED",
  "COMPLETING",
  "COMPLETED",
  "DELIVERED",
  "AVAILABLE",
  "UNAVAILABLE",
  "EN_ROUTE",
  "ARRIVED",
  "ACTIVE",
  "ACKNOWLEDGED",
  "RESOLVED",
];
function safeState(value) {
  return {
    ...(statuses.includes(value?.status) ? { status: value.status } : {}),
    ...(["LOW", "MODERATE", "HIGH", "CRITICAL", "INSUFFICIENT_DATA"].includes(
      value?.riskLevel,
    )
      ? { riskLevel: value.riskLevel }
      : {}),
    ...(Number.isFinite(value?.balanceLitres) && value.balanceLitres >= 0
      ? { balanceLitres: value.balanceLitres }
      : {}),
    ...(typeof value?.otpVerified === "boolean"
      ? { otpVerified: value.otpVerified }
      : {}),
  };
}
export function safeAuditEvent(row) {
  return {
    id: row.id,
    eventType: allActions.includes(row.eventType)
      ? row.eventType
      : "UNKNOWN_EVENT",
    timestamp:
      row.timestamp instanceof Date && Number.isFinite(+row.timestamp)
        ? row.timestamp
        : null,
    targetType: row.targetType,
    targetId: row.targetId,
    actorId: /^[a-f0-9]{24}$/i.test(row.actorId || "") ? row.actorId : null,
    actorRole: ["ADMIN", "OPERATOR", "CITIZEN"].includes(row.actorRole)
      ? row.actorRole
      : null,
    correlationId: /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
      row.correlationId || "",
    )
      ? row.correlationId
      : null,
    outcome: ["SUCCESS", "FAILURE", "PENDING", "RECOVERED"].includes(
      row.outcome,
    )
      ? row.outcome
      : null,
    before: safeState(row.before),
    after: safeState(row.after),
    isDemo: row.isDemo === true,
    source: "EMBEDDED_ATOMIC_AUDIT",
    note: "Missing historical role, correlation or transition fields remain unknown. Free-text reasons, notes, private evidence and OTP material are excluded.",
  };
}
async function queryEvents(q, demo, window, extra = []) {
  const sources = auditSources.filter(
    ([type]) => !q.targetType || q.targetType === type,
  );
  const [type] = sources[0];
  // Aggregation base is always reports; union even for a non-report-only query.
  const pipeline =
    type === "REPORT"
      ? sourcePipeline(type, demo, q, window)
      : [
          { $match: { _id: { $exists: false } } },
          {
            $unionWith: {
              coll: sources[0][1],
              pipeline: sourcePipeline(type, demo, q, window),
            },
          },
        ];
  for (const [other, coll] of sources.slice(1))
    pipeline.push({
      $unionWith: { coll, pipeline: sourcePipeline(other, demo, q, window) },
    });
  return Report.aggregate([...pipeline, ...extra]).option({
    maxTimeMS: 5000,
    allowDiskUse: false,
  });
}
export async function auditHistory(q, demo, window) {
  const rows = await queryEvents(q, demo, window, [
    { $sort: { timestamp: -1, id: -1 } },
    { $skip: (q.page - 1) * q.limit },
    { $limit: q.limit + 1 },
  ]);
  return {
    events: rows.slice(0, q.limit).map(safeAuditEvent),
    page: q.page,
    limit: q.limit,
    hasMore: rows.length > q.limit,
    window,
    isDemo: demo,
  };
}
export async function auditDetail(id, demo) {
  const [targetType, targetId, key] = id.split(":");
  const [, coll] = auditSources.find(([type]) => type === targetType);
  const selector = key.startsWith("r")
    ? { revision: Number(key.slice(1)) }
    : key.startsWith("i")
      ? null
      : { _id: new mongoose.Types.ObjectId(key) };
  const record = await mongoose.connection.db.collection(coll).findOne(
    { _id: new mongoose.Types.ObjectId(targetId), isDemo: demo },
    {
      projection: {
        audit: selector
          ? { $elemMatch: selector }
          : { $slice: [Number(key.slice(1)), 1] },
        isDemo: 1,
      },
      maxTimeMS: 5000,
    },
  );
  const entry = record?.audit?.[0];
  if (entry && !selector && entry._id)
    throw new ApiError(
      404,
      "AUDIT_NOT_FOUND",
      "This audit event is not available.",
    );
  if (!entry)
    throw new ApiError(
      404,
      "AUDIT_NOT_FOUND",
      "This audit event is not available.",
    );
  const eventType =
    targetType === "EARLY_WARNING_ALERT"
      ? `ALERT_${entry.type}`
      : targetType === "ALLOCATION_EVIDENCE"
        ? "FAIRNESS_EVIDENCE_RECORDED"
        : entry.action;
  const group = [
    [FAILED_ACTIONS, "FAILURE"],
    [PENDING_ACTIONS, "PENDING"],
    [RECOVERY_ACTIONS, "RECOVERED"],
    [SUCCESS_ACTIONS, "SUCCESS"],
  ].find(([actions]) => actions.includes(eventType));
  return safeAuditEvent({
    id,
    targetType,
    targetId,
    eventType,
    timestamp: entry.at,
    actorId: String(entry.actorId || ""),
    actorRole: entry.actorRole,
    correlationId: entry.correlationId,
    outcome: entry.outcome || group?.[1],
    before: entry.before || {
      status: entry.previousStatus,
      riskLevel: entry.previousRiskLevel,
    },
    after: entry.after || { status: entry.status, riskLevel: entry.riskLevel },
    isDemo: demo,
  });
}
