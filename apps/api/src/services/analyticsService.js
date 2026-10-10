import mongoose from "mongoose";
import Report from "../models/Report.js";
import Allocation from "../models/Allocation.js";
import Delivery from "../models/Delivery.js";
import Tanker from "../models/Tanker.js";
import User from "../models/User.js";
import Area from "../models/Area.js";
import ShortageEvent from "../models/ShortageEvent.js";
import EarlyWarningAlert from "../models/EarlyWarningAlert.js";
import {
  LOCALITY_CENTERS,
  DEMO_LOCALITY_CENTERS,
} from "../../../../packages/shared/reportOptions.js";
import { tankerEligibility } from "./allocationEngine.js";
import { predictionSummary } from "./predictionService.js";
import { ApiError } from "../middleware/errors.js";

const MAX_TIME = 5000,
  MAX_TIMED_REPORTS = 5000;
const aggregate = (model, pipeline) =>
  model
    .aggregate(pipeline)
    .option({ maxTimeMS: MAX_TIME, allowDiskUse: false });
const range = (window) => ({ $gte: window.from, $lt: window.to });
const validDate = (field) => ({ $eq: [{ $type: field }, "date"] });
export const validLitres = {
  $and: [
    { $isNumber: "$litresDelivered" },
    { $gt: ["$litresDelivered", 0] },
    {
      $eq: [
        "$litresDelivered",
        {
          $trunc: {
            $cond: [{ $isNumber: "$litresDelivered" }, "$litresDelivered", 0],
          },
        },
      ],
    },
  ],
};
function minutes(from, to) {
  return {
    $cond: [
      { $and: [validDate(from), validDate(to), { $gte: [to, from] }] },
      { $divide: [{ $subtract: [to, from] }, 60000] },
      null,
    ],
  };
}
export function timingSummary(count = 0, mean = null, buckets = []) {
  return {
    count,
    averageMinutes:
      count && Number.isFinite(mean) ? Math.round(mean * 10) / 10 : null,
    distribution: [
      "UNDER_1_HOUR",
      "1_TO_6_HOURS",
      "6_TO_24_HOURS",
      "24_HOURS_OR_MORE",
    ].map((label, i) => ({ label, count: buckets[i] || 0 })),
  };
}
function bucketSums(field) {
  return [0, 60, 360, 1440].map((lo, i) => ({
    $sum: {
      $cond: [
        {
          $and: [
            { $isNumber: field },
            { $gte: [field, lo] },
            ...(i < 3 ? [{ $lt: [field, [60, 360, 1440][i]] }] : []),
          ],
        },
        1,
        0,
      ],
    },
  }));
}
function durationGroup(field) {
  return {
    _id: null,
    count: { $sum: { $cond: [{ $isNumber: field }, 1, 0] } },
    mean: { $avg: field },
    ...Object.fromEntries(
      bucketSums(field).map((value, i) => [`b${i}`, value]),
    ),
  };
}
const timing = (rows) => {
  const row = rows[0];
  return timingSummary(
    row?.count,
    row?.mean,
    [0, 1, 2, 3].map((i) => row?.[`b${i}`]),
  );
};
const groups = (field) => [
  { $group: { _id: field, count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
];
const count = (rows) => rows[0]?.count || 0;
function eventArea(areaId, demo) {
  if (!areaId) return [];
  return [
    {
      $lookup: {
        from: "shortageevents",
        localField: "eventId",
        foreignField: "_id",
        pipeline: [
          { $match: { isDemo: demo, areaId } },
          { $project: { _id: 1 } },
        ],
        as: "areaMatch",
      },
    },
    { $match: { "areaMatch.0": { $exists: true } } },
  ];
}
export async function analyticsAreas(demo) {
  const stored = await Area.find({ isDemo: demo })
    .select("_id name")
    .limit(51)
    .maxTimeMS(MAX_TIME)
    .lean();
  if (stored.length > 50)
    throw new ApiError(
      503,
      "ANALYTICS_CAPACITY",
      "Area catalog exceeds the supported analytics bound.",
    );
  const catalog = new Map(
    [...LOCALITY_CENTERS, ...(demo ? DEMO_LOCALITY_CENTERS : [])].map((a) => [
      a.id,
      { id: a.id, name: a.name },
    ]),
  );
  for (const a of stored) catalog.set(a._id, { id: a._id, name: a.name });
  if (catalog.size > 50)
    throw new ApiError(
      503,
      "ANALYTICS_CAPACITY",
      "Area catalog exceeds the supported analytics bound.",
    );
  if (catalog.size > 50)
    throw new ApiError(
      503,
      "ANALYTICS_CAPACITY",
      "Area catalog exceeds the supported analytics bound.",
    );
  return [...catalog.values()];
}

async function reportTimings(filter, window, cohortSize) {
  if (cohortSize > MAX_TIMED_REPORTS)
    return {
      status: "CAPACITY_EXCEEDED",
      cohortSize,
      reportToRecommendation: null,
      reportToAssignment: null,
      reportToDelivery: null,
      pendingElapsed: null,
    };
  const lookup = (collection, time, alias, extra = []) => ({
    $lookup: {
      from: collection,
      let: {
        eventIds: "$linkedEvents._id",
        reportAt: "$createdAt",
        demo: "$isDemo",
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$isDemo", "$$demo"] },
                { $in: ["$eventId", "$$eventIds"] },
                validDate(`$${time}`),
                { $gte: [`$${time}`, "$$reportAt"] },
                { $lt: [`$${time}`, window.to] },
                ...extra,
              ],
            },
          },
        },
        { $sort: { [time]: 1, _id: 1 } },
        { $limit: 1 },
        { $project: { [time]: 1, _id: 0 } },
      ],
      as: alias,
    },
  });
  const [result] = await aggregate(Report, [
    { $match: { ...filter, verificationStatus: { $ne: "REJECTED" } } },
    {
      $lookup: {
        from: "shortageevents",
        localField: "_id",
        foreignField: "reportIds",
        pipeline: [
          { $match: { isDemo: filter.isDemo } },
          { $project: { _id: 1 } },
        ],
        as: "linkedEvents",
      },
    },
    lookup("allocations", "createdAt", "recommendations"),
    lookup("allocations", "assignedAt", "assignments"),
    lookup("deliveries", "deliveredAt", "deliveries", [
      { $eq: ["$status", "DELIVERED"] },
      { $eq: ["$otpVerified", true] },
      validLitres,
    ]),
    {
      $set: {
        recommendationMinutes: minutes("$createdAt", {
          $arrayElemAt: ["$recommendations.createdAt", 0],
        }),
        assignmentMinutes: minutes("$createdAt", {
          $arrayElemAt: ["$assignments.assignedAt", 0],
        }),
        deliveryMinutes: minutes("$createdAt", {
          $arrayElemAt: ["$deliveries.deliveredAt", 0],
        }),
        pendingMinutes: {
          $cond: [
            { $eq: [{ $size: "$deliveries" }, 0] },
            minutes("$createdAt", window.to),
            null,
          ],
        },
      },
    },
    {
      $facet: {
        recommendation: [{ $group: durationGroup("$recommendationMinutes") }],
        assignment: [{ $group: durationGroup("$assignmentMinutes") }],
        delivery: [{ $group: durationGroup("$deliveryMinutes") }],
        pending: [{ $group: durationGroup("$pendingMinutes") }],
      },
    },
  ]);
  return {
    status: "AVAILABLE",
    cohortSize,
    reportToRecommendation: timing(result.recommendation),
    reportToAssignment: timing(result.assignment),
    reportToDelivery: timing(result.delivery),
    pendingElapsed: timing(result.pending),
    note: "One earliest eligible milestone per non-rejected report, before the window end, from current stored event.reportIds associations. Excluded/duplicate reports have no eligible link. Area delivery is not household receipt; pending elapsed time is not a completed response time.",
  };
}

export async function municipalAnalytics(
  config,
  demo,
  query,
  now = new Date(),
) {
  const window = query.window,
    date = range(window),
    areas = await analyticsAreas(demo);
  if (query.areaId && !areas.some((a) => a.id === query.areaId))
    throw new ApiError(422, "VALIDATION_ERROR", "Choose a known service area.");
  const area = query.areaId ? { areaId: query.areaId } : {};
  const reportFilter = { isDemo: demo, createdAt: date, ...area };
  const collections = new Set(
    (
      await mongoose.connection.db
        .listCollections({}, { nameOnly: true, timeoutMS: MAX_TIME })
        .toArray()
    ).map((c) => c.name),
  );
  const [
    reports,
    allocations,
    deliveries,
    alerts,
    events,
    fleet,
    savedPredictions,
  ] = await Promise.all([
    aggregate(Report, [
      { $match: reportFilter },
      {
        $facet: {
          total: [{ $count: "count" }],
          status: groups("$verificationStatus"),
          byArea: [
            ...groups({ $ifNull: ["$areaId", "UNKNOWN"] }),
            { $limit: 51 },
          ],
          byDay: groups({
            $dateToString: {
              date: "$createdAt",
              format: "%Y-%m-%d",
              timezone: "UTC",
            },
          }),
          byHour: [
            ...groups({
              $dateToString: {
                date: "$createdAt",
                format: "%Y-%m-%dT%H:00:00.000Z",
                timezone: "UTC",
              },
            }),
            { $sort: { _id: -1 } },
            { $limit: 24 },
          ],
          unaudited: [
            { $match: { "audit.0": { $exists: false } } },
            { $count: "count" },
          ],
        },
      },
    ]),
    aggregate(Allocation, [
      {
        $match: {
          isDemo: demo,
          $or: [
            "createdAt",
            "approvedAt",
            "assignedAt",
            "rejectedAt",
            "audit.at",
          ].map((key) => ({ [key]: date })),
        },
      },
      ...eventArea(query.areaId, demo),
      {
        $facet: {
          created: [{ $match: { createdAt: date } }, { $count: "count" }],
          states: [{ $match: { createdAt: date } }, ...groups("$status")],
          approved: [{ $match: { approvedAt: date } }, { $count: "count" }],
          assigned: [{ $match: { assignedAt: date } }, { $count: "count" }],
          rejected: [{ $match: { rejectedAt: date } }, { $count: "count" }],
          assignedAreas: [
            { $match: { assignedAt: date } },
            {
              $lookup: {
                from: "shortageevents",
                localField: "eventId",
                foreignField: "_id",
                pipeline: [
                  { $match: { isDemo: demo } },
                  { $project: { areaId: 1 } },
                ],
                as: "event",
              },
            },
            ...groups({
              $ifNull: [{ $arrayElemAt: ["$event.areaId", 0] }, "UNKNOWN"],
            }),
            { $limit: 51 },
          ],
          conflicts: [
            { $unwind: "$audit" },
            {
              $match: {
                "audit.action": "OPERATION_CONFLICT",
                "audit.at": date,
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]),
    aggregate(Delivery, [
      {
        $match: {
          isDemo: demo,
          ...area,
          $or: ["createdAt", "deliveredAt", "audit.at"].map((key) => ({
            [key]: date,
          })),
        },
      },
      {
        $facet: {
          states: [{ $match: { createdAt: date } }, ...groups("$status")],
          completed: [
            {
              $match: {
                deliveredAt: date,
                status: "DELIVERED",
                otpVerified: true,
                $expr: validLitres,
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                litres: { $sum: "$litresDelivered" },
                syncPending: { $sum: { $cond: ["$syncPending", 1, 0] } },
              },
            },
          ],
          excluded: [
            {
              $match: {
                deliveredAt: date,
                status: "DELIVERED",
                $expr: {
                  $not: [
                    { $and: [{ $eq: ["$otpVerified", true] }, validLitres] },
                  ],
                },
              },
            },
            { $count: "count" },
          ],
          byArea: [
            {
              $match: {
                deliveredAt: date,
                status: "DELIVERED",
                otpVerified: true,
                $expr: validLitres,
              },
            },
            {
              $group: {
                _id: { $ifNull: ["$areaId", "UNKNOWN"] },
                count: { $sum: 1 },
                litres: { $sum: "$litresDelivered" },
                timed: {
                  $sum: {
                    $cond: [
                      { $isNumber: minutes("$requestedAt", "$deliveredAt") },
                      1,
                      0,
                    ],
                  },
                },
                mean: { $avg: minutes("$requestedAt", "$deliveredAt") },
              },
            },
            { $limit: 51 },
          ],
          response: [
            {
              $match: {
                deliveredAt: date,
                status: "DELIVERED",
                otpVerified: true,
                $expr: validLitres,
              },
            },
            { $set: { duration: minutes("$requestedAt", "$deliveredAt") } },
            { $group: durationGroup("$duration") },
          ],
          completion: [
            {
              $match: {
                deliveredAt: date,
                status: "DELIVERED",
                otpVerified: true,
                $expr: validLitres,
              },
            },
            { $set: { duration: minutes("$startedAt", "$deliveredAt") } },
            { $group: durationGroup("$duration") },
          ],
          failures: [
            { $unwind: "$audit" },
            {
              $match: {
                "audit.at": date,
                "audit.action": {
                  $in: [
                    "DELIVERY_OTP_REJECTED",
                    "DELIVERY_OTP_EXPIRED",
                    "DELIVERY_OTP_HANDOFF_FAILED",
                  ],
                },
              },
            },
            ...groups("$audit.action"),
          ],
          recovered: [
            { $unwind: "$audit" },
            {
              $match: {
                "audit.at": date,
                "audit.action": "DELIVERY_RECOVERED",
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]),
    aggregate(EarlyWarningAlert, [
      {
        $match: {
          isDemo: demo,
          ...area,
          $or: [{ createdAt: date }, { "audit.at": date }],
        },
      },
      {
        $facet: {
          created: [{ $match: { createdAt: date } }, { $count: "count" }],
          states: [{ $match: { createdAt: date } }, ...groups("$status")],
          risk: [
            { $match: { createdAt: date } },
            ...groups("$result.riskLevel"),
          ],
          areas: [
            { $match: { createdAt: date } },
            ...groups("$areaId"),
            { $limit: 51 },
          ],
          activity: [
            { $unwind: "$audit" },
            { $match: { "audit.at": date } },
            ...groups("$audit.type"),
          ],
        },
      },
    ]),
    ShortageEvent.find({
      isDemo: demo,
      ...area,
      status: { $in: ["ACTIVE", "EMERGING"] },
    })
      .select(
        "areaId areaName status severityLevel eligibleReportCount verifiedReportCount duplicateReportCount suspiciousReportCount calculatedAt",
      )
      .limit(1001)
      .maxTimeMS(MAX_TIME)
      .lean(),
    Tanker.find({ isDemo: demo })
      .select(
        "status capacityLitres availableLitres observedAt operatorId activeAllocationId",
      )
      .limit(1001)
      .maxTimeMS(MAX_TIME)
      .lean(),
    predictionSummary(config, demo),
  ]);
  if (
    events.length > 1000 ||
    fleet.length > 1000 ||
    [
      reports[0].byArea,
      allocations[0].assignedAreas,
      deliveries[0].byArea,
      alerts[0].areas,
    ].some((r) => r.length > 50)
  )
    throw new ApiError(
      503,
      "ANALYTICS_CAPACITY",
      "Analytics capacity exceeded; no partial totals are presented.",
    );
  const r = reports[0],
    a = allocations[0],
    d = deliveries[0],
    w = alerts[0];
  const totalReports = count(r.total),
    reportStates = Object.fromEntries(r.status.map((x) => [x._id, x.count]));
  const validOperators = new Set(
    (
      await User.find({
        _id: { $in: fleet.map((t) => t.operatorId).filter(Boolean) },
        role: "OPERATOR",
        disabled: false,
      })
        .select("_id")
        .limit(1001)
        .maxTimeMS(MAX_TIME)
        .lean()
    ).map((u) => String(u._id)),
  );
  const fleetKnown = collections.has("tankers"),
    deliveredKnown = collections.has("deliveries");
  const busy = fleet.filter(
    (t) =>
      t.activeAllocationId ||
      ["ASSIGNED", "EN_ROUTE", "ARRIVED"].includes(t.status),
  ).length;
  const eligible = fleet.filter(
    (t) =>
      tankerEligibility(
        {
          ...t,
          operatorId: validOperators.has(String(t.operatorId))
            ? t.operatorId
            : null,
        },
        config,
        now,
      ).eligible,
  ).length;
  const areaRows = new Map(
    areas.map((ar) => [
      ar.id,
      {
        areaId: ar.id,
        area: ar.name,
        reports: 0,
        allocations: 0,
        deliveredLitres: deliveredKnown ? 0 : null,
        completedDeliveries: 0,
        timedDeliveries: 0,
        averageResponseMinutes: null,
      },
    ]),
  );
  const row = (id) => {
    const key = areaRows.has(id) ? id : "UNKNOWN";
    if (!areaRows.has(key))
      areaRows.set(key, {
        areaId: null,
        area: "Unknown service area",
        reports: 0,
        allocations: 0,
        deliveredLitres: deliveredKnown ? 0 : null,
        completedDeliveries: 0,
        timedDeliveries: 0,
        averageResponseMinutes: null,
      });
    return areaRows.get(key);
  };
  for (const e of r.byArea) row(e._id).reports += e.count;
  for (const e of a.assignedAreas) row(e._id).allocations += e.count;
  for (const e of d.byArea) {
    const ar = row(e._id);
    ar.deliveredLitres = (ar.deliveredLitres || 0) + e.litres;
    ar.completedDeliveries += e.count;
    if (e.timed) ar.responseSum = (ar.responseSum || 0) + e.mean * e.timed;
    ar.timedDeliveries += e.timed;
    if (ar.timedDeliveries)
      ar.averageResponseMinutes =
        Math.round((ar.responseSum / ar.timedDeliveries) * 10) / 10;
  }
  const timed = await reportTimings(
    reportFilter,
    window,
    totalReports - (reportStates.REJECTED || 0),
  );
  const predictions = savedPredictions.results.filter(
      (p) => !query.areaId || p.areaId === query.areaId,
    ),
    supported = predictions.filter(
      (p) => p.retrievalStatus === "CURRENT" && p.forecast,
    );
  return {
    window,
    generatedAt: now,
    areaId: query.areaId || null,
    areas,
    isDemo: demo,
    reports: {
      total: totalReports,
      verified: reportStates.VERIFIED || 0,
      pendingVerification: reportStates.PENDING || 0,
      rejected: reportStates.REJECTED || 0,
      unverified: totalReports - (reportStates.VERIFIED || 0),
      withoutCreationAudit: count(r.unaudited),
      byDay: r.byDay.map((x) => ({ day: x._id, count: x.count })),
      reviewTime: {
        status: "NOT_RECORDED",
        averageMinutes: null,
        denominator: 0,
      },
      timings: timed,
    },
    allocations: {
      recommended: count(a.created),
      approved: count(a.approved),
      rejected: count(a.rejected),
      assigned: count(a.assigned),
      states: a.states.map((x) => ({ status: x._id, count: x.count })),
      conflicts: count(a.conflicts),
    },
    deliveries: {
      completed: d.completed[0]?.count || 0,
      litres: d.completed[0]?.litres || 0,
      pendingSynchronization: d.completed[0]?.syncPending || 0,
      excludedCompletedRecords: count(d.excluded),
      response: timing(d.response),
      completion: timing(d.completion),
      states: d.states.map((x) => ({ status: x._id, count: x.count })),
      failedOtpEvents: d.failures.map((x) => ({
        eventType: x._id,
        count: x.count,
      })),
      recovered: count(d.recovered),
    },
    alerts: {
      created: count(w.created),
      states: w.states.map((x) => ({ status: x._id, count: x.count })),
      risks: w.risk.map((x) => ({ riskLevel: x._id, count: x.count })),
      areas: w.areas.map((x) => ({
        areaId: areas.some((a) => a.id === x._id) ? x._id : null,
        count: x.count,
      })),
      activity: w.activity.map((x) => ({ eventType: x._id, count: x.count })),
    },
    current: {
      scope: "STORED_CURRENT_SNAPSHOTS",
      activeCases: events.filter((e) => e.status === "ACTIVE").length,
      emergingCases: events.filter((e) => e.status === "EMERGING").length,
      resolvedCases: null,
      calculatedAt:
        events
          .map((e) => e.calculatedAt)
          .filter(Boolean)
          .sort((x, y) => x - y)[0] || null,
    },
    predictions: {
      scope: "CURRENT_SAVED_PHASE_8_ACTIVITY_FORECASTS",
      status: supported.length
        ? "AVAILABLE"
        : predictions.some(
              (p) =>
                p.retrievalStatus === "CURRENT" &&
                p.riskLevel === "INSUFFICIENT_DATA",
            )
          ? "INSUFFICIENT_DATA"
          : predictions.every((p) => p.retrievalStatus === "NOT_EVALUATED")
            ? "NOT_EVALUATED"
            : "UNAVAILABLE",
      supportedAreas: supported.length,
      areas: predictions.length,
      highRiskAreas: supported.length
        ? supported.filter((p) => ["HIGH", "CRITICAL"].includes(p.riskLevel))
            .length
        : null,
      providerRequested: false,
    },
    severityDistribution: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
      (level) => ({
        level,
        count: events.filter((e) => e.severityLevel === level).length,
      }),
    ),
    reportsByHour: r.byHour
      .reverse()
      .map((x) => ({ hour: x._id, count: x.count })),
    evidence: {
      eligibleHouseholds: events.reduce(
        (n, e) => n + (e.eligibleReportCount || 0),
        0,
      ),
      verifiedReports: events.reduce(
        (n, e) => n + (e.verifiedReportCount || 0),
        0,
      ),
      duplicateReports: events.reduce(
        (n, e) => n + (e.duplicateReportCount || 0),
        0,
      ),
      suspiciousReports: events.reduce(
        (n, e) => n + (e.suspiciousReportCount || 0),
        0,
      ),
    },
    operational: {
      areas: [...areaRows.values()]
        .map((ar) => {
          const result = { ...ar };
          delete result.responseSum;
          return result;
        })
        .filter((ar) => !query.areaId || ar.areaId === query.areaId),
      fleetCount: fleetKnown ? fleet.length : null,
      busyTankers: fleetKnown ? busy : null,
      availableTankers: fleetKnown ? eligible : null,
      utilizationPercent:
        fleetKnown && fleet.length
          ? Math.round((busy / fleet.length) * 1000) / 10
          : null,
      estimatedPeopleServed: null,
      unservedHighPriorityAreas: events
        .filter(
          (e) =>
            e.status === "ACTIVE" &&
            ["HIGH", "CRITICAL"].includes(e.severityLevel) &&
            !(areaRows.get(e.areaId)?.completedDeliveries > 0),
        )
        .map((e) => ({
          area:
            areas.find((a) => a.id === e.areaId)?.name ||
            "Unknown service area",
          severity: e.severityLevel,
          deliveryRecorded: deliveredKnown ? false : null,
        })),
      note: "Windowed assignments and accepted recorded deliveries, counted once per record. Fleet utilization is a global current snapshot of busy/reserved records divided by all stored fleet records; it is not time utilization. Missing service history is not proof that no water was delivered. People served and physical shortage resolution are unknown.",
    },
    note: "Historical counts use the selected UTC window; reports include repeats/unverified submissions. Severity/evidence are stored non-historical assessment snapshots, not historical severity or confirmed physical resolution. Event evidence totals may overlap across clusters and are not unique households. Hourly chart shows only the latest 24 reporting hours inside the window. Observed statistics and saved activity forecasts are separate. No Gemini call or recalculation occurs on this read.",
  };
}
