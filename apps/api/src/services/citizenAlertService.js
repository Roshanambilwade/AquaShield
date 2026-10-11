import CitizenAdvisory from "../models/CitizenAdvisory.js";
import AdvisoryReadState from "../models/AdvisoryReadState.js";
import User from "../models/User.js";
import Report from "../models/Report.js";
import Delivery from "../models/Delivery.js";
import Prediction from "../models/Prediction.js";
import { predictionAreas, presented } from "./predictionService.js";
import { fingerprint } from "./predictionEngine.js";
import { auditEntry } from "./auditContext.js";
import { ApiError } from "../middleware/errors.js";
const initialized = new WeakMap();
async function storage() {
  const db = CitizenAdvisory.db.db;
  if (!initialized.has(db))
    initialized.set(
      db,
      Promise.all([
        CitizenAdvisory.createIndexes(),
        AdvisoryReadState.createIndexes(),
      ]).catch((e) => {
        initialized.delete(db);
        throw e;
      }),
    );
  await initialized.get(db);
}
const conflict = () =>
  new ApiError(
    409,
    "OPERATION_CONFLICT",
    "This advisory changed or is no longer active.",
  );
const invalid = () =>
  new ApiError(
    422,
    "VALIDATION_ERROR",
    "Select supported, current evidence for this area and advisory category.",
  );
export async function citizenAreas(demo) {
  return (await predictionAreas(demo)).map(({ id, name }) => ({ id, name }));
}
export async function citizenPreference(userId, demo, areaId) {
  const areas = await citizenAreas(demo);
  if (areaId !== undefined) {
    if (areaId !== null && !areas.some((a) => a.id === areaId)) throw invalid();
    await User.updateOne(
      { _id: userId, role: "CITIZEN", disabled: false },
      { $set: { preferredAreaId: areaId } },
      { runValidators: true },
    );
  }
  const user = await User.findById(userId).select("preferredAreaId").lean();
  return {
    areaId: areas.some((a) => a.id === user?.preferredAreaId)
      ? user.preferredAreaId
      : null,
    areas,
  };
}
function projection(a, readAt, now = new Date()) {
  return {
    id: String(a._id),
    areaId: a.areaId,
    areaName: a.areaName,
    audience: a.audience,
    category: a.category,
    title: a.title,
    message: a.message,
    provenance: a.provenance,
    isDemo: a.isDemo,
    status: a.status === "ACTIVE" && a.expiresAt <= now ? "EXPIRED" : a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    expiresAt: a.expiresAt,
    readAt: readAt || null,
    unread: !readAt,
  };
}
async function relevance(userId, demo) {
  const { areaId } = await citizenPreference(userId, demo);
  return {
    isDemo: demo,
    $or: [
      { audience: "MUNICIPAL" },
      ...(areaId ? [{ audience: "AREA", areaId }] : []),
    ],
  };
}
export async function citizenInbox(userId, demo, { page, limit, history }) {
  const now = new Date();
  const relevant = await relevance(userId, demo);
  const active = { ...relevant, status: "ACTIVE", expiresAt: { $gt: now } };
  const filter = history ? relevant : active;
  const [rows, count] = await Promise.all([
    CitizenAdvisory.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .maxTimeMS(5000)
      .lean(),
    CitizenAdvisory.aggregate([
      { $match: active },
      {
        $lookup: {
          from: "advisoryreadstates",
          let: { advisory: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$advisoryId", "$$advisory"] },
                    { $eq: ["$userId", User.schema.path("_id").cast(userId)] },
                    { $ne: ["$readAt", null] },
                  ],
                },
              },
            },
          ],
          as: "reads",
        },
      },
      { $match: { "reads.0": { $exists: false } } },
      { $count: "unread" },
    ]).option({ maxTimeMS: 5000 }),
  ]);
  const reads = await AdvisoryReadState.find({
    userId,
    advisoryId: { $in: rows.map((a) => a._id) },
  }).lean();
  return {
    notifications: rows
      .slice(0, limit)
      .map((a) =>
        projection(
          a,
          reads.find((r) => String(r.advisoryId) === String(a._id))?.readAt,
          now,
        ),
      ),
    unreadCount: count[0]?.unread || 0,
    page,
    limit,
    hasMore: rows.length > limit,
  };
}
export async function markAdvisory(userId, demo, id, read) {
  await storage();
  const advisory = await CitizenAdvisory.findOne({
    _id: id,
    ...(await relevance(userId, demo)),
  }).lean();
  if (!advisory)
    throw new ApiError(
      404,
      "ADVISORY_NOT_FOUND",
      "This advisory is not available.",
    );
  const readAt = read ? new Date() : null;
  try {
    await AdvisoryReadState.updateOne(
      { userId, advisoryId: id },
      { $set: { readAt } },
      { upsert: true, runValidators: true },
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
    await AdvisoryReadState.updateOne(
      { userId, advisoryId: id },
      { $set: { readAt } },
    );
  }
  return projection(advisory, readAt);
}
const templates = {
  SUPPLY_REVIEW: [
    "Supply evidence reviewed",
    "Municipal staff reviewed submitted supply evidence for this service area. Review does not establish physical recovery or verify every household.",
  ],
  DELIVERY_RECORDED: [
    "Area delivery recorded",
    "A delivery with accepted receipt verification was recorded for this service area. This does not confirm delivery to every household or restoration of supply.",
  ],
  ACTIVITY_WATCH: [
    "Report activity watch",
    "Supported numerical history indicates elevated report activity. Municipal investigation is recommended; this is not a calibrated prediction of physical shortage.",
  ],
  DEMONSTRATION: [
    "Simulated local advisory",
    "This is a simulated municipal advisory for the demonstration. It does not establish a real-world emergency.",
  ],
};
export async function publishAdvisory(input, actor, config, demo) {
  if (actor.role !== "ADMIN")
    throw new ApiError(403, "ADMIN_REQUIRED", "Administrator access required.");
  // MongoDB ObjectId spelling must not create two identities for one event.
  if (input.sourceType !== "SIMULATED")
    input = { ...input, sourceId: input.sourceId.toLowerCase() };
  const area = (await citizenAreas(demo)).find((a) => a.id === input.areaId);
  if (!area) throw invalid();
  const now = new Date();
  if (input.sourceType === "SIMULATED") {
    if (
      !demo ||
      config.NODE_ENV === "production" ||
      config.DEMONSTRATION_MODE !== true ||
      input.category !== "DEMONSTRATION"
    )
      throw invalid();
  } else {
    if (!/^[a-f0-9]{24}$/i.test(input.sourceId)) throw invalid();
    const Model = {
      REPORT: Report,
      DELIVERY: Delivery,
      PREDICTION: Prediction,
    }[input.sourceType];
    const row = await Model.findOne({
      _id: input.sourceId,
      isDemo: demo,
      areaId: input.areaId,
    }).lean();
    if (!row) throw invalid();
    if (
      input.sourceType === "REPORT" &&
      (input.category !== "SUPPLY_REVIEW" ||
        row.verificationStatus !== "VERIFIED" ||
        !row.reviewedAt ||
        +now - +new Date(row.reviewedAt) > 86400000)
    )
      throw invalid();
    if (
      input.sourceType === "DELIVERY" &&
      (input.category !== "DELIVERY_RECORDED" ||
        row.status !== "DELIVERED" ||
        !row.otpVerified ||
        !row.deliveredAt ||
        +now - +new Date(row.deliveredAt) > 86400000)
    )
      throw invalid();
    if (
      input.sourceType === "PREDICTION" &&
      (input.category !== "ACTIVITY_WATCH" ||
        row.inputSource === "SYNTHETIC_FORECAST" ||
        !row.result?.forecast ||
        !Number.isFinite(+new Date(row.result.forecast.end)) ||
        !["HIGH", "CRITICAL"].includes(row.result.riskLevel) ||
        presented(row.result, config, now).retrievalStatus !== "CURRENT" ||
        row.result.quality?.freshness !== "RECENT")
    )
      throw invalid();
  }
  await storage();
  const key = fingerprint([
    demo,
    input.audience,
    input.areaId,
    input.category,
    input.sourceType,
    input.sourceId,
  ]);
  const [title, message] = templates[input.category];
  const fields = {
    key,
    ...input,
    areaName: area.name,
    title,
    message,
    isDemo: demo,
    provenance: demo
      ? "SIMULATED_MUNICIPAL_ADVISORY"
      : "MUNICIPAL_EVIDENCE_ADVISORY",
    publishedBy: actor.id,
    expiresAt: new Date(+now + input.expiresInHours * 3600000),
    audit: [
      auditEntry("ADVISORY_PUBLISHED", actor, { after: { status: "ACTIVE" } }),
    ],
  };
  delete fields.expiresInHours;
  let row;
  try {
    row = await CitizenAdvisory.findOneAndUpdate(
      { key },
      { $setOnInsert: { ...fields, createdAt: now, updatedAt: now } },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        timestamps: false,
      },
    ).lean();
  } catch (e) {
    if (e.code !== 11000) throw e;
    row = await CitizenAdvisory.findOne({ key }).lean();
  }
  return { ...projection(row, null), revision: row.revision };
}
export async function municipalAdvisories(demo, page, limit) {
  const rows = await CitizenAdvisory.find({ isDemo: demo })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .maxTimeMS(5000)
    .lean();
  return {
    notifications: rows
      .slice(0, limit)
      .map((a) => ({ ...projection(a, null), revision: a.revision })),
    page,
    hasMore: rows.length > limit,
  };
}
export async function withdrawAdvisory(id, demo, revision, actor) {
  const row = await CitizenAdvisory.findOneAndUpdate(
    { _id: id, isDemo: demo, revision, status: "ACTIVE" },
    {
      $set: { status: "WITHDRAWN" },
      $inc: { revision: 1 },
      $push: {
        audit: auditEntry("ADVISORY_WITHDRAWN", actor, {
          before: { status: "ACTIVE" },
          after: { status: "WITHDRAWN" },
        }),
      },
    },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw conflict();
  return projection(row, null);
}
