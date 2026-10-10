import mongoose from "mongoose";
import Delivery from "../models/Delivery.js";
import Allocation from "../models/Allocation.js";
import Tanker from "../models/Tanker.js";
import ShortageEvent from "../models/ShortageEvent.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import { ApiError } from "../middleware/errors.js";
import { conflict } from "./operationsService.js";
import { validPoint, tripRoute } from "./routingService.js";
import { generateOtp, matchesOtp } from "./deliveryOtp.js";
import { demonstration } from "../config/demonstration.js";

const initialized = new WeakMap();
const audit = (action, actor) => ({
  action,
  actorId: actor.id,
  at: new Date(),
});
export async function initializeDeliveries() {
  const db = mongoose.connection.db;
  if (!initialized.has(db))
    initialized.set(
      db,
      Delivery.createIndexes().catch((e) => {
        initialized.delete(db);
        throw e;
      }),
    );
  return initialized.get(db);
}
export function serializeDelivery(d) {
  const value = d.toObject ? d.toObject() : d;
  const fields = [
    "allocationId",
    "eventId",
    "tankerId",
    "operatorId",
    "areaId",
    "areaName",
    "destination",
    "origin",
    "originObservedAt",
    "isDemo",
    "status",
    "plannedLitres",
    "capacityLitres",
    "startingAvailableLitres",
    "litresDelivered",
    "requestedAt",
    "assignedAt",
    "startedAt",
    "arrivedAt",
    "deliveredAt",
    "otpVerified",
    "verifiedAt",
    "verificationMethod",
    "otpExpiresAt",
    "otpAttempts",
    "syncPending",
    "audit",
  ];
  return {
    id: String(value._id),
    ...Object.fromEntries(
      fields
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, value[key]]),
    ),
  };
}
export async function ensureDelivery(allocation) {
  await initializeDeliveries();
  const found = await Delivery.findOne({ allocationId: allocation._id });
  if (found) return found;
  if (allocation.status !== "ASSIGNED")
    throw conflict("Only assigned allocations have trips.");
  const [event, tanker] = await Promise.all([
    ShortageEvent.findOne({
      _id: allocation.eventId,
      isDemo: allocation.isDemo,
    }).lean(),
    Tanker.findOne({
      _id: allocation.tankerId,
      isDemo: allocation.isDemo,
      activeAllocationId: allocation._id,
      operatorId: allocation.operatorId,
    }).lean(),
  ]);
  if (
    !event ||
    !tanker ||
    !allocation.operatorId ||
    !Number.isFinite(tanker.availableLitres) ||
    tanker.availableLitres <= 0
  )
    throw conflict(
      "The assignment records need municipal review before starting a trip.",
    );
  // Keep the approved destination; never accept a destination from the client.
  const destination = allocation.evidence.rankings.find(
    (r) => r.eventId === String(allocation.eventId),
  );
  const data = {
    allocationId: allocation._id,
    eventId: allocation.eventId,
    tankerId: allocation.tankerId,
    operatorId: allocation.operatorId,
    areaId: event.areaId,
    areaName: destination?.area || event.areaName,
    destination: validPoint(destination?.center) ? destination.center : null,
    origin: validPoint(tanker.currentLocation) ? tanker.currentLocation : null,
    originObservedAt: tanker.observedAt,
    status: "ASSIGNED",
    isDemo: allocation.isDemo,
    plannedLitres: allocation.evidence.proposedLitres ?? null,
    capacityLitres: tanker.capacityLitres,
    startingAvailableLitres: tanker.availableLitres,
    requestedAt: allocation.createdAt,
    assignedAt: allocation.assignedAt,
  };
  try {
    const created = await Delivery.findOneAndUpdate(
      { allocationId: allocation._id },
      { $setOnInsert: data },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    if (
      !(await Allocation.exists({ _id: allocation._id, status: "ASSIGNED" }))
    ) {
      await Delivery.deleteOne({ _id: created._id, status: "ASSIGNED" });
      throw conflict("The assignment changed while preparing its trip.");
    }
    return created;
  } catch (e) {
    if (e.code !== 11000) throw e;
    return Delivery.findOne({ allocationId: allocation._id });
  }
}
export async function deliveryById(id, actor, config, { secret = false } = {}) {
  const filter = {
    _id: id,
    ...(actor.role === "OPERATOR" ? { operatorId: actor.id } : {}),
    ...(actor.role === "CITIZEN"
      ? { recipientId: actor.id, isDemo: demonstration(config) }
      : {}),
    ...(config.NODE_ENV === "production" ? { isDemo: false } : {}),
  };
  const query = Delivery.findOne(filter);
  if (secret) query.select("+otpHash +otpSalt");
  const record = await query;
  if (!record)
    throw new ApiError(404, "DELIVERY_NOT_FOUND", "Delivery not found.");
  return record;
}
async function reservation(d) {
  const [allocation, tanker] = await Promise.all([
    Allocation.findOne({
      _id: d.allocationId,
      eventId: d.eventId,
      tankerId: d.tankerId,
      operatorId: d.operatorId,
      isDemo: d.isDemo,
      status: "ASSIGNED",
    }),
    Tanker.findOne({
      _id: d.tankerId,
      activeAllocationId: d.allocationId,
      operatorId: d.operatorId,
      isDemo: d.isDemo,
    }),
  ]);
  if (!allocation || !tanker)
    throw conflict("The trip reservation requires municipal review.");
  return tanker;
}
export async function listDeliveries(actor, config, demo) {
  // Include pre-Phase-7 assignments without migrating or resetting the database.
  const filter = {
    ...(actor.role === "OPERATOR"
      ? { operatorId: actor.id }
      : { isDemo: demo }),
    ...(config.NODE_ENV === "production" ? { isDemo: false } : {}),
  };
  const assigned = await Allocation.find({
    ...filter,
    status: "ASSIGNED",
  }).limit(201);
  if (assigned.length > 200)
    throw new ApiError(
      503,
      "OPERATIONS_CAPACITY",
      "Trip capacity exceeded; pagination is required.",
    );
  for (const a of assigned) await ensureDelivery(a);
  const records = await Delivery.find(filter)
    .sort({ assignedAt: -1 })
    .limit(200);
  for (const d of records)
    if (["EN_ROUTE", "ARRIVED"].includes(d.status)) await syncTripTanker(d);
  return records.map(serializeDelivery);
}
export async function deliveryDetail(id, actor, config) {
  const delivery = await deliveryById(id, actor, config);
  return {
    delivery: serializeDelivery(delivery),
    route: await tripRoute(delivery.toObject(), config),
  };
}
export async function transitionTrip(id, action, actor, config) {
  const current = await deliveryById(id, actor, config);
  const from = action === "start" ? "ASSIGNED" : "EN_ROUTE",
    to = action === "start" ? "EN_ROUTE" : "ARRIVED";
  if (current.status !== from)
    throw conflict("This trip transition is not allowed in its current state.");
  await reservation(current);
  const updated = await Delivery.findOneAndUpdate(
    { _id: id, operatorId: actor.id, status: from },
    {
      $set: {
        status: to,
        [action === "start" ? "startedAt" : "arrivedAt"]: new Date(),
      },
      $push: {
        audit: audit(
          action === "start" ? "TRIP_STARTED" : "TANKER_ARRIVED",
          actor,
        ),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw conflict();
  await syncTripTanker(updated);
  return serializeDelivery(updated);
}
async function syncTripTanker(d) {
  // Only advance, never regress a concurrent later transition. Reservation
  // ownership remains held even if this projection write is interrupted.
  const allowed =
    d.status === "EN_ROUTE" ? ["ASSIGNED"] : ["ASSIGNED", "EN_ROUTE"];
  await Tanker.updateOne(
    {
      _id: d.tankerId,
      activeAllocationId: d.allocationId,
      status: { $in: allowed },
    },
    { $set: { status: d.status }, $inc: { revision: 1 } },
  );
}
export async function issueDeliveryOtp(
  id,
  actor,
  config,
  { revealDemo = false, revealRecipient = false, handoff } = {},
) {
  const d = await deliveryById(id, actor, config);
  if (
    revealRecipient &&
    (actor.role !== "CITIZEN" ||
      (d.isDemo && !demonstration(config)) ||
      String(d.recipientId) !== actor.id)
  )
    throw new ApiError(
      403,
      "CITIZEN_REQUIRED",
      "Only the designated citizen recipient can obtain this code.",
    );
  if (revealDemo && (config.NODE_ENV === "production" || !d.isDemo))
    throw new ApiError(
      403,
      "DEMO_DISABLED",
      "OTP reveal is limited to fictional non-production deliveries.",
    );
  if (d.status !== "ARRIVED" || d.otpVerified)
    throw conflict(
      "Arrival is required and verified codes cannot be reissued.",
    );
  await reservation(d);
  if (!d.isDemo && !handoff && !revealRecipient)
    throw new ApiError(
      503,
      "VERIFICATION_UNAVAILABLE",
      "A secure recipient OTP handoff channel is not configured. No code was issued.",
    );
  const { code, salt, hash } = await generateOtp(d);
  const now = new Date();
  const updated = await Delivery.findOneAndUpdate(
    {
      _id: id,
      status: "ARRIVED",
      otpVerified: false,
      otpVersion: d.otpVersion,
      $or: [{ otpNextIssueAt: { $lte: now } }, { otpNextIssueAt: null }],
    },
    {
      $set: {
        otpHash: hash,
        otpChannel: d.isDemo
          ? "DEMO_OTP"
          : revealRecipient
            ? "CITIZEN_PORTAL_OTP"
            : "RECIPIENT_OTP",
        otpSalt: salt,
        otpIssuedAt: now,
        otpExpiresAt: new Date(+now + config.DELIVERY_OTP_TTL_SECONDS * 1000),
        otpNextIssueAt: new Date(
          +now + config.DELIVERY_OTP_REISSUE_SECONDS * 1000,
        ),
        otpAttempts: 0,
      },
      $inc: { otpVersion: 1 },
      $push: { audit: audit("DELIVERY_OTP_GENERATED", actor) },
    },
    { returnDocument: "after" },
  );
  if (!updated)
    throw conflict(
      "An OTP was recently issued or the trip changed. Wait before requesting another.",
    );
  if (!d.isDemo && !revealRecipient) {
    try {
      await handoff({
        code,
        deliveryId: String(d._id),
        eventId: String(d.eventId),
      });
    } catch {
      await Delivery.updateOne(
        { _id: id, otpVersion: updated.otpVersion, otpVerified: false },
        { $unset: { otpHash: "", otpSalt: "" } },
      );
      throw new ApiError(
        503,
        "VERIFICATION_UNAVAILABLE",
        "The recipient handoff failed. The code was invalidated.",
      );
    }
  }
  return {
    delivery: serializeDelivery(updated),
    ...(revealRecipient
      ? { recipientOtp: code, expiresAt: updated.otpExpiresAt }
      : {}),
    ...(revealDemo
      ? {
          demoOtp: code,
          notice:
            "Demo-only code; no SMS sent and no independent real-world verification.",
        }
      : {}),
  };
}
export async function verifyDeliveryOtp(id, code, actor, config) {
  const d = await deliveryById(id, actor, config, { secret: true });
  if (d.status !== "ARRIVED" || d.otpVerified)
    throw conflict("This delivery cannot accept another verification.");
  await reservation(d);
  const now = new Date();
  if (
    !d.otpHash ||
    !d.otpExpiresAt ||
    d.otpExpiresAt <= now ||
    d.otpAttempts >= config.DELIVERY_OTP_MAX_ATTEMPTS
  ) {
    if (d.otpHash && d.otpExpiresAt <= now)
      await Delivery.updateOne(
        {
          _id: id,
          otpVersion: d.otpVersion,
          otpVerified: false,
          otpHash: d.otpHash,
        },
        {
          $unset: { otpHash: "", otpSalt: "" },
          $push: { audit: audit("DELIVERY_OTP_EXPIRED", actor) },
        },
      );
    throw new ApiError(
      422,
      "OTP_INVALID",
      "The code is invalid, expired or locked. Request a new code when permitted.",
    );
  }
  const matches = await matchesOtp(code, d);
  const filter = {
    _id: id,
    status: "ARRIVED",
    otpVerified: false,
    otpVersion: d.otpVersion,
    otpAttempts: d.otpAttempts,
    otpExpiresAt: { $gt: new Date() },
  };
  const update = matches
    ? {
        $set: {
          otpVerified: true,
          verifiedAt: new Date(),
          verificationMethod:
            d.otpChannel || (d.isDemo ? "DEMO_OTP" : "RECIPIENT_OTP"),
        },
        $unset: { otpHash: "", otpSalt: "" },
        $push: { audit: audit("DELIVERY_VERIFIED", actor) },
      }
    : {
        $inc: { otpAttempts: 1 },
        $push: { audit: audit("DELIVERY_OTP_REJECTED", actor) },
      };
  const updated = await Delivery.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
  if (!updated)
    throw conflict(
      "Verification changed during this request. Refresh before retrying.",
    );
  if (!matches)
    throw new ApiError(
      422,
      "OTP_INVALID",
      "The code did not match. Verification attempts are limited.",
    );
  return serializeDelivery(updated);
}
// A citizen-initiated handoff needs no SMS service and stores only the OTP hash.
// Select the earliest eligible account-backed report server-side, once per trip.
// Duplicate/suspicious or ownerless reports never authorize code access.
export async function citizenDeliveryOtp(reportId, actor, config) {
  const demo = demonstration(config);
  const report = await Report.findOne({
    _id: reportId,
    ownerId: actor.id,
    isDemo: demo,
  });
  if (!report) throw new ApiError(404, "REPORT_NOT_FOUND", "Report not found.");
  const events = await ShortageEvent.find({
    isDemo: demo,
    reportIds: report._id,
  })
    .select("reportIds")
    .lean();
  const allocation = await Allocation.findOne({
    isDemo: demo,
    status: "ASSIGNED",
    eventId: { $in: events.map((e) => e._id) },
  }).sort({ assignedAt: -1 });
  if (!allocation)
    throw conflict("No assigned delivery is available for this report.");
  const d = await ensureDelivery(allocation);
  if (!d.recipientId) {
    const event = events.find(
      (e) => String(e._id) === String(allocation.eventId),
    );
    const reports = await Report.find({
      _id: { $in: event.reportIds },
      isDemo: demo,
      ownerId: { $ne: null },
    })
      .sort({ createdAt: 1, _id: 1 })
      .select("ownerId")
      .lean();
    const active = await User.find({
      _id: { $in: reports.map((r) => r.ownerId) },
      role: "CITIZEN",
      disabled: false,
    })
      .select("_id")
      .lean();
    const activeIds = new Set(active.map((u) => String(u._id)));
    const recipient = reports.find((r) => activeIds.has(String(r.ownerId)));
    if (!recipient)
      throw conflict("No eligible citizen recipient is available.");
    await Delivery.updateOne(
      { _id: d._id, recipientId: null, status: "ARRIVED", otpVerified: false },
      {
        $set: { recipientId: recipient.ownerId },
        $push: { audit: audit("CITIZEN_RECIPIENT_SELECTED", actor) },
      },
    );
  }
  const result = await issueDeliveryOtp(String(d._id), actor, config, {
    revealRecipient: true,
  });
  return {
    recipientOtp: result.recipientOtp,
    expiresAt: result.expiresAt,
    notice: demo
      ? "Demonstration recipient handoff. No SMS sent; simulated verification only, not independent household delivery proof."
      : "Citizen portal handoff. Share this code with the assigned operator only after observing the area delivery. Your identity and household receipt are not independently verified.",
  };
}
export async function completeDelivery(id, litres, actor, config) {
  const d = await deliveryById(id, actor, config);
  if (d.status !== "ARRIVED" || !d.otpVerified)
    throw conflict(
      "A arrived trip and valid OTP verification are required before completion.",
    );
  const tanker = await reservation(d);
  const max = Math.min(
    d.capacityLitres,
    d.startingAvailableLitres,
    tanker.capacityLitres,
    tanker.availableLitres ?? 0,
    d.plannedLitres ?? Infinity,
  );
  if (!Number.isInteger(litres) || litres <= 0 || litres > max)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Actual litres must be positive and cannot exceed approved water, available water or capacity.",
    );
  const claimed = await Delivery.findOneAndUpdate(
    { _id: id, status: "ARRIVED", otpVerified: true },
    {
      $set: {
        status: "COMPLETING",
        litresDelivered: litres,
        completionActorId: actor.id,
        syncPending: true,
      },
    },
    { returnDocument: "after" },
  );
  if (!claimed)
    throw conflict("Delivery completion is already in progress or finished.");
  return reconcileDelivery(claimed, actor);
}
export async function recoverDelivery(id, actor, config) {
  const d = await deliveryById(id, actor, config);
  if (!d.syncPending || !["COMPLETING", "DELIVERED"].includes(d.status))
    throw conflict("No interrupted completion needs recovery.");
  return reconcileDelivery(d, actor);
}
async function reconcileDelivery(d, actor) {
  // Replayable ordered projections on standalone MongoDB. Delivered litres are
  // written once on the Delivery record; dashboards never sum allocations.
  const a = await Allocation.findOne({
    _id: d.allocationId,
    tankerId: d.tankerId,
    operatorId: d.operatorId,
    eventId: d.eventId,
    isDemo: d.isDemo,
    status: { $in: ["ASSIGNED", "COMPLETED"] },
  });
  if (!a || !d.otpVerified || !d.litresDelivered)
    throw conflict("Completion evidence needs municipal review.");
  if (d.status === "COMPLETING") {
    await Delivery.updateOne(
      { _id: d._id, status: "COMPLETING", otpVerified: true },
      {
        $set: { status: "DELIVERED", deliveredAt: new Date() },
        $push: {
          audit: audit("DELIVERY_COMPLETED", { id: d.completionActorId }),
        },
      },
    );
  }
  await Allocation.updateOne(
    { _id: a._id, status: "ASSIGNED" },
    {
      $set: { status: "COMPLETED" },
      $push: {
        audit: audit("DELIVERY_COMPLETED", { id: d.completionActorId }),
      },
    },
  );
  const remaining = d.startingAvailableLitres - d.litresDelivered;
  await Tanker.updateOne(
    { _id: d.tankerId, activeAllocationId: a._id },
    {
      $set: {
        activeAllocationId: null,
        status: remaining > 0 ? "AVAILABLE" : "UNAVAILABLE",
        availableLitres: remaining,
        currentLocation: null,
        observedAt: new Date(),
      },
      $inc: { revision: 1 },
      $push: { audit: audit("DELIVERY_RESERVATION_RELEASED", actor) },
    },
  );
  await Allocation.updateOne(
    { _id: a._id, status: "COMPLETED", active: true },
    { $set: { active: false } },
  );
  await Delivery.updateOne(
    { _id: d._id, status: "DELIVERED", syncPending: true },
    { $set: { syncPending: false } },
  );
  return serializeDelivery(await Delivery.findById(d._id));
}
