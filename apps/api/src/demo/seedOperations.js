import Tanker from "../models/Tanker.js";
import Allocation from "../models/Allocation.js";
import AllocationEvidence from "../models/AllocationEvidence.js";
import { seedDemoReports } from "./seedReports.js";
import { listShortages } from "../services/shortageService.js";
import {
  initializeOperations,
  conflict,
} from "../services/operationsService.js";
import { ApiError } from "../middleware/errors.js";
const owner = "aquashield-phase6";
export async function seedOperations(config, actor, { reset = false } = {}) {
  if (config.NODE_ENV === "production")
    throw new ApiError(
      403,
      "DEMO_DISABLED",
      "Demo seeding is disabled in production.",
    );
  await initializeOperations();
  await seedDemoReports(config);
  const owned = await Tanker.find({ isDemo: true, seedOwner: owner });
  if (reset) {
    // Freeze fleet first: revision checks invalidate concurrent candidate reads.
    // A reservation already in flight is left intact, and reset fails closed.
    if (
      await Allocation.exists({
        isDemo: true,
        tankerId: { $in: owned.map((t) => t._id) },
        status: { $in: ["ASSIGNING", "RECONCILING"] },
      })
    )
      throw conflict(
        "An assignment is in progress. Retry reset after it completes.",
      );
    await Tanker.updateMany(
      { isDemo: true, seedOwner: owner, activeAllocationId: null },
      { $set: { status: "UNAVAILABLE" }, $inc: { revision: 1 } },
    );
    if (
      await Allocation.exists({
        isDemo: true,
        tankerId: { $in: owned.map((t) => t._id) },
        status: { $in: ["ASSIGNING", "RECONCILING"] },
      })
    )
      throw conflict(
        "An assignment started during reset. Retry after it completes.",
      );
    await Allocation.deleteMany({
      isDemo: true,
      tankerId: { $in: owned.map((t) => t._id) },
      status: { $nin: ["ASSIGNING", "RECONCILING"] },
    });
    await Tanker.updateMany(
      { isDemo: true, seedOwner: owner },
      {
        $set: { activeAllocationId: null, status: "UNAVAILABLE" },
        $inc: { revision: 1 },
      },
    );
  }
  const definitions = [
    {
      identifier: "DEMO-T01",
      name: "Demo central reserve",
      capacityLitres: 10000,
      availableLitres: 8000,
      status: "AVAILABLE",
      currentLocation: { lat: 20.011, lng: 73.79 },
    },
    {
      identifier: "DEMO-T02",
      name: "Demo maintenance unit",
      capacityLitres: 6000,
      availableLitres: 6000,
      status: "UNAVAILABLE",
      currentLocation: null,
    },
    {
      identifier: "DEMO-T03",
      name: "Demo unconfirmed unit",
      capacityLitres: 5000,
      availableLitres: null,
      status: "AVAILABLE",
      currentLocation: null,
    },
  ];
  for (const t of definitions) {
    const found = await Tanker.findOne({ identifier: t.identifier });
    if (found && (!found.isDemo || found.seedOwner !== owner))
      throw conflict(
        "Demo identifier belongs to another record; it was preserved.",
      );
    if (!found)
      await Tanker.create({
        ...t,
        isDemo: true,
        seedOwner: owner,
        observedAt: new Date(),
        audit: [
          { action: "DEMO_TANKER_SEEDED", actorId: actor.id, at: new Date() },
        ],
      });
    else if (reset)
      await Tanker.updateOne(
        { _id: found._id, activeAllocationId: null },
        {
          $set: { ...t, observedAt: new Date() },
          $inc: { revision: 1 },
          $push: {
            audit: { action: "DEMO_RESET", actorId: actor.id, at: new Date() },
          },
        },
      );
  }
  const { events } = await listShortages(config, true);
  for (const e of events.filter((e) => e.status === "ACTIVE")) {
    const data = {
      demandLitres: e.areaName === "Panchavati" ? 10000 : 8000,
      recentDeliveredLitres:
        e.areaName === "Panchavati" ? 4000 : e.areaName === "Satpur" ? 0 : null,
      source:
        "Fictional Phase 6 municipal demand and previous-day delivery ledger; simulated evidence only.",
      observedAt: new Date(),
      recordedBy: actor.id,
      isDemo: true,
      seedOwner: owner,
    };
    const existing = await AllocationEvidence.findOne({ eventId: e.id });
    if (!existing) await AllocationEvidence.create({ eventId: e.id, ...data });
    else if (reset && existing.isDemo && existing.seedOwner === owner)
      await AllocationEvidence.updateOne({ _id: existing._id }, { $set: data });
  }
  return {
    isDemo: true,
    message:
      "Demo fleet and fairness evidence are ready. Link an operator to DEMO-T01 and confirm its operational information to make it eligible. Real records are preserved.",
  };
}
