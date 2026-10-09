import { createHash } from "node:crypto";
import { buildEvidence } from "./evidence.js";
import { ApiError } from "../../middleware/errors.js";
export function buildAllocationEvidence(snapshot, config) {
  if (!snapshot.rankings.length)
    throw new ApiError(
      422,
      "AI_NO_EVIDENCE",
      "No eligible shortage is available for allocation assessment.",
    );
  const facts = buildEvidence(
    snapshot.events.filter((e) =>
      snapshot.rankings.some((r) => r.eventId === e.id),
    ),
    { tankers: [], deliveries: null },
    config,
    { eventId: snapshot.rankings[0].eventId, demo: snapshot.isDemo },
  );
  facts.priorityRef = facts.selectedRef;
  facts.zones = facts.zones.map((zone) => {
    const ranking = snapshot.rankings.find((r) => r.eventId === zone.eventId);
    return ranking
      ? {
          ...zone,
          fairnessPenalty: ranking.fairnessPenalty,
          allocationPriority: ranking.priority,
          demandLitres: ranking.demandLitres,
          recentDeliveredLitres: ranking.recentDeliveredLitres,
          deliveryHistoryKnown: ranking.recentDeliveredLitres != null,
        }
      : zone;
  });
  facts.fleet = snapshot.candidates.map((t) => ({
    id: t.id,
    status: "AVAILABLE",
    capacityLitres: t.capacityLitres,
    availableLitres: t.availableLitres,
    location: t.currentLocation,
    observedAt: t.observedAt,
  }));
  facts.rankingMethod =
    "Existing severity minus verified previous-delivery adjustment; partial evidence uses unchanged severity, then duration and stable event ID.";
  facts.missingInputs = [
    ...snapshot.rankings[0].missingInputs,
    "Routing/ETA service",
  ];
  facts.allocationContext = {
    recommendedFleetRef: snapshot.candidates.length ? "fleet_0" : null,
    proposedLitres: snapshot.proposedLitres,
    excludedFleet: snapshot.excluded.map((t, i) => ({
      ref: `excluded_${i}`,
      reasons: t.reasons,
    })),
    scope:
      "Explain backend eligibility and priority only. Human approval and assignment are separate.",
  };
  facts.limitations = [
    "Human review required. Backend alone selects and assigns eligible tankers.",
    "Unknown inputs remain unknown; no routing or delivery workflow is available.",
  ];
  facts.evidenceVersion = createHash("sha256")
    .update(JSON.stringify(facts))
    .digest("hex");

  return facts;
}
