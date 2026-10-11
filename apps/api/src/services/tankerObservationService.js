import mongoose from "mongoose";
import Tanker from "../models/Tanker.js";
import Delivery from "../models/Delivery.js";
import Allocation from "../models/Allocation.js";
import { conflict } from "./operationsService.js";
import { auditEntry } from "./auditContext.js";
import { ApiError } from "../middleware/errors.js";
import { assertSeedTarget } from "../config/demonstration.js";
export function assertDemoObservationTarget(config) {
  // Observing reuses connected-target safety checks without enabling seed commands.
  assertSeedTarget({ ...config, DEMO_SEED_ENABLED: true }, true);
}
export async function observeDemoTanker(id, input, actor, config) {
  if (actor.role !== "ADMIN")
    throw new ApiError(403, "ADMIN_REQUIRED", "Administrator access required.");
  assertDemoObservationTarget(config);
  const previous = await Tanker.findOne({ _id: id, isDemo: true }).lean();
  if (!previous || previous.revision !== input.revision) throw conflict();
  if (
    previous.activeAllocationId ||
    !["AVAILABLE", "UNAVAILABLE"].includes(previous.status) ||
    (await Delivery.exists({ tankerId: id, status: { $ne: "DELIVERED" } })) ||
    (await Allocation.exists({
      tankerId: id,
      status: { $in: ["ASSIGNING", "RECONCILING", "ASSIGNED", "RESETTING"] },
    }))
  )
    throw conflict(
      "A reserved tanker or active trip cannot be observed through this workflow.",
    );
  if (input.availableLitres > previous.capacityLitres)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Available water exceeds the recorded capacity.",
    );
  if ((previous.observations || []).length >= 1000)
    throw conflict(
      "Observation history capacity reached. Preserve records and plan archival.",
    );
  const now = new Date();
  if (previous.observedAt && previous.observedAt > now)
    throw conflict(
      "The existing observation is future-dated; investigate before updating.",
    );
  const operator = await mongoose
    .model("User")
    .exists({ _id: previous.operatorId, role: "OPERATOR", disabled: false });
  if (input.status === "AVAILABLE" && !operator)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "An available tanker requires an active linked operator.",
    );
  const observation = {
    at: now,
    actorId: actor.id,
    provenance: "SIMULATED_PRESENT_TIME_OBSERVATION",
    assessment: input.assessment,
    previousObservedAt: previous.observedAt,
    previousAvailableLitres: previous.availableLitres,
    previousStatus: previous.status,
    previousLocation: previous.currentLocation,
    availableLitres: input.availableLitres,
    status: input.status,
    location: input.currentLocation,
  };
  const row = await Tanker.findOneAndUpdate(
    {
      _id: id,
      isDemo: true,
      revision: input.revision,
      activeAllocationId: null,
      status: { $in: ["AVAILABLE", "UNAVAILABLE"] },
    },
    {
      $set: {
        availableLitres: input.availableLitres,
        status: input.status,
        currentLocation: input.currentLocation,
        observedAt: now,
      },
      $inc: { revision: 1 },
      $push: {
        observations: observation,
        audit: auditEntry("TANKER_OBSERVED", actor, {
          before: {
            status: previous.status,
            balanceLitres: previous.availableLitres,
          },
          after: { status: input.status, balanceLitres: input.availableLitres },
        }),
      },
    },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw conflict();
  return {
    id: String(row._id),
    revision: row.revision,
    observedAt: row.observedAt,
    provenance: observation.provenance,
  };
}
