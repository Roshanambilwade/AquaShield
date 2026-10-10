import { actions, validateAdvice } from "./contracts.js";

// No new calculations and no demo generator: only interpret the existing,
// authorized evidence. Numerical and operational authority stays in facts.
export function ruleBasedAssessment(role, facts) {
  const selected = facts.zones.find(
    (z) =>
      z.ref === (role === "allocate" ? facts.priorityRef : facts.selectedRef),
  );
  const sufficient = {
    detect:
      selected?.status === "ACTIVE" &&
      Number.isFinite(selected.severity) &&
      Number.isFinite(selected.shortageConfidence),
    allocate: Boolean(
      facts.allocationContext?.recommendedFleetRef &&
      facts.fleet?.length &&
      selected,
    ),
    logistics: Boolean(
      facts.route &&
      Number.isFinite(facts.route.distanceKm) &&
      Number.isFinite(facts.route.etaMinutes),
    ),
    predict: Boolean(facts.risk),
  }[role];
  const summary = {
    detect: sufficient
      ? "Review the existing rule-based shortage assessment and its evidence limitations."
      : "Current evidence requires further assessment before confirming a shortage response.",
    allocate: sufficient
      ? "Review the backend priority and eligible candidate before any resource decision."
      : "Insufficient eligible fleet or allocation evidence; municipal review is required.",
    logistics: sufficient
      ? "Recorded trip data and backend route estimates remain available for operational review."
      : "Operational data remains available; complete missing trip or routing evidence before relying on an estimate.",
    predict: sufficient
      ? "Review the available deterministic risk evidence and its assumptions."
      : "A numerical forecast is unavailable; collect historical and supply evidence for manual review.",
  }[role];
  const advice = validateAdvice(
    {
      summary,
      explanation:
        "AI analysis was unavailable. This assessment uses the existing backend evidence and introduces no new measurements or operational decisions.",
      confidenceExplanation:
        "Shortage confidence describes evidence that a shortage exists; it does not measure water remaining or the certainty of this advice.",
      verificationRecommendation:
        "Confirm missing inputs and arrange authorized field review where needed.",
      recommendedAction: actions[role],
      priorityRef: role === "allocate" ? facts.priorityRef : null,
      evidenceRefs: [
        role === "allocate" ? facts.priorityRef : facts.selectedRef,
      ],
      reasons: [
        "The displayed values come from recorded evidence and deterministic backend rules.",
        "Human review and existing authorization remain required for operational actions.",
      ],
      fairnessConsiderations:
        "Review the supplied fairness evidence and eligibility constraints; unknown history must remain unknown.",
      missingInformation: [],
    },
    role,
    facts,
  );
  return {
    advice,
    assessmentStatus: sufficient ? "REVIEW_REQUIRED" : "INSUFFICIENT_DATA",
  };
}
