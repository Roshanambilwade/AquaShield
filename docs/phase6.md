# Phase 6 — fair allocation and tanker operations

Phase 6 adds persisted fleet management, deterministic recommendations, explicit administrator approval/rejection and assignment, and an operator assignment view. It reuses Phase 3 shortage detection/severity/fairness, Phase 4 authentication/dashboard and Phase 5 Resource Allocation Agent. JavaScript remains the application language. Phase 7, route tracking, trip controls, OTP/QR, delivery completion, forecasts and AWS deployment are not implemented here.

## Run and demonstrate

Phase 6.5 now requires a CITIZEN account for live report submission and account-owned history. Register at `/register`, sign in at `/citizen/login`, and review sources as an administrator at `/admin/reports`. Existing demo operations and operator accounts are unchanged. See [Phase 6.5 setup and limitations](phase65.md).

1. Start MongoDB and `npm run dev`. Use the root `.env`; `OPERATIONS_STALE_HOURS=12` controls tanker observation freshness. Existing `AI_FAIRNESS_MAX_ADJUSTMENT` controls the maximum previous-delivery priority reduction. Use `DEMO_AI_MODE=true` for key-free agent simulation. Never place a real key in `.env.example`.
2. Provision an administrator with the existing `npm run admin:create`, then sign in at `/login`.
3. Open `/admin/tankers?demo=true`. Expand **Prepare or reset the demo** and select **Reset demo operations**. This also prepares the existing multi-area shortage scenario. The original `npm run seed:demo` remains report-only.
4. Under **Provision operator access**, enter a name, unique email and password of at least 12 characters. There are no default passwords or public operator self-registration. Accounts are never overwritten. Communicate credentials privately.
5. Edit **DEMO-T01**, choose that operator, confirm the current operational facts, and save. T01 has fictional capacity 10,000 L and available water 8,000 L. T02 is unavailable; T03 has unknown available water and no operator. New demo tankers have no invented account links; T01 becomes eligible only after this step. No real availability is implied.
6. Open `/admin/allocations?demo=true`. Inspect Panchavati and competing areas, eligible/excluded tankers, approximate population, deterministic severity, previous-day delivery evidence and priority. Fictional Panchavati demand is 10,000 L and previous delivery is 4,000 L. These inputs feed the existing formula; final priorities are not seeded. Default maximum reduction is 15 points, so this reduces Panchavati's priority without necessarily moving it below Satpur.
7. Request a recommendation. Optionally request an agent explanation: demo mode says **Demo AI simulation — no Gemini execution**. Otherwise the record is explicitly deterministic. A validated real Gemini result uses real-provider provenance; timeout/provider/invalid-output failures leave a labeled deterministic recommendation and sanitized failure code.
8. Reject the first recommendation with a reason. Request another, review it, select **Approve allocation**, and then separately **Assign approved tanker**. Approval alone does not reserve or dispatch it. Refresh to confirm saved status and audit history. After assignment, T01 is unavailable to competing areas; a subsequent request clearly reports no eligible tanker.
9. Sign out and use `/login?returnTo=/operator` with the provisioned operator credentials. Confirm the assigned tanker, assignment ID/status, destination area and approximate zone center, capacity, planned quantity and instructions. Unrelated operators see only their own records. There are no trip or delivery buttons.
10. To demonstrate a stale conflict, reset the demo, link/confirm T01 if necessary, recommend and approve it, then change its availability or available water in another admin tab before assigning. Assignment must fail with a refresh/review message. Reject and generate a fresh recommendation. Unconfirmed/stale records are excluded, not assumed available.

Reset is authenticated, explicit, disabled in production and limited to `aquashield-phase6`-owned simulated operations. It preserves live records, custom fleet records, operator accounts and existing operator links. Demo report seeding retains its existing production safeguards. Reset refuses an in-flight assignment. Demo snapshots are fictional; recent operational confirmations expire naturally and may need refreshing.

## Deterministic decisions and unknown evidence

Only ACTIVE, unassigned shortage events are candidates. Ordering reuses `calculatePreviousDeliveryPenalty` and `calculateAllocationPriority`: current severity minus the configured adjustment for documented previous-day litres relative to verified demand. Severity is unchanged and already incorporates duration, estimated population, household water, environment, vulnerability and confidence where known. Ties use duration, then stable event ID.

Admins can record documented demand and the complete previous-day delivered quantity with a source reference through the evidence form. This is an attestation of existing ledger evidence, not a delivery-completion action or independent field verification. Evidence expires after 24 hours. Unknown demand, previous quantities and population remain null. Without complete demand/delivery evidence, the UI explicitly uses the unchanged severity baseline and labels fairness partial. It never interprets absent delivery records as zero or invents litres per person. Partial historical delivery lists are not assumed to establish complete daily totals.

Eligible tankers must be AVAILABLE, unreserved, linked to an active operator, have positive known water no greater than capacity, and have a fresh observation. Location may remain unknown because routing is out of scope. Deterministic selection chooses the smallest sufficient known load; otherwise the largest partial load, or largest available load when demand is unknown. Identifier breaks ties. Planned litres are the lesser of documented demand and the selected load, or unknown without demand. This is a proposed quantity, never delivered water.

The backend enforces the highest-priority unassigned event and current preferred candidate at recommendation, approval and assignment. It rechecks capacity/operator/planned quantity against approval before reserving. Changing relevant approved facts requires rejection and renewed review. AI receives bounded backend facts and eligible candidate references through the existing validated Resource Allocation Agent; it cannot select outside that allowlist or perform mutations. Backend selection remains authoritative even if the explanation suggests another eligible candidate.

## APIs and states

All `/api/operations` routes require an active ADMIN session. `?demo=true` selects simulated records and is forbidden in production; the default is live records. Bodies reject unknown authority/score/status fields.

| Method    | Path under `/api/operations`       | Purpose                                                                           |
| --------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| GET       | `/tankers`, `/tankers/:id`         | Fleet/details, observation freshness and eligibility                              |
| POST      | `/tankers`                         | Register validated tanker                                                         |
| PATCH     | `/tankers/:id`                     | Full validated update with expected `revision`; assigned tankers cannot be edited |
| POST      | `/operators`                       | Provision a password-hashed OPERATOR account                                      |
| GET       | `/allocation-context`              | Current deterministic ranking and eligible/excluded candidates                    |
| GET / PUT | `/evidence/:eventId`               | Read/record source-attributed demand and previous-day delivery evidence           |
| GET       | `/allocations`, `/allocations/:id` | Decision history and saved evidence                                               |
| POST      | `/allocations/recommend`           | Idempotent request UUID, event ID, optional notes/agent explanation               |
| POST      | `/allocations/:id/approve`         | Explicit approval, with current-state validation                                  |
| POST      | `/allocations/:id/reject`          | Reason-required rejection                                                         |
| POST      | `/allocations/:id/assign`          | Explicit assignment or recovery of the same interrupted intent                    |
| POST      | `/demo/reset`                      | Explicit `RESET_DEMO_OPERATIONS` confirmation                                     |

`GET /api/operator/assignments` requires OPERATOR and filters by the authenticated account. Existing `/api/auth/login`, `/me`, `/logout` now support provisioned operators as well as administrators; administrator routes remain ADMIN-only. Roles never come from login form values.

Transitions: `RECOMMENDED → APPROVED → ASSIGNING → ASSIGNED`; `RECOMMENDED → REJECTED` and `APPROVED/ASSIGNING → RECONCILING → REJECTED`. RECONCILING holds the active-event constraint until conditional reservation release completes. ASSIGNING is an internal recoverable reservation intent, not a trip state. Repeated completed actions return the same record where safe. Rejected records cannot be approved/assigned. One active allocation per event and one assigned allocation per tanker are enforced by partial unique indexes; tanker reservation uses revision-checked atomic writes. This works on standalone MongoDB without transactions. Actor/time/reason audit records cover decisions, reservations and conflicts. Original recommendation and approval snapshots remain available alongside the latest assignment evidence and AI provenance.

If the process stops before or after reservation, **Resume assignment** revalidates current event eligibility, fairness priority, linked operator, quantity and freshness. A valid intent can finalize idempotently. An invalid interrupted intent is audited and rejected through replayable RECONCILING, releasing only its own reservation. Administrators can reject an interrupted intent explicitly; if cancellation itself stops mid-write, repeat rejection to finish cleanup. Fleet edits cannot release reserved tankers, and there is no automatic timer release. See [recovery tests and limits](remediation.md).

## Limits

- One active assignment per tanker/operator and event; split multi-tanker demand, trip completion and release/reassignment after delivery are later work.
- Each operator account is linked to at most one fleet record, including across live/demo sources; use a separate operator account for a separate demo tanker.
- No distance/ETA provider, route optimization, actual dispatch, delivery verification or invented location data.
- Fairness requires documented demand and complete delivery totals; partial evidence remains visible. No automatic ingestion of external ledgers.
- History currently returns the newest 200 allocations; fleet operations refuse more than 1,000 records rather than rank a silently truncated fleet. Multi-instance distributed rate limiting and large-fleet pagination are deployment hardening work.
- Recommendation concurrency and per-client rate limits are bounded. Existing agent deadlines/cancellation and output validation remain in force. AI failure fallback is explicit and does not claim successful Gemini execution. This phase does not establish that the previously unreliable live Gemini provider now works.
- Default tests use demo output/injected provider errors, not paid Gemini calls. Mongo tests use randomly named disposable databases. The Phase 6 browser test forwards browser API requests to a real local Express server with its own disposable MongoDB database, preserving the developer's fleet/history.

## Verification and file inventory

Run `npm test`, `npm run test:mongo`, `npm run lint`, `npm run build`, and `npm run test:e2e`. Browser coverage includes desktop/mobile admin login, demo reset, operator provisioning/linking, rejection, demo explanation, approval, assignment, MongoDB persistence, reload and operator login/view. Existing Phase 1–5 tests remain in the suite. Screenshots are in ignored `.local/qa/phase6-*`.

Verified on 9 October 2026: `npm test` passed 102 tests; `npm run test:mongo` passed 37 tests; `npm run test:e2e` passed all 66 desktop/mobile tests; lint and production build passed. No existing test was removed. New Mongo tests also cover changed approved quantities, two different allocation attempts for one tanker, and recovery of a reserved intent. Live Gemini was not invoked or claimed as verified.

New files:

- `apps/api/src/config/operations.js`
- `apps/api/src/models/{Tanker,Allocation,AllocationEvidence}.js`
- `apps/api/src/validation/operations.js`
- `apps/api/src/services/{allocationEngine,operationsService}.js`
- `apps/api/src/routes/operations.js`
- `apps/api/src/demo/seedOperations.js`
- `apps/api/test/{operations,operations.mongo}.test.js`
- `apps/web/src/pages/{OperationsPage,OperatorPage}.jsx`
- `tests/e2e/phase6.spec.js`
- `docs/phase6.md`

Existing files extended in Phase 6:

- `.env.example`, `AQUASHIELD_SPEC.md`, `README.md`, `docs/demo.md`
- `apps/api/package.json`, `apps/api/src/app.js`, `apps/api/src/config/env.js`
- `apps/api/src/middleware/admin.js`, `apps/api/src/routes/{auth,index}.js`
- `apps/api/src/services/{authService,dashboardService}.js`, `apps/api/test/app.test.js`
- `apps/api/src/services/ai/{demo,prompts}.js` (existing agent extended for allocation evidence; versioned prompt)
- `apps/web/src/App.jsx`, `apps/web/src/admin.css`, `apps/web/src/components/AdminLayout.jsx`
- `apps/web/src/lib/adminApi.js`, `apps/web/src/pages/LoginPage.jsx`

Other pre-existing uncommitted Phase 5/provider-diagnostic changes are preserved; this inventory does not claim authorship of them. Nothing is committed or deployed by this phase.

## Pre-Phase-7 remediation update

See [the remediation report](remediation.md) for current public aggregation, bounded detection refresh, authoritative allocation advice, recovery policy, fleet eligibility, citizen response history, test isolation and agent verification. Earlier test counts in this document are historical phase snapshots. No live Gemini inference was run during remediation; demo and mocked-provider tests are not proof of live execution. Phase 7 and deployment remain outside this task.
