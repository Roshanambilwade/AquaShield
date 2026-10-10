import mongoose from "mongoose";
import Tanker from "../models/Tanker.js";
import Allocation from "../models/Allocation.js";
import AllocationEvidence from "../models/AllocationEvidence.js";
import User from "../models/User.js";
import { ApiError } from "../middleware/errors.js";
import { listShortages } from "./shortageService.js";
import {
  tankerEligibility,
  rankAllocationEvents,
  selectCandidates,
} from "./allocationEngine.js";
import { runAgent } from "./ai/agentService.js";
import { buildAllocationEvidence } from "./ai/allocationEvidence.js";
import { auditEntry } from "./auditContext.js";

const initialized = new WeakMap();
export async function initializeOperations() {
  const db = mongoose.connection.db;
  if (!initialized.has(db))
    initialized.set(
      db,
      Promise.all([
        Tanker.createIndexes(),
        Allocation.createIndexes(),
        AllocationEvidence.createIndexes(),
      ]).catch((e) => {
        initialized.delete(db);
        throw e;
      }),
    );
  return initialized.get(db);
}
const entry = (action, actor, reason, transition) => ({
  ...auditEntry(action, actor, transition),
  ...(reason ? { reason } : {}),
});
export const conflict = (
  message = "This operation conflicts with current records. Refresh and review again.",
) => new ApiError(409, "OPERATION_CONFLICT", message);
export function operationError(error) {
  if (error.code === 11000)
    return conflict(
      "An identifier, operator, shortage or tanker already has a conflicting record.",
    );
  return error;
}
export function publicRecord(record) {
  const obj = record.toObject ? record.toObject() : { ...record };
  const { _id, __v, ...rest } = obj;
  void __v;
  return { id: String(_id), ...rest };
}
async function operatorExists(id) {
  return (
    id && (await User.exists({ _id: id, role: "OPERATOR", disabled: false }))
  );
}
export async function listTankers(config, demo) {
  const records = await Tanker.find({ isDemo: demo })
    .sort({ identifier: 1 })
    .limit(1001)
    .lean();
  if (records.length > 1000)
    throw new ApiError(
      503,
      "OPERATIONS_CAPACITY",
      "Fleet limit exceeded; paginated operations are required.",
    );
  const operators = await User.find({ role: "OPERATOR", disabled: false })
    .select("name")
    .lean();
  const valid = new Set(operators.map((o) => String(o._id)));
  return {
    tankers: records.map((t) => ({
      ...publicRecord(t),
      eligibility: tankerEligibility(
        {
          ...t,
          operatorId: valid.has(String(t.operatorId)) ? t.operatorId : null,
        },
        config,
      ),
    })),
    operators: operators.map((o) => ({ id: String(o._id), name: o.name })),
    isDemo: demo,
  };
}
export async function saveTanker(id, input, actor, demo, revision) {
  await initializeOperations();
  if (input.operatorId && !(await operatorExists(input.operatorId)))
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Choose an active operator account.",
    );
  if (!id)
    return publicRecord(
      await Tanker.create({
        ...input,
        isDemo: demo,
        audit: [
          entry("TANKER_REGISTERED", actor, null, {
            after: {
              status: input.status,
              balanceLitres: input.availableLitres,
            },
          }),
        ],
      }),
    );
  const previous = await Tanker.findOne({ _id: id, isDemo: demo })
    .select("status availableLitres revision")
    .lean();
  if (!previous || previous.revision !== revision) throw conflict();
  const result = await Tanker.findOneAndUpdate(
    {
      _id: id,
      isDemo: demo,
      revision,
      activeAllocationId: null,
      status: { $ne: "ASSIGNED" },
    },
    {
      $set: input,
      $inc: { revision: 1 },
      $push: {
        audit: entry("TANKER_UPDATED", actor, null, {
          before: {
            status: previous?.status,
            balanceLitres: previous?.availableLitres,
          },
          after: { status: input.status, balanceLitres: input.availableLitres },
        }),
      },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!result)
    throw conflict(
      "The tanker changed or has an assignment. Assigned tankers cannot be edited.",
    );
  return publicRecord(result);
}
export async function saveEvidence(id, input, actor, config, demo) {
  await initializeOperations();
  const { events } = await listShortages(config, demo);
  if (!events.some((e) => e.id === id && e.status === "ACTIVE"))
    throw new ApiError(
      404,
      "SHORTAGE_NOT_FOUND",
      "Choose a current active shortage.",
    );
  return publicRecord(
    await AllocationEvidence.findOneAndUpdate(
      { eventId: id, isDemo: demo },
      {
        $set: { ...input, recordedBy: actor.id },
        $push: {
          audit: {
            ...auditEntry("FAIRNESS_EVIDENCE_RECORDED", actor),
            demandLitres: input.demandLitres,
            recentDeliveredLitres: input.recentDeliveredLitres,
            source: input.source,
          },
        },
      },
      { returnDocument: "after", upsert: true, runValidators: true },
    ),
  );
}
export async function allocationSnapshot(config, demo, ownId) {
  const [{ events }, fleet, evidence, assigned] = await Promise.all([
    listShortages(config, demo),
    listTankers(config, demo),
    AllocationEvidence.find({ isDemo: demo }).lean(),
    Allocation.find({
      isDemo: demo,
      status: { $in: ["ASSIGNING", "RECONCILING", "ASSIGNED", "RESETTING"] },
      ...(ownId ? { _id: { $ne: ownId } } : {}),
    })
      .select("eventId")
      .lean(),
  ]);
  const busy = new Set(assigned.map((a) => String(a.eventId)));
  const rankings = rankAllocationEvents(
    events.filter((e) => !busy.has(e.id)),
    evidence,
    config,
  );
  const focus = rankings[0];
  const selection = focus
    ? selectCandidates(
        fleet.tankers.map((t) => ({
          ...t,
          _id: t.id,
          ...(ownId && String(t.activeAllocationId) === String(ownId)
            ? { status: "AVAILABLE", activeAllocationId: null }
            : {}),
          operatorId: t.eligibility.reasons.includes(
            "No active operator is linked.",
          )
            ? null
            : t.operatorId,
        })),
        focus,
        config,
      )
    : { candidates: [], excluded: [], proposedLitres: null };
  return {
    ruleVersion: "allocation-v1",
    generatedAt: new Date(),
    isDemo: demo,
    rankings,
    ...selection,
    events,
  };
}
function snapshotForRecord(snapshot) {
  const { events, ...safe } = snapshot;
  void events;
  return safe;
}
function checkTarget(snapshot, eventId, tankerId) {
  if (!snapshot.rankings.some((r) => r.eventId === String(eventId)))
    throw conflict("Shortage is no longer active or is already assigned.");
  if (snapshot.rankings[0]?.eventId !== String(eventId))
    throw conflict(
      "A higher-priority shortage now requires attention. Generate a fresh recommendation.",
    );
  if (tankerId && !snapshot.candidates.some((t) => t.id === String(tankerId)))
    throw conflict(
      "The recommended tanker is no longer eligible. Reject and request a fresh recommendation.",
    );
  if (tankerId && snapshot.candidates[0]?.id !== String(tankerId))
    throw conflict(
      "The preferred candidate changed. Reject and request a fresh recommendation.",
    );
}
async function explain(snapshot, config, dependencies) {
  const facts = buildAllocationEvidence(snapshot, config);
  try {
    const result = await runAgent(
      "allocate",
      config,
      { demo: snapshot.isDemo },
      {
        ...dependencies,
        evidenceLoader: async () => facts,
        allowFallback: true,
      },
    );
    return {
      // Keep the saved allocation's established mode while adding the shared
      // RULE_BASED method/provenance used by all assessment APIs.
      execution:
        result.execution.mode === "RULE_BASED"
          ? { ...result.execution, mode: "DETERMINISTIC_ONLY" }
          : result.execution,
      failureCode: result.execution.fallbackReasonCode ?? undefined,
      assessmentStatus: result.assessmentStatus,
      advice: result.advice,
      evidenceVersion: result.facts.evidenceVersion,
      requestId: result.requestId,
      generatedAt: result.generatedAt,
      facts: result.facts,
    };
  } catch (error) {
    if (error.code === "AI_CANCELLED") throw error;
    if (!(error instanceof ApiError) || !error.code.startsWith("AI_"))
      throw error;
    return {
      execution: { mode: "DETERMINISTIC_ONLY", providerExecuted: false },
      failureCode: error.code,
      message:
        "Agent unavailable; this recommendation uses backend calculations only.",
    };
  }
}
export async function recommendAllocation(
  input,
  actor,
  config,
  demo,
  dependencies,
) {
  await initializeOperations();
  const existing = await Allocation.findOne({
    createdBy: actor.id,
    requestId: input.requestId,
    isDemo: demo,
  });
  if (existing) {
    if (String(existing.eventId) !== input.eventId)
      throw conflict("Request identifier belongs to another shortage.");
    return { allocation: publicRecord(existing), reused: true };
  }
  let snapshot = await allocationSnapshot(config, demo);
  checkTarget(snapshot, input.eventId);
  if (!snapshot.candidates.length)
    return {
      allocation: null,
      blocked: true,
      message: "No eligible tanker is currently available.",
      evidence: snapshotForRecord(snapshot),
    };
  const ai = input.useAi
    ? await explain(snapshot, config, dependencies)
    : {
        execution: {
          mode: "DETERMINISTIC_ONLY",
          method: "RULE_BASED",
          providerExecuted: false,
          providerAttempted: false,
          aiAnalysisCompleted: false,
          providerStatus: "NOT_REQUESTED",
          fallbackReasonCode: null,
          isDemo: false,
          attempts: 0,
        },
        message: "Deterministic recommendation; no agent requested.",
      };
  // Provider latency must never make the candidate stale at creation time.
  const chosen = snapshot.candidates[0].id;
  snapshot = await allocationSnapshot(config, demo);
  checkTarget(snapshot, input.eventId, chosen);
  if (snapshot.candidates[0].id !== chosen)
    throw conflict(
      "Candidate order changed while preparing the recommendation. Refresh and review.",
    );
  const allocation = await Allocation.create({
    eventId: input.eventId,
    tankerId: chosen,
    createdBy: actor.id,
    requestId: input.requestId,
    notes: input.notes,
    status: "RECOMMENDED",
    isDemo: demo,
    evidence: snapshotForRecord(snapshot),
    recommendationEvidence: snapshotForRecord(snapshot),
    ai,
    audit: [
      entry("RECOMMENDATION_GENERATED", actor, null, {
        after: { status: "RECOMMENDED" },
      }),
    ],
  });
  return { allocation: publicRecord(allocation), reused: false };
}
export async function allocationById(id, demo) {
  const allocation = await Allocation.findOne({ _id: id, isDemo: demo });
  if (!allocation)
    throw new ApiError(404, "ALLOCATION_NOT_FOUND", "Allocation not found.");
  return allocation;
}
// Cancellation claims the allocation before releasing only its own reservation.
// RECONCILING is replayable after either write; active uniqueness stays held
// until release succeeds. An in-flight assign cannot finalize this state.
async function reconcileRejected(current, actor, reason) {
  const claimed = await Allocation.findOneAndUpdate(
    {
      _id: current._id,
      status: { $in: ["APPROVED", "ASSIGNING"] },
    },
    {
      $set: { status: "RECONCILING", rejectionReason: reason },
      $push: {
        audit: entry("RECONCILIATION_STARTED", actor, reason, {
          after: { status: "RECONCILING" },
        }),
      },
    },
    { returnDocument: "after" },
  );
  if (!claimed) {
    const latest = await Allocation.findById(current._id);
    if (!["RECONCILING", "REJECTED"].includes(latest?.status)) throw conflict();
  }
  await Tanker.updateOne(
    {
      _id: current.tankerId,
      activeAllocationId: current._id,
      status: "ASSIGNED",
    },
    {
      $set: { activeAllocationId: null, status: "AVAILABLE" },
      $inc: { revision: 1 },
      $push: {
        audit: entry("RESERVATION_RELEASED", actor, null, {
          before: { status: "ASSIGNED" },
          after: { status: "AVAILABLE" },
        }),
      },
    },
  );
  const result = await Allocation.findOneAndUpdate(
    { _id: current._id, status: "RECONCILING" },
    {
      $set: {
        status: "REJECTED",
        active: false,
        rejectedBy: actor.id,
        rejectedAt: new Date(),
      },
      $push: {
        audit: entry("ALLOCATION_RECONCILED", actor, reason, {
          before: { status: "RECONCILING" },
          after: { status: "REJECTED" },
        }),
      },
    },
    { returnDocument: "after" },
  );
  return publicRecord(result || (await Allocation.findById(current._id)));
}
async function auditedConflict(allocation, actor, error) {
  if (error instanceof ApiError && error.status === 409)
    await Allocation.updateOne(
      { _id: allocation._id },
      { $push: { audit: entry("OPERATION_CONFLICT", actor, error.message) } },
    );
  throw error;
}
export async function decideAllocation(
  id,
  decision,
  reason,
  actor,
  config,
  demo,
) {
  const current = await allocationById(id, demo);
  const next = decision === "approve" ? "APPROVED" : "REJECTED";
  if (
    next === "REJECTED" &&
    ["APPROVED", "ASSIGNING", "RECONCILING", "REJECTED"].includes(
      current.status,
    )
  )
    return reconcileRejected(current, actor, reason);
  if (current.status === next) return publicRecord(current);
  try {
    if (
      !["RECOMMENDED", ...(next === "REJECTED" ? ["APPROVED"] : [])].includes(
        current.status,
      )
    )
      throw conflict("This decision is not allowed in the current state.");
    const snapshot =
      next === "APPROVED" ? await allocationSnapshot(config, demo, id) : null;
    if (snapshot) checkTarget(snapshot, current.eventId, current.tankerId);
    const changes =
      next === "APPROVED"
        ? {
            approvedBy: actor.id,
            approvedAt: new Date(),
            evidence: snapshotForRecord(snapshot),
            approvalEvidence: snapshotForRecord(snapshot),
          }
        : {
            active: false,
            rejectedBy: actor.id,
            rejectedAt: new Date(),
            rejectionReason: reason,
          };
    const updated = await Allocation.findOneAndUpdate(
      { _id: id, status: current.status },
      {
        $set: { status: next, ...changes },
        $push: {
          audit: entry(
            next === "APPROVED" ? "ALLOCATION_APPROVED" : "ALLOCATION_REJECTED",
            actor,
            reason,
            { before: { status: current.status }, after: { status: next } },
          ),
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) throw conflict();
    return publicRecord(updated);
  } catch (error) {
    return auditedConflict(current, actor, error);
  }
}
export async function assignAllocation(id, actor, config, demo) {
  await initializeOperations();
  const current = await allocationById(id, demo);
  if (current.status === "ASSIGNED") return publicRecord(current);
  try {
    if (!["APPROVED", "ASSIGNING"].includes(current.status))
      throw conflict(
        "Explicit administrator approval is required before assignment.",
      );
    // ASSIGNING is a fail-closed recoverable intent, never a trip state.
    // A process crash leaves its tanker reserved; retry completes that same intent.
    let tanker = await Tanker.findOne({ _id: current.tankerId, isDemo: demo });
    if (String(tanker?.activeAllocationId) !== id) {
      const snapshot = await allocationSnapshot(config, demo, id);
      checkTarget(snapshot, current.eventId, current.tankerId);
      const candidate = snapshot.candidates.find(
        (t) => t.id === String(current.tankerId),
      );
      const approved = current.approvalEvidence || current.evidence;
      const previous = approved.candidates.find(
        (t) => t.id === String(current.tankerId),
      );
      if (
        !previous ||
        ["capacityLitres", "availableLitres", "operatorId"].some(
          (key) => previous[key] !== candidate[key],
        ) ||
        approved.proposedLitres !== snapshot.proposedLitres
      )
        throw conflict(
          "Approved capacity, operator or planned quantity changed. Reject and review a fresh recommendation.",
        );
      const intent = await Allocation.findOneAndUpdate(
        { _id: id, status: { $in: ["APPROVED", "ASSIGNING"] } },
        {
          $set: { status: "ASSIGNING", evidence: snapshotForRecord(snapshot) },
        },
        { returnDocument: "after" },
      );
      if (!intent) throw conflict();
      tanker = await Tanker.findOneAndUpdate(
        {
          _id: current.tankerId,
          isDemo: demo,
          status: "AVAILABLE",
          activeAllocationId: null,
          revision: candidate.revision,
        },
        {
          $set: { status: "ASSIGNED", activeAllocationId: current._id },
          $inc: { revision: 1 },
          $push: {
            audit: entry("TANKER_RESERVED", actor, null, {
              before: { status: "AVAILABLE" },
              after: { status: "ASSIGNED" },
            }),
          },
        },
        { returnDocument: "after" },
      );
      if (!tanker) {
        tanker = await Tanker.findOne({
          _id: current.tankerId,
          activeAllocationId: current._id,
        });
        if (!tanker) {
          await Allocation.updateOne(
            { _id: id, status: "ASSIGNING" },
            { $set: { status: "APPROVED" } },
          );
          throw conflict(
            "Tanker changed or was reserved by another administrator.",
          );
        }
      }
    }
    // Revalidate even when recovering an existing reservation. The snapshot treats
    // only this intent's reservation as its candidate, never another's.
    const fresh = await allocationSnapshot(config, demo, id);
    checkTarget(fresh, current.eventId, current.tankerId);
    const candidateNow = fresh.candidates.find(
      (t) => t.id === String(current.tankerId),
    );
    const approvedNow = current.approvalEvidence || current.evidence;
    const original = approvedNow.candidates.find(
      (t) => t.id === String(current.tankerId),
    );
    if (
      !original ||
      ["capacityLitres", "availableLitres", "operatorId"].some(
        (key) => original[key] !== candidateNow[key],
      ) ||
      approvedNow.proposedLitres !== fresh.proposedLitres
    )
      throw conflict("Approved operational evidence changed during recovery.");
    // Reservation is authoritative and cannot be edited/released by fleet APIs.
    const result = await Allocation.findOneAndUpdate(
      { _id: id, status: "ASSIGNING" },
      {
        $set: {
          status: "ASSIGNED",
          operatorId: tanker.operatorId,
          assignedBy: actor.id,
          assignedAt: new Date(),
        },
        $push: {
          audit: entry("TANKER_ASSIGNED", actor, null, {
            before: { status: "ASSIGNING" },
            after: { status: "ASSIGNED" },
          }),
        },
      },
      { returnDocument: "after" },
    );
    if (result) return publicRecord(result);
    const replay = await allocationById(id, demo);
    if (replay.status === "ASSIGNED") return publicRecord(replay);
    throw conflict();
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const latest = await allocationById(id, demo);
      if (["ASSIGNING", "RECONCILING", "REJECTED"].includes(latest.status))
        await reconcileRejected(latest, actor, error.message);
    }
    return auditedConflict(current, actor, error);
  }
}
