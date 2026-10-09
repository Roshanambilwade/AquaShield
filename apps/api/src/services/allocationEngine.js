import {
  calculateAllocationPriority,
  calculatePreviousDeliveryPenalty,
} from "./fairnessEngine.js";

export function tankerEligibility(tanker, config, now = new Date()) {
  const reasons = [];
  if (tanker.status !== "AVAILABLE" || tanker.activeAllocationId)
    reasons.push("Tanker is unavailable or reserved.");
  if (
    !Number.isFinite(tanker.capacityLitres) ||
    tanker.capacityLitres <= 0 ||
    !Number.isFinite(tanker.availableLitres) ||
    tanker.availableLitres <= 0 ||
    tanker.availableLitres > tanker.capacityLitres
  )
    reasons.push("Available water quantity is missing or invalid.");
  if (
    !tanker.observedAt ||
    !Number.isFinite(new Date(tanker.observedAt).getTime()) ||
    now - new Date(tanker.observedAt) >
      config.OPERATIONS_STALE_HOURS * 3600000 ||
    new Date(tanker.observedAt) > now
  )
    reasons.push("Operational information is missing or stale.");
  if (!tanker.operatorId) reasons.push("No active operator is linked.");
  return {
    eligible: reasons.length === 0,
    reasons,
    locationKnown: tanker.currentLocation != null,
  };
}

export function rankAllocationEvents(
  events,
  evidence,
  config,
  now = new Date(),
) {
  return events
    .filter((e) => e.status === "ACTIVE")
    .map((event) => {
      const record = evidence.find(
        (e) => String(e.eventId) === String(event.id),
      );
      const fresh =
        record &&
        now - new Date(record.observedAt) <= 24 * 3600000 &&
        new Date(record.observedAt) <= now;
      const demandLitres = fresh ? record.demandLitres : null;
      const recentDeliveredLitres = fresh ? record.recentDeliveredLitres : null;
      const penalty = calculatePreviousDeliveryPenalty(
        recentDeliveredLitres,
        demandLitres,
      );
      const priority = calculateAllocationPriority(
        event.severityScore,
        penalty,
        config.AI_FAIRNESS_MAX_ADJUSTMENT,
      );
      return {
        eventId: event.id,
        area: event.areaName,
        center: event.center,
        severity: event.severityScore,
        severityLevel: event.severityLevel,
        confidence: event.confidenceScore,
        estimatedPopulation: event.estimatedAffectedPopulation ?? null,
        durationHours: event.durationHours,
        vulnerableRatio: event.vulnerableRatio,
        temperatureC: event.temperatureC,
        demandLitres: demandLitres ?? null,
        recentDeliveredLitres: recentDeliveredLitres ?? null,
        fairnessPenalty: penalty,
        priority,
        orderingScore: priority ?? event.severityScore,
        evidenceSource: record?.source ?? null,
        evidenceObservedAt: record?.observedAt ?? null,
        missingInputs: [
          ...(demandLitres == null ? ["Verified demand quantity"] : []),
          ...(recentDeliveredLitres == null
            ? ["Complete previous-day delivery quantity"]
            : []),
          ...(event.estimatedAffectedPopulation == null
            ? ["Estimated population"]
            : []),
        ],
        reasons: [
          "Existing backend severity includes duration, population, water, environment, vulnerability and shortage confidence where known.",
          priority == null
            ? "Fairness is partial: ordering uses unchanged severity; unknown deliveries are not treated as zero."
            : "Verified previous-day delivery quantity reduces priority using the existing fairness formula.",
        ],
      };
    })
    .sort(
      (a, b) =>
        b.orderingScore - a.orderingScore ||
        (b.durationHours ?? -1) - (a.durationHours ?? -1) ||
        a.eventId.localeCompare(b.eventId),
    );
}

export function selectCandidates(tankers, focus, config, now = new Date()) {
  const inspected = tankers.map((t) => ({
    id: String(t._id),
    identifier: t.identifier,
    name: t.name,
    capacityLitres: t.capacityLitres,
    availableLitres: t.availableLitres,
    operatorId: t.operatorId ? String(t.operatorId) : null,
    currentLocation: t.currentLocation,
    observedAt: t.observedAt,
    revision: t.revision,
    ...tankerEligibility(t, config, now),
  }));
  const candidates = inspected
    .filter((t) => t.eligible)
    .sort((a, b) => {
      if (focus.demandLitres != null) {
        const aEnough = a.availableLitres >= focus.demandLitres,
          bEnough = b.availableLitres >= focus.demandLitres;
        if (aEnough !== bEnough) return aEnough ? -1 : 1;
        if (aEnough)
          return (
            a.availableLitres - b.availableLitres ||
            a.identifier.localeCompare(b.identifier)
          );
      }
      return (
        b.availableLitres - a.availableLitres ||
        a.identifier.localeCompare(b.identifier)
      );
    });
  return {
    candidates,
    excluded: inspected.filter((t) => !t.eligible),
    proposedLitres:
      candidates.length && focus.demandLitres != null
        ? Math.min(focus.demandLitres, candidates[0].availableLitres)
        : null,
  };
}
