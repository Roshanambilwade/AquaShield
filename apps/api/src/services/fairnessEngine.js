import { clamp, round } from "./geography.js";

// Pure building blocks only. No allocation or dispatch workflow in Phase 3.
// Callers must supply verified delivery history; missing history stays unknown.
export function calculatePreviousDeliveryPenalty(litres, estimatedNeedLitres) {
  if (litres == null || estimatedNeedLitres == null || estimatedNeedLitres <= 0)
    return null;
  return round(clamp((litres / estimatedNeedLitres) * 100));
}
export function calculateNeedAdjustment(penalty, maximumAdjustment = 15) {
  return penalty == null
    ? null
    : round((clamp(penalty) / 100) * maximumAdjustment);
}
export function calculateAllocationPriority(
  severity,
  penalty,
  maximumAdjustment = 15,
) {
  const adjustment = calculateNeedAdjustment(penalty, maximumAdjustment);
  return adjustment == null ? null : round(clamp(severity - adjustment));
}
