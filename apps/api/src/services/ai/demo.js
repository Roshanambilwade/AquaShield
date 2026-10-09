import { actions } from "./contracts.js";
export function demoAdvice(role, facts) {
  const selected = facts.zones.find((z) => z.ref === facts.selectedRef);
  const summaries = {
    detect: `The selected zone has ${selected.status === "EMERGING" ? "limited emerging" : "current shortage"} evidence requiring municipal assessment.`,
    allocate:
      "Review the highest-ranked area in the backend evidence before making a resource decision.",
    logistics: facts.route
      ? "Review recorded trip progress and backend route estimates, including observation and navigation limitations."
      : facts.fleet?.length
        ? "Fleet records exist, but routing and assignment evidence is incomplete."
        : "A logistics recommendation requires fleet and routing information that is currently unavailable.",
    predict:
      "Current reports warrant monitoring; a quantified forecast is unavailable without the deterministic risk model and historical inputs.",
  };
  return {
    summary: summaries[role],
    explanation:
      "This simulation uses the supplied backend facts and preserves missing information. It does not execute a language model.",
    confidenceExplanation:
      "Shortage confidence measures evidence that a shortage exists. It does not represent water remaining or certainty of this advice.",
    verificationRecommendation:
      "Confirm the evidence and household needs with an authorized field assessment.",
    recommendedAction: actions[role],
    priorityRef: role === "allocate" ? facts.priorityRef : null,
    evidenceRefs: [role === "allocate" ? facts.priorityRef : facts.selectedRef],
    reasons:
      role === "allocate" && facts.allocationContext
        ? [
            "The backend has ranked current shortages using severity and available verified fairness evidence.",
            facts.fleet?.length
              ? "The recommended fleet candidate passed backend water, availability, freshness and operator checks."
              : "No eligible fleet candidate is available; collect current operational evidence.",
          ]
        : role === "allocate"
          ? [
              "Backend severity and duration determine the evidence ordering.",
              "Fairness-adjusted priority remains unknown without verified demand volume.",
            ]
          : [
              "Only recorded evidence supports this assessment.",
              "Missing operational or historical inputs require follow-up.",
            ],
    fairnessConsiderations:
      facts.allocationContext && selected.allocationPriority != null
        ? "The backend adjusted priority using documented demand and previous delivery quantities. Severity is unchanged; review missing evidence for competing areas before approval."
        : "Unknown delivery history cannot be interpreted as no previous delivery. Confirm demand and prior emergency support before allocation.",
    missingInformation: [],
  };
}
