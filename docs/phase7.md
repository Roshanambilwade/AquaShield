# Phase 7 — routing, trips and delivery verification

Phase 7 extends the existing JavaScript React/Vite, Express and MongoDB application.
It reuses opaque session authentication, ADMIN/OPERATOR/CITIZEN authorization,
strict Zod validation, shortage membership, Phase 6 allocation/reservation
recovery, tanker eligibility, actor/time audit arrays and the existing Leaflet
dependency. Gemini/Strands configuration and agent behavior are unchanged.
No live AI requests, AWS deployment, Bedrock, Phase 8, staging or commits are
part of this work. The previously reported live Resource Allocation HTTP 503
remains an unrelated provider issue; see phase5.md and gemini-output-limit.md.

## Persisted workflow

`ASSIGNED → EN_ROUTE → ARRIVED → DELIVERED`

Delivery is the single new persistent trip/delivery representation. It has a
unique allocation reference, event/tanker/operator references, the approved
destination snapshot, recorded origin observation, planned quantity, starting
water/capacity constraints, nullable actual litres, timestamps, verification
method/state and an actor/time audit trail. Existing assigned allocations are
backfilled idempotently when the operator or municipal trip list is opened.
No existing reports are reassigned and no user data is migrated or reset.

Only the authenticated assigned operator can start, arrive, verify and complete.
The administrator can inspect history and recover interrupted completion but
cannot impersonate an operator's trip actions. Citizens cannot call these APIs.
Skipped states, repeated transitions/completion, cross-operator identifiers,
client ownership/destination/state/verification fields and invalid quantities
are rejected by the backend. Completion requires accepted OTP verification and
positive integer actual litres bounded by planned quantity when known, initial
water, current water and tanker capacity. Planned water is never silently
substituted for actual litres.

Significant audit actions: `TRIP_STARTED`, `TANKER_ARRIVED`,
`DELIVERY_OTP_GENERATED`, `DELIVERY_OTP_REJECTED`, `DELIVERY_OTP_EXPIRED`,
`DELIVERY_VERIFIED`, `DELIVERY_COMPLETED`, `DELIVERY_RESERVATION_RELEASED`.
Audits contain actor and time and remain associated with trusted entity records;
they never contain OTPs or provider secrets.

### Recovery and concurrent requests

All transitions use conditional MongoDB writes. OTP verification claims the
current issuance and attempt count atomically. Concurrent verification and
completion have one successful claimant. Delivery first enters internal
`COMPLETING`, freezing actual litres. Replayable writes then mark Delivery
DELIVERED, Allocation COMPLETED, release only that allocation's tanker, clear
the event reservation, and clear `syncPending`. Actual water metrics sum the
unique verified DELIVERED records, never allocations or audit entries.

This works on standalone MongoDB without requiring replica-set transactions.
An interrupted completion keeps `syncPending=true`; use the administrator's
**Recover completion** action. It cannot change actual litres or release a
newer/different reservation. Repeated recovery after synchronization and repeated
operator completion are rejected. Other records can briefly show pending
synchronization; do not present cross-document writes as a transaction.

An interrupted tanker start/arrival projection is repaired on the next authorized
trip-list read; the delivery record remains authoritative and the reservation
never becomes available prematurely. After completion, remaining water determines
recorded AVAILABLE/UNAVAILABLE state. The old origin coordinate is cleared:
arrival at an approximate area center is not a measured GPS position. Water
observation time records the completion accounting, not a GPS feed.

The existing reset is limited to Phase 6-owned fictional fleet/allocations.
It refuses active trips and pending completions. Conditional RESETTING claims
prevent a concurrent trip start from being deleted; an interrupted unstarted
reset can be retried. Unrelated live/custom records and accounts are preserved.

## Routing and uncertainty

Default routing needs no external service. Haversine distance uses valid stored
coordinates and is labeled **straight-line distance**. ETA is an approximate
distance/average-speed calculation, explicitly not road navigation or live
traffic. Missing/invalid destination or origin, future/missing observation time,
or an origin older than `OPERATIONS_STALE_HOURS` makes distance/ETA unknown.
An assigned destination remains the approved approximate shortage-zone center.

Optional `ROUTING_BASE_URL` supports a backend OSRM-compatible HTTPS
`route/v1/driving` endpoint. This is optional, not a paid service requirement.
The endpoint cannot embed credentials/query strings; no credentials are sent
to the browser. Responses have a bounded timeout/body/geometry size, validated
coordinates and endpoint proximity. Valid responses display road distance,
service-estimated ETA and a route polyline. Errors/invalid responses retain the
clearly labeled straight-line fallback. No external routing calls were made
during verification; the provider adapter was tested with injected responses.

The operator UI has a local schematic and optional interactive Leaflet street
map. A dashed origin/destination connector is not a road route. Street-map tiles
need network access; coordinates/estimates remain visible without tiles. There
is no live GPS feed, traffic feed, route optimization or claimed live navigation.

## OTP safety and recipient handoff

The backend generates unpredictable six-digit codes with `crypto.randomInt`,
stores a random-salted scrypt hash bound to delivery/allocation/event, and
compares hashes in constant time. Issuances expire; attempts, reissue cooldown
and sensitive-operation IP rate limits are enforced. Successful verification
removes hash/salt and records method/time. Wrong/expired/wrong-delivery/replayed
codes cannot verify; concurrent requests cannot reuse an accepted issuance.

Ordinary list/detail/OTP responses and audit metadata never expose plaintext,
hash or salt. The assigned operator's **Generate demo OTP** endpoint can disclose
a newly generated code only for `isDemo=true` outside production, with an explicit
simulation label. It is not SMS, independent field verification or proof of a
real-world delivery. The UI keeps the revealed code only in component memory
and clears it after acceptance. Production cannot read fictional deliveries or
use their reveal endpoint.

For a non-demo delivery, the authenticated citizen portal now provides a handoff
without SMS. After ARRIVED, the earliest eligible account-backed reporter in the
persisted event is selected server-side as recipient. Duplicate/suspicious,
ownerless and disabled accounts do not qualify. Selection is saved once; other
citizens, administrators and operators cannot obtain the recipient's code.
`POST /api/reports/:id/delivery-otp` requires an owned live report, accepts only
`{}`, and returns only code, expiry and limitations. The code lives in component
memory, never browser storage or plaintext database fields. It uses the same
hash binding, expiry, cooldown, attempts and atomic verification protections.
The operator enters the code shared by that recipient. The method is recorded
as CITIZEN_PORTAL_OTP; identity, residency, physical quantity and every household's
receipt remain independently unverified. Accounts must meet over-the-wire HTTPS
and existing session-security requirements in any later public deployment.

Operator-triggered external messaging still requires a backend handoff adapter:
`createApp(config, { deliveryDependencies: { handoff } })`. Without that adapter,
`POST /api/deliveries/:id/otp` fails with VERIFICATION_UNAVAILABLE; use the citizen
portal instead. Failed external handoff invalidates its issuance. No SMS/email
subscription, government identity check or provider has been added. Ownerless
legacy reports have no citizen recipient and retain this explicit limitation.
OTP acceptance does not prove actual litres reached each household.

## APIs and UI

All `/api/deliveries` endpoints require verified sessions, use no-store responses
and accept strict inputs. Production excludes fictional data.

| Method | Path | Access / body |
| --- | --- | --- |
| GET | `/api/deliveries?demo=true|false` | ADMIN scoped source or OPERATOR owned trips/history |
| GET | `/api/deliveries/:id` | ADMIN or owning OPERATOR; delivery and route |
| POST | `/api/deliveries/:id/start` | Owning OPERATOR; `{}` |
| POST | `/api/deliveries/:id/arrive` | Owning OPERATOR; `{}` |
| POST | `/api/deliveries/:id/otp` | Owning OPERATOR; `{}`; real recipient handoff required |
| POST | `/api/deliveries/:id/demo-otp` | Owning OPERATOR; `{}`; fictional/non-production only |
| POST | `/api/deliveries/:id/verify` | Owning OPERATOR; `{ "code": "<six digits>" }` |
| POST | `/api/deliveries/:id/complete` | Owning OPERATOR; `{ "litresDelivered": <actual integer> }` |
| POST | `/api/deliveries/:id/recover` | ADMIN only; `{}`; interrupted completion only |
| POST | `/api/reports/:id/delivery-otp` | Designated CITIZEN with an owned eligible live report; `{}`; private portal code |

`GET /api/operator/assignments` now includes owned delivery history alongside
existing assignments and tankers. `/operator` adds TripCard controls.
`/operator/assignment/:id` opens an owned job through
`GET /api/operator/assignments/:id`, including safe refresh after completion.
`/admin/deliveries?demo=true|false` shows assigned/en-route/arrived/pending/completed
counts, displayed-history actual water totals, verification/attempt/expiry state,
timestamps, audits and recovery. It returns the latest 200 deliveries; counts on
this page are explicitly for that displayed history, not all-time totals.

The existing municipal KPI/map services consume persisted tanker and verified
delivery records. Delivered-water and average request-to-delivery time reflect
actual recorded quantities/times, not planned litres. No exact people-served
value is invented. Unknown previous delivery/location remains unknown.

My Reports/detail show APPROVED, ASSIGNED, EN_ROUTE, ARRIVED or DELIVERED only
when persisted event membership and allocation/delivery records support them.
Only safe status and lifecycle times reach citizens; no operator identifiers,
internal notes, allocation IDs, audits or OTPs. Old reports remain ownerless.
Area delivery does not verify the report, confirm household receipt or resolve
the shortage. Missing relations remain unavailable. No prediction was added.

## Configuration

Existing ignored root `.env` remains unchanged; `.env.example` adds defaults.

| Variable | Default / bounds |
| --- | --- |
| `ROUTING_BASE_URL` | Empty; optional OSRM-compatible HTTPS endpoint |
| `ROUTING_AVERAGE_SPEED_KPH` | 25; 5–100 km/h |
| `ROUTING_TIMEOUT_MS` | 5000; 100–10000 ms |
| `DELIVERY_OTP_TTL_SECONDS` | 300; 60–900 seconds |
| `DELIVERY_OTP_MAX_ATTEMPTS` | 5; 1–10 per issuance |
| `DELIVERY_OTP_REISSUE_SECONDS` | 60; 15–300 seconds |

Verification/issuance share a 20-request/IP/15-minute limiter; other trip
mutations use 60/IP/15 minutes. These reuse the existing process-local limiter;
shared multi-instance limits remain deployment hardening work.

## Exact local demo

1. Start MongoDB and `npm run dev`. Provision an administrator with the existing
   `npm run admin:create` if needed. No default password is installed.
2. Sign in at `/login`. Open `/admin/tankers?demo=true`, expand **Prepare or reset
   the demo**, and select **Reset demo operations**. Read the scope before reset;
   it refuses active trips. Do not reset ordinary live/custom records.
3. Use **Provision operator access** to create an operator with a unique email
   and private password. Edit DEMO-T01, link that operator, confirm operational
   facts and save. Stored coordinates are fictional, not a live location feed.
4. Open `/admin/allocations?demo=true`. Request a deterministic recommendation,
   review the evidence, **Approve allocation**, then **Assign approved tanker**.
   Gemini is optional for this operation; do not invoke real AI for this demo.
5. Sign out, open `/login?returnTo=/operator`, and sign in as that operator.
   Select **Open assigned job** or use the main operator trip card. Review the destination, stored origin,
   distance method/estimated ETA and observation warnings. **Show street map**
   is optional; no paid routing endpoint is needed.
6. Select **Start trip**, refresh and confirm EN_ROUTE. Select **Mark arrived**.
7. Select **Generate demo OTP**. Read the explicitly labeled transient code,
   enter it in **Delivery OTP** and select **Verify delivery OTP**. Never describe
   this as real SMS or independent verification. Reissue requires the cooldown.
8. Enter an actual fictional quantity, e.g. 3,500 L within the approved/available
   quantity, then select **Complete delivery**. Refresh to confirm DELIVERED.
9. Sign out and sign back in as administrator. Open `/admin/deliveries?demo=true`,
   inspect actual litres, timestamps and **Trip timestamps and audit history**.
   Check `/admin/allocations?demo=true` for COMPLETED and `/admin/tankers?demo=true`
   for remaining water/availability. The old location is now unknown.
10. Refresh `/admin?demo=true` to inspect recorded delivered-water/response-time
    KPIs. The shortage remains active; one delivery does not resolve it.
11. A citizen session can inspect `/my-reports?demo=true` and the seeded report
    details for the permitted fictional area response. Those legacy seed records
    are public fictional examples, not reassigned to a real citizen account.
    Private owned-report tracking through a real-source allocation now uses the
    citizen portal handoff; follow the separate real-source walkthrough in
    docs/through-phase7-audit.md. Do not claim that the seed report
    belongs to a signed-in citizen or that their household received water.
12. Only if completion was interrupted, an administrator selects **Recover
    completion**. After completion, a repeat demo reset removes only owned
    fictional operational history; unrelated users/reports/fleet are preserved.

## Verification and file inventory

Normal tests use no live Gemini, AWS or paid routing. Mongo/browser suites use
generated UUID database names and guarded isolated cleanup. The normal database
is not seeded/reset/deleted by these test commands.

Run `npm test`, `npm run test:mongo`, `npm run lint`, `npm run build`, then
`npm run test:e2e`. Tests cover stored/fallback/service routing, invalid/stale
inputs, strict bodies, ownership/admin permissions, lifecycle, hash binding,
expiry, attempts, rate limiting, replay, concurrent verification/completion,
actual quantity constraints, accounting, audited recoverable interruption,
production/demo boundaries, citizen privacy, refresh and renewed login.
Historical initial Phase 7 verification on 9–10 October 2026 (latest completion
checks and authorized live-agent results are in docs/through-phase7-audit.md):

| Command | Result |
| --- | --- |
| `npm test` | 135 passed; no failures or skips |
| `npm run test:mongo` | 73 passed; no failures or skips |
| `npm run test:e2e` | 90 passed across desktop and mobile |
| `npm run test:e2e -- tests/e2e/phase7.spec.js` | 4 passed again against the final production build |
| `npm run lint` | Passed |
| `npm run build` | Passed |

The Phase 7 browser scenarios also passed separately on desktop and mobile.
The final build was checked again with the same focused four tests. Screenshots
of municipal delivery history were inspected at both viewport sizes.
Existing Phase 1–6.5 regression suites remain passing. Tests include legacy
delivery-ledger compatibility: missing allocation references do not collide
under the partial unique index, and unknown verification methods remain unknown.

Local Phase 7 behavior is verified; the later completion audit adds citizen
portal handoff and its production-mode authorization tests. Controlled test
handoff and fictional demo OTP are not proof of production SMS or household
receipt. No live AI, AWS, paid routing or SMS requests were made in the initial
Phase 7 work; later explicitly authorized Gemini outcomes are recorded separately.

New files: `apps/api/src/models/Delivery.js`, `apps/api/src/routes/deliveries.js`,
`apps/api/src/services/{deliveryService,deliveryOtp,routingService}.js`,
`apps/api/src/validation/delivery.js`, `apps/api/test/{delivery,delivery.mongo}.test.js`,
`apps/web/src/components/{TripCard,TripMap}.jsx`, `apps/web/src/pages/{DeliveriesPage,OperatorAssignmentPage}.jsx`,
`tests/e2e/phase7.spec.js`, `docs/phase7.md`.

Existing files extended: `.env.example`, `AQUASHIELD_SPEC.md`, `README.md`,
`docs/demo.md`, `apps/api/package.json`, `apps/api/src/app.js`,
`apps/api/src/config/operations.js`, `apps/api/src/demo/seedOperations.js`,
`apps/api/src/models/{Allocation,Tanker}.js`, `apps/api/src/routes/{index,operations}.js`,
`apps/api/src/services/{dashboardService,operationsService,reportResponseService}.js`,
`apps/api/test/{app,operations}.test.js`, `apps/web/src/{App.jsx,admin.css}`,
`apps/web/src/components/{AdminLayout,ReportDetails}.jsx`, `apps/web/src/lib/adminApi.js`,
`apps/web/src/pages/{HomePage,OperatorPage,ReportHistoryPage}.jsx`,
`playwright.config.js`, `tests/e2e/phase1.spec.js`.
