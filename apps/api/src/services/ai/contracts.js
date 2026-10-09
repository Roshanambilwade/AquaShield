import { z } from "zod";
import { ApiError } from "../../middleware/errors.js";

export const roles = Object.freeze({
  detect: "Crisis Detection",
  allocate: "Resource Allocation",
  logistics: "Logistics",
  predict: "Early Warning",
});
const text = z.string().trim().min(1).max(1200);
export const adviceSchema = z
  .object({
    summary: text,
    explanation: text,
    confidenceExplanation: text,
    verificationRecommendation: text,
    recommendedAction: z.enum([
      "VERIFY_REPORTS",
      "REVIEW_PRIORITY",
      "COLLECT_LOGISTICS_DATA",
      "COLLECT_RISK_INPUTS",
    ]),
    priorityRef: z.string().nullable(),
    evidenceRefs: z.array(z.string()).min(1).max(30),
    reasons: z.array(text).min(1).max(6),
    fairnessConsiderations: text,
    missingInformation: z.array(text).max(12),
  })
  .strict();
export const actions = {
  detect: "VERIFY_REPORTS",
  allocate: "REVIEW_PRIORITY",
  logistics: "COLLECT_LOGISTICS_DATA",
  predict: "COLLECT_RISK_INPUTS",
};

export function validateAdvice(raw, role, facts) {
  let value = raw;
  if (typeof raw === "string") {
    if (raw.length > 20000) throw invalidOutput();
    try {
      value = JSON.parse(
        raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, "$1"),
      );
    } catch {
      throw invalidOutput();
    }
  }
  const result = adviceSchema.safeParse(value);
  if (!result.success) throw invalidOutput();
  const advice = result.data;
  const refs = new Set(facts.zones.map((z) => z.ref));
  if (
    advice.recommendedAction !== actions[role] ||
    advice.priorityRef !== (role === "allocate" ? facts.priorityRef : null) ||
    !advice.evidenceRefs.includes(
      role === "allocate" ? facts.priorityRef : facts.selectedRef,
    ) ||
    advice.evidenceRefs.some((ref) => !refs.has(ref))
  )
    throw invalidOutput();
  const prose = [
    advice.summary,
    advice.explanation,
    advice.confidenceExplanation,
    advice.verificationRecommendation,
    ...advice.reasons,
    advice.fairnessConsiderations,
    ...advice.missingInformation,
  ].join(" ");
  // Quantities/IDs belong in authoritative facts, never in generated prose.
  // Human review is still necessary: schema checks cannot prove every sentence.
  if (
    /\p{N}|https?:|<[^>]+>|\b(?:has been|is|was|have been)\s+(?:dispatched|assigned|delivered|approved)\b/iu.test(
      prose,
    )
  )
    throw invalidOutput();
  return {
    ...advice,
    missingInformation: [
      ...new Set([...facts.missingInputs, ...advice.missingInformation]),
    ],
  };
}
export function invalidOutput() {
  return new ApiError(
    502,
    "AI_INVALID_OUTPUT",
    "The agent response did not pass evidence validation. Please retry or review the backend evidence.",
  );
}
