import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateWindow,
  parseAnalyticsQuery,
  auditQuery,
  auditId,
} from "../src/validation/analytics.js";
import { validate } from "../src/validation/report.js";
import { timingSummary } from "../src/services/analyticsService.js";
import { safeAuditEvent } from "../src/services/auditService.js";
import { assertAppendOnlyUpdate } from "../src/models/auditTrail.js";
import { auditContext, auditEntry } from "../src/services/auditContext.js";
import { analyticsBound } from "../src/services/analyticsBound.js";
const now = new Date("2026-10-10T12:00:00Z");
test("analytics windows enforce UTC half-open bounds, defaults and validated filters", () => {
  const w = dateWindow({}, now);
  assert.equal(+w.to - +w.from, 7 * 86400000);
  assert.equal(w.bounds, "FROM_INCLUSIVE_TO_EXCLUSIVE");
  const q = parseAnalyticsQuery(
    {
      from: "2026-10-08T13:00:00+01:00",
      to: now.toISOString(),
      areaId: "AREA_01",
    },
    now,
  );
  assert.equal(q.window.from.toISOString(), "2026-10-08T12:00:00.000Z");
  for (const input of [
    { from: now.toISOString() },
    { from: now.toISOString(), to: now.toISOString() },
    { from: "2026-01-01T00:00:00Z", to: now.toISOString() },
    { from: "invalid", to: now.toISOString() },
    { from: "2026-10-09T00:00:00Z", to: "2026-10-11T00:00:00Z" },
    { areaId: { $ne: null } },
    { secret: "x" },
  ])
    assert.throws(() => parseAnalyticsQuery(input, now));
});
test("audit filters normalize identifiers and bound pagination; reject query injection", () => {
  assert.equal(
    validate(auditQuery, { actorId: "A".repeat(24) }).actorId,
    "a".repeat(24),
  );
  assert.equal(
    validate(auditId, `report:${"A".repeat(24)}:${"B".repeat(24)}`),
    `REPORT:${"a".repeat(24)}:${"b".repeat(24)}`,
  );
  for (const input of [
    { page: 101 },
    { limit: 51 },
    { page: 0 },
    { targetId: { $ne: null } },
    { eventType: "<script>" },
    { correlationId: "key" },
    { outcome: "fake" },
    { extra: "x" },
  ])
    assert.throws(() => validate(auditQuery, input));
});
test("timing means require recorded denominators and preserve unknowns", () => {
  assert.equal(timingSummary().averageMinutes, null);
  assert.equal(timingSummary(2, 82.54, [0, 2, 0, 0]).averageMinutes, 82.5);
  assert.equal(timingSummary(2, NaN).averageMinutes, null);
  assert.equal(timingSummary(0, 42).averageMinutes, null);
});
test("safe audit projection excludes secrets, free text, locations and invalid historical fields", () => {
  const row = safeAuditEvent({
    id: "reference",
    targetId: "reference",
    targetType: "REPORT",
    eventType: "REPORT_CREATED",
    timestamp: now,
    actorRole: "ADMIN",
    actorId: "a".repeat(24),
    outcome: "SUCCESS",
    before: { status: "PENDING", password: "PRIVATE" },
    after: { status: "VERIFIED", location: { lat: 20 }, balanceLitres: -1 },
    otp: "PRIVATE",
    reason: "PRIVATE",
    privatePrompt: "PRIVATE",
    isDemo: false,
  });
  assert.equal(JSON.stringify(row).includes("PRIVATE"), false);
  assert.deepEqual(row.before, { status: "PENDING" });
  assert.deepEqual(row.after, { status: "VERIFIED" });
  const unknown = safeAuditEvent({
    eventType: "PRIVATE",
    actorId: "PRIVATE",
    actorRole: "PRIVATE",
    correlationId: "PRIVATE",
    timestamp: "PRIVATE",
  });
  assert.equal(unknown.eventType, "UNKNOWN_EVENT");
  assert.equal(unknown.timestamp, null);
  assert.equal(unknown.actorRole, null);
});
test("append-only guard rejects replacement, removal, trim and reordering but permits atomic append", () => {
  for (const update of [
    [],
    { $set: { "audit.0.action": "x" } },
    { $unset: { audit: 1 } },
    { $pull: { audit: {} } },
    { $push: { audit: { $each: [], $slice: 1 } } },
    { $push: { audit: { $each: [], $position: 0 } } },
    { $rename: { other: "audit" } },
    { audit: [] },
  ])
    assert.throws(() => assertAppendOnlyUpdate(update));
  assert.doesNotThrow(() =>
    assertAppendOnlyUpdate({
      $set: { status: "DELIVERED" },
      $push: { audit: { action: "DELIVERY_COMPLETED" } },
    }),
  );
});
test("request audit roles correlate to the authenticated actor and outcomes preserve failure/recovery", () => {
  auditContext.run(
    {
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "a",
      role: "ADMIN",
    },
    () => {
      const entry = auditEntry("OPERATION_CONFLICT", { id: "a" });
      assert.equal(entry.actorRole, "ADMIN");
      assert.equal(entry.outcome, "FAILURE");
      assert.ok(entry.correlationId);
      assert.equal(
        auditEntry("REPORT_CREATED", { id: "b" }).actorRole,
        undefined,
      );
      assert.equal(auditEntry("DELIVERY_RECOVERED").outcome, "RECOVERED");
    },
  );
});
test("bounded database timeout is sanitized without swallowing other failures", async () => {
  await assert.rejects(
    analyticsBound(() => Promise.reject({ code: 50, message: "PRIVATE" })),
    (e) => e.code === "ANALYTICS_TIMEOUT" && !e.message.includes("PRIVATE"),
  );
  const error = new Error("ordinary");
  await assert.rejects(
    analyticsBound(() => Promise.reject(error)),
    (e) => e === error,
  );
});
