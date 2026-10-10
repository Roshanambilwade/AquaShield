# Phase 10 — municipal analytics and auditability

This extends the existing JavaScript application. Existing dashboard components, sessions/role checks, immutable report ownership/verification, operational eligibility/fairness, allocation approval and assignment, conditional trip/OTP/completion recovery, and Phase 8 numerical services are reused. There is no new provider, prediction formula, simulation, paid dependency, live inference, cloud deployment or automatic Git operation. Normal operational and faculty demo records were not reset, migrated or reseeded.

## Coverage inspected and gaps addressed

Previously `/api/dashboard/analytics` exposed current event evidence, latest reporting-hour counts and operational summaries. It lacked selectable historical windows, recorded milestone denominators, allocation/alert activity cohorts and searchable municipal audit history. Its event read could recalculate/persist assessments. Existing embedded journals already accompanied allocation, tanker, delivery, fairness evidence and alert writes; duplicating them into a separate collection would introduce consistency problems on standalone MongoDB.

Phase 10 replaces that endpoint's aggregation implementation and retains its existing response keys/components. Reads use persisted assessments and never refresh detection or evaluate predictions. New report creation has an atomic creation journal. Existing workflow journals acquire optional safe transition/role/correlation/outcome metadata. The new administrative history projects these journals with `$unionWith`; there is no duplicate audit-write service or audit mutation API.

## Metric definitions

The default window is the preceding seven days. Both custom timestamps must be supplied together, include timezone information, increase and span at most 90 days. Values are normalized to UTC: **from inclusive, to exclusive**. The end may be at most sixty seconds ahead of server time for clock tolerance. The UI labels UTC explicitly and offers seven/thirty/ninety-day presets. Selecting an area filters reports, associated allocations, deliveries, alerts and current assessments; fleet remains a labeled global snapshot.

| Metric | Calculation / denominator | Window, exclusions and missing values |
| --- | --- | --- |
| Submitted reports, activity by area/day | Number of report records; day groups use UTC `createdAt` | Creation window, selected provenance/area. Includes repeats and unverified submissions; not unique households or confirmed shortages. Null/unknown areas share an unknown bucket. |
| Verified/unverified/pending/rejected | Current `verificationStatus` of the creation cohort. Unverified = total minus VERIFIED, including rejected | No historical verification transition is inferred. Pending means awaiting verification, not confirmed physical lack of supply. |
| Review response time | Unknown; zero recorded denominator | There is no administrative report review timestamp/change workflow. `updatedAt` is not a substitute. |
| Report → recommendation / assignment / accepted area delivery | Earliest valid corresponding `Allocation.createdAt`, `assignedAt` or `Delivery.deliveredAt`, minus report creation; minutes. Mean = sum / number with a valid milestone | Non-rejected reports created in window; current stored `event.reportIds` links and matching provenance. Milestone must be on/after submission and before window end. One result per report despite overlapping event joins. Excluded/duplicate reports without an eligible link are not credited. Does not prove household receipt or reconstruct historical event membership. |
| Still-pending elapsed time | Window end minus submission, averaged over non-rejected cohort reports without an accepted linked delivery before end | Separate from completed means. Includes missing/unlinked evidence; does not prove no physical delivery happened. |
| Recommendations / approvals / rejections / assignments | Count distinct allocation records with the corresponding creation/approval/rejection/assignment timestamp in window | Actions can belong to allocations created earlier. Current status counts instead use the creation cohort. Rejected/missing-date records are not counted as successful approvals/assignments. |
| Current active/emerging cases, severity distribution | Stored ACTIVE/EMERGING event counts by existing `severityLevel`; oldest assessment timestamp exposed | Current assessment snapshot, independent of historical window. No scoring recalculation. HISTORICAL/SUPERSEDED excluded. Physical resolution count unknown. Evidence sums can overlap between clusters and do not represent unique households. |
| Fleet available / assigned work | Availability reuses `tankerEligibility`, including quantity/freshness/status/reservation and an active linked OPERATOR. Busy counts reservation OR ASSIGNED/EN_ROUTE/ARRIVED, once per tanker | Global current snapshot; assigned/reserved/stale/invalid/no-active-operator tankers are not available. Missing fleet collection → unknown; known empty collection → zero counts. |
| Fleet utilization | 100 × busy records / all fleet records, rounded to one decimal | Snapshot percentage, **not time utilization**. Empty denominator → null. Unavailable fleet records remain in denominator; not a claim of operational efficiency. |
| Completed deliveries / delivered litres / area totals | Distinct DELIVERED records with `otpVerified=true`, positive integer litres and `deliveredAt` in window; sum each accepted record's litres once | Does not sum allocations or audit events. Wrong OTP, invalid quantity, missing/out-of-window delivery time excluded. Synchronization-pending count exposed separately. Existing demo receipts remain fictional; live portal participation is not independent identity or household-receipt verification. |
| Completed delivery response / trip duration | `deliveredAt-requestedAt` / `deliveredAt-startedAt`, in minutes; mean over valid nonnegative Date pairs | Accepted completion cohort. Missing/reversed pairs excluded from means, with separate valid counts. Requested time is the existing allocation-request timestamp. Mean does not include pending trips. |
| Timing distributions | Valid timings grouped `[0,60)`, `[60,360)`, `[360,1440)`, `[1440,∞)` minutes | Each panel's buckets sum to that panel's valid timing denominator. No valid timings → mean null, bucket counts zero. |
| Pending/current delivery states | Current status counts of delivery records created in window | ASSIGNED/EN_ROUTE/ARRIVED/COMPLETING stay separate from accepted completions; not an as-of historical status timeline. |
| Failure / recovery activity | Recorded OPERATION_CONFLICT and OTP rejection/expiry/handoff-failure entries; explicit DELIVERY_RECOVERED entries in window | Counts journal events, not unique incidents or all possible failures. Missing legacy recovery markers are not reconstructed. Conditional writes avoid duplicate committed-state entries. |
| Alert activity | Creation count, current status/risk/area groups of creation cohort; lifecycle journal types by event time | Alert status/risk are current, not state at historical window end. Acknowledgment/resolution of an activity alert does not resolve a physical shortage. |
| High-priority review areas | Current ACTIVE HIGH/CRITICAL areas without an accepted delivery recorded in selected window | Absence of a record is not evidence of no supply or a fair/unfair outcome. Legacy fairness/priority calculations remain unchanged. |
| Saved activity forecasts | Current supported Phase 8 saved results, separate supported/high-risk counts | No evaluation or Gemini request. NOT_EVALUATED, INSUFFICIENT_DATA and unavailable/stale are distinguished. Forecasts approximate report activity, not physical depletion; no new accuracy claim. |
| People served / physical resolution | Unknown | Existing data cannot verify households physically served or a physical resolution time. Do not estimate these by dividing litres by an invented per-person demand. |

The hourly chart retains the latest **24 reporting hours within the selected window**, not twenty-four consecutive clock hours. Empty hours are not fabricated. `withoutCreationAudit` counts submissions with no journal; legacy gaps are visible.

## Audit contract and lifecycle

API fields: `id`, `eventType`, `timestamp`, `actorId`, `actorRole`, `targetType`, `targetId`, `correlationId`, `outcome`, `before`, `after`, `isDemo`, `source`, `note`.

Embedded entries retain their existing shape/action/timestamp and identifiers. Added optional fields are `actorRole`, `correlationId`, `outcome`, `before`, `after`. Safe state fields are status, recorded balance litres, OTP-verified boolean and alert risk category. Original completion intent actor/role is retained; terminal writes record the actor who actually commits that transition. An administrator recovery records its own recovery event. A tanker edit checks the expected revision against the fetched previous state before the existing CAS, avoiding an incorrect before-state snapshot.

The server generates a UUID per request, returns `X-Request-ID` and carries it through `AsyncLocalStorage`. Incoming request IDs and client role values cannot set audit identity. Roles come from existing authenticated authorization or explicitly trusted internal actors. Historical missing role/correlation/transition fields remain null/empty. Known legacy action outcomes are classified by the action catalog; unknown types become UNKNOWN_EVENT with unknown outcome. Success means the recorded application action committed, not independently verified field facts.

Event identifiers are `TARGET_TYPE:<ObjectId>:<embedded-entry-ObjectId>`. Alerts use their append-only revision (`rN`); legacy entries without IDs use an array position (`iN`). Detail retrieval selects a single entry using `$elemMatch`/`$slice`. IDs identify events across embedded source collections and are stable under application-level append-only updates.

Covered actions:

- REPORT_CREATED, atomically alongside the citizen-owned report; idempotent replay adds no journal entry. There is no new REPORT_VERIFIED or administrative review workflow.
- RECOMMENDATION_GENERATED, ALLOCATION_APPROVED, ALLOCATION_REJECTED, TANKER_RESERVED, TANKER_ASSIGNED, RECONCILIATION_STARTED, RESERVATION_RELEASED, ALLOCATION_RECONCILED, OPERATION_CONFLICT.
- TANKER_REGISTERED, TANKER_UPDATED, FAIRNESS_EVIDENCE_RECORDED; subsequent assignments remain separate allocation records, without rewriting old history.
- TRIP_STARTED, TANKER_ARRIVED, DELIVERY_OTP_GENERATED, DELIVERY_OTP_EXPIRED, DELIVERY_OTP_REJECTED, DELIVERY_OTP_HANDOFF_FAILED, DELIVERY_VERIFIED, CITIZEN_RECIPIENT_SELECTED, DELIVERY_COMPLETION_STARTED, DELIVERY_COMPLETED, DELIVERY_RESERVATION_RELEASED, DELIVERY_RECOVERED.
- ALERT_CREATED, ESCALATED, DEESCALATED, UPDATED, DATA_UNAVAILABLE, REOPENED, ACKNOWLEDGED and RESOLVED (ALERT_ prefix in history), plus clearly fictional DEMO_TANKER_SEEDED/DEMO_RESET.

Intent/reconciliation-start entries have PENDING outcome. Recorded conflicts/failed OTP/handoff events have FAILURE. Recovery markers have RECOVERED; committed actions have SUCCESS. Failed handoff does not claim recipient verification. Completion intent, accepted receipt, allocation projection, tanker debit/release and final recovery remain the existing ordered, replayable conditional writes; no transaction requirement or delivery accounting rewrite is introduced. Cross-entity entries for the same request describe distinct committed target transitions rather than duplicate receipts.

Mongoose query/save guards reject changing/pulling/unsetting/replacing/trimming/reordering journal arrays. Operational entities containing audit entries cannot be deleted through guarded model operations. There is no municipal audit edit/delete route. Existing explicit fictional reset retains its established restrictions outside persistent demonstration mode, where reset is prohibited. Test cleanup/crash simulation uses raw collection access only inside already guarded disposable test databases, preserving existing assertions. Raw MongoDB access, privileged DBA operations or future unguarded bulk writes are not prevented by application middleware; this is not a cryptographic tamper-proof ledger or archival system.

Authentication success/failure, logout and privileged-route authorization denial emit allowlisted JSON operational logs with safe IDs/roles/correlation where known. They do not store attempted emails, passwords, session tokens, headers, URLs or raw errors. These security logs are not a new persisted searchable authentication ledger; deployment log collection/retention is deferred.

## APIs, access and provenance

| Endpoint | Contract |
| --- | --- |
| `GET /api/dashboard/analytics` | Existing ADMIN-only endpoint extended with strict `demo`, `from`, `to`, `areaId`; default seven-day window. Existing severity/hour/evidence/operational keys preserved, with new report/allocation/delivery/alert/current/prediction/window metadata. |
| `GET /api/audit` | ADMIN only. `demo`, `from`, `to`, `page` 1–100, `limit` 1–50 (default 20), exact `eventType`, `actorId`, `targetType`, `targetId`, `outcome`, UUID `correlationId`. Returns page, limit, hasMore, window, provenance and events; no unbounded total count. |
| `GET /api/audit/:id` | ADMIN only, validated composite ID and `demo` only; mismatched source or missing entry → AUDIT_NOT_FOUND. |

Authentication precedes query validation. CITIZEN/OPERATOR/anonymous/forged/expired sessions cannot bypass guards using filters. Responses are non-cacheable. No free-text audit reasons/notes, citizen descriptions/photos/contact/household coordinates, raw provider prompts/output, API keys, session material or OTP values/hashes/salts are exposed. Safe references link to existing authorized report/allocation/delivery/fleet/alert views. No export was added.

`isDemo` is matched in every source and join. Trusted DEMONSTRATION_MODE selects the existing persisted fictional/owned demonstration dataset regardless of query flag. Production rejects demo access. No provenance or report ownership is rewritten to improve metrics. A demo source label is not a claim that Gemini executed.

## Performance and operational limits

- Mongo aggregation performs report grouping and milestone joins; historical reports are not loaded into application memory. Individual queries have five-second bounds and disk spill disabled. Timeout → sanitized ANALYTICS_TIMEOUT, not a partial success.
- Area catalog bounded to 50, current assessments/fleet to 1000. Overflow → ANALYTICS_CAPACITY. Linked-report timing calculation supports up to 5000 cohort records; beyond that timings explicitly return CAPACITY_EXCEEDED while grouped counts remain available. Narrowing a window can restore timings; no biased partial sample is shown.
- Audit sources filter before unwind/union, including same-entry date/actor/correlation/action conditions where applicable. Stable timestamp/event-ID sort, bounded offset pages and limit+one provide hasMore. Outcomes inferred for legacy records are filtered after projection. Five-second aggregate/detail bound; narrow the window on timeout. Pagination across concurrently appended events is not an immutable snapshot.
- Indexes: all journal-bearing models add provenance plus audit time, actor/time, correlation/time and action/time (alert type/time). Reports add provenance/area/creation time; allocations add action-date and event-assignment indexes; deliveries add creation and event-delivery indexes; alerts add area/creation index. Existing unique active-event/tanker/allocation, ownership and alert constraints are preserved.
- Auto-indexing remains disabled. Existing storage initializers create additive declared indexes when the associated storage write paths run; analytics/audit GET requests do not build indexes or modify documents. An existing production database needs the existing controlled index-provisioning review before release; no index migration was run against normal records here.
- Latest saved predictions are fetched in one grouped query instead of one request per area; existing Phase 8 presentation/freshness/formulas/horizons are preserved. No cache or background job was introduced. Reads occur only on navigation, applied filters/pagination or explicit retry, not on every component render.
- Per-process read limits: analytics 30/minute and audit 60/minute per IP using the existing limiter. Distributed enforcement, archival/retention and large-data load characterization remain deployment work. Queries across collections are not one transactional snapshot; pending synchronization is visible.

## UI and verification

`/admin/analytics` retains Evidence analytics and adds observed activity, UTC/area filters, timing distributions with valid denominators, day/area tables, allocation and delivery outcomes, fleet/alert summaries, metric explanations and a separate saved forecast availability panel. `/admin/audit` adds search, bounded pagination and safe detail at `/admin/audit/:id`. New views use the existing ADMIN layout/data/error hook. Tables scroll within their containers; controls have explicit labels. Desktop/mobile loading, no-data, errors, retries and session protection are covered. Screenshots in ignored `.local/qa/phase10-*` were visually inspected.

Run from the repository root, with local MongoDB:

```powershell
npm test
npm run test:mongo
npm run lint
npm run build
npm run security:check
npm run test:e2e
# Keep a user's existing 5173 server intact:
$env:AQUASHIELD_BROWSER_DEV_PORT='5175'
npm run test:dev-origins
Remove-Item Env:AQUASHIELD_BROWSER_DEV_PORT
git diff --check
```

Tests use unique disposable MongoDB databases and synthetic evidence. They test UTC boundaries, action cohorts, denominators, missing/reversed timestamps, duplicate joins, pending/completed separation, eligibility/utilization, litres, provenance, no read writes, prediction independence, safe actor/transition metadata, audit filters/pagination/detail, role protection, redaction and model append/delete protection. Existing concurrency/recovery tests now also assert one completion-intent entry, actor role and one administrator recovery marker. Existing numerical provider-outage and alert lifecycle tests remain intact.

Observed results on 10 October 2026:

| Command | Result |
| --- | --- |
| `npm test` | 185 passed, zero failed/skipped (seven new analytics/audit unit cases); final API discovery identifies Phase 10 and audit endpoint. |
| `npm run test:mongo` | 103 passed, zero failed/skipped (eleven new actual Mongo/API cases); preserved concurrency, recovery, litres and numerical-outage assertions. |
| `npm run test:e2e` | 112 passed: 56 desktop + 56 mobile, including eight new Phase 10 cases and all existing browser regressions. |
| `npx playwright test tests/e2e/phase1.spec.js tests/e2e/phase6.spec.js tests/e2e/phase10.spec.js` | 28 passed after final API discovery and demo audit metadata edits. |
| `npm run test:dev-origins`, with isolated port 5175 | Two passed: localhost and 127.0.0.1 submission, Mongo persistence and private retrieval; user's 5173 server preserved. |
| `npm run lint`, `npm run build`, `npm run security:check`, `git diff --check` | Passed; secret check reported zero findings. |
| Specification override comparison against HEAD | All twelve override rules unchanged. |

Initial sandbox localhost EACCES/OneDrive EPERM required approved execution outside the sandbox. Early browser runs caught filter label issues and existing-dashboard mobile overflow; fixes retained every existing assertion. Logs/screenshots stay ignored in `.local/phase10-*` and `.local/qa`. No mock execution is claimed as live Gemini proof. Linux container execution, cloud deployment and production scale testing remain unverified as documented in Phase 9.

## File inventory

Added:

- `apps/api/src/models/auditTrail.js`
- `apps/api/src/services/analyticsService.js`, `analyticsBound.js`, `auditContext.js`, `auditService.js`
- `apps/api/src/validation/analytics.js`, `apps/api/src/routes/audit.js`
- `apps/api/test/analytics.test.js`, `analytics.mongo.test.js`, `helpers/analyticsFixtures.js`
- `apps/web/src/components/HistoryFilters.jsx`, `MunicipalAnalytics.jsx`, `lib/historyWindow.js`, `pages/AuditPage.jsx`
- `tests/e2e/phase10.spec.js`, `docs/phase10.md`

Modified:

- `apps/api/package.json`; `apps/api/src/app.js`, `middleware/admin.js`, `routes/auth.js`, `routes/dashboard.js`, `routes/index.js`, `demo/seedOperations.js`
- API models `Report.js`, `Allocation.js`, `AllocationEvidence.js`, `Tanker.js`, `Delivery.js`, `EarlyWarningAlert.js`
- API services `reportService.js`, `dashboardService.js`, `operationsService.js`, `deliveryService.js`, `predictionService.js`
- Existing fixtures/assertions `apps/api/test/app.test.js`, `delivery.mongo.test.js`, `operations.mongo.test.js`, `shortages.mongo.test.js`, `tests/e2e/phase2.spec.js`, `phase3.spec.js`, `tests/development/origins.spec.js`
- `apps/web/src/App.jsx`, `admin.css`, `components/AdminLayout.jsx`, `lib/adminApi.js`, `pages/AnalyticsPage.jsx`
- `README.md`, `AQUASHIELD_SPEC.md`

No dependency, private `.env`, deterministic engine, agent prompt/provider or live cloud configuration changed. All twelve override rules remain intact. Phase 10 stops here; later phases require explicit authorization.
