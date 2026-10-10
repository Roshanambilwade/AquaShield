import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const auditContext = new AsyncLocalStorage();
export function correlationMiddleware(_req, res, next) {
  const correlationId = randomUUID();
  res.set("X-Request-ID", correlationId);
  auditContext.run({ correlationId }, next);
}
export function auditMetadata(actor = {}) {
  const context = auditContext.getStore();
  const role =
    actor.role ||
    (String(context?.actorId) === String(actor.id) ? context?.role : null);
  return {
    ...(context?.correlationId ? { correlationId: context.correlationId } : {}),
    ...(["ADMIN", "OPERATOR", "CITIZEN"].includes(role)
      ? { actorRole: role }
      : {}),
  };
}
export const FAILED_ACTIONS = [
  "OPERATION_CONFLICT",
  "DELIVERY_OTP_EXPIRED",
  "DELIVERY_OTP_REJECTED",
  "DELIVERY_OTP_HANDOFF_FAILED",
];
export const PENDING_ACTIONS = [
  "RECONCILIATION_STARTED",
  "DELIVERY_COMPLETION_STARTED",
];
export const RECOVERY_ACTIONS = ["ALLOCATION_RECONCILED", "DELIVERY_RECOVERED"];
export const SUCCESS_ACTIONS = [
  "REPORT_CREATED",
  "TANKER_REGISTERED",
  "TANKER_UPDATED",
  "RECOMMENDATION_GENERATED",
  "RESERVATION_RELEASED",
  "ALLOCATION_APPROVED",
  "ALLOCATION_REJECTED",
  "TANKER_RESERVED",
  "TANKER_ASSIGNED",
  "TRIP_STARTED",
  "TANKER_ARRIVED",
  "DELIVERY_OTP_GENERATED",
  "DELIVERY_VERIFIED",
  "CITIZEN_RECIPIENT_SELECTED",
  "DELIVERY_COMPLETED",
  "DELIVERY_RESERVATION_RELEASED",
  "FAIRNESS_EVIDENCE_RECORDED",
  "DEMO_RESET",
  "DEMO_TANKER_SEEDED",
  "ALERT_CREATED",
  "ALERT_ESCALATED",
  "ALERT_DEESCALATED",
  "ALERT_UPDATED",
  "ALERT_DATA_UNAVAILABLE",
  "ALERT_REOPENED",
  "ALERT_ACKNOWLEDGED",
  "ALERT_RESOLVED",
];
export function auditOutcome(action) {
  return FAILED_ACTIONS.includes(action)
    ? "FAILURE"
    : PENDING_ACTIONS.includes(action)
      ? "PENDING"
      : RECOVERY_ACTIONS.includes(action)
        ? "RECOVERED"
        : SUCCESS_ACTIONS.includes(action)
          ? "SUCCESS"
          : null;
}
export function auditEntry(action, actor = {}, transition = {}) {
  return {
    action,
    actorId: actor.id,
    at: new Date(),
    ...auditMetadata(actor),
    outcome: auditOutcome(action),
    ...transition,
  };
}
export function securityLog(event, actor) {
  // Authentication events use sanitized operational logging, never credential storage.
  if (
    ![
      "LOGIN_SUCCEEDED",
      "LOGIN_FAILED",
      "LOGOUT_SUCCEEDED",
      "AUTHORIZATION_DENIED",
    ].includes(event)
  )
    return;
  console.info(
    JSON.stringify({
      event,
      ...auditMetadata(actor),
      ...(actor?.id ? { actorId: actor.id } : {}),
    }),
  );
}
