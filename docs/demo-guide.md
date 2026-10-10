# Persistent faculty demonstration — Phase 12 presentation guide

The faculty dataset is stored in MongoDB, not rendered from frontend placeholders. It reuses the existing severity, confidence, population estimation, fairness, eligibility, authentication, trip and delivery services. All households, field checks, weather, capacities and deliveries in this scenario are simulated. Population is approximate; unknown data remains unknown. The interface displays **AquaShield — Demonstration Environment**. Phase 8 adds deterministic report-activity forecasting; AWS deployment and live-provider verification are separate activities.

## Repeatable startup (already provisioned dataset)

Use Node 22.13+, the installed MongoDB service and the repository's existing root `.env`. Do not replace that file. From the repository root, in the same PowerShell session used to start the application:

```powershell
$env:NODE_ENV='development'
$env:DEMONSTRATION_MODE='true'
$env:DEMO_SEED_ENABLED='false'
$env:DEMO_DATABASE_NAME='aquashield_demo'
$env:DEMO_AI_MODE='true'
npm run dev
```

`MONGODB_URI` still chooses the configured MongoDB server/credentials, but demonstration mode explicitly selects `aquashield_demo` as the database. Ordinary application records in the normal `aquashield` database remain separate. Use a development MongoDB server/account; never point this procedure at production. The first-time seed command refuses production mode, missing enable flags, an unsafe database name, a disconnected database or an actual connected database name that differs from the configured target. Allowed demo names match `aquashield_demo` with optional lowercase alphanumeric suffixes separated by underscores. UUID test overrides require `NODE_ENV=test` and the existing guarded test-name pattern. Environment flags are parsed as explicit `true`/`false` strings.

For first-time provisioning only, deliberately set DEMO_SEED_ENABLED=true, run npm run seed:demo, then set DEMO_SEED_ENABLED=false again before startup. Do not rerun the seed for repeat presentations. Startup does not change the presentation clock or automatically generate activity.

The seed uses stable account emails, report IDs/submission IDs, fleet identifiers and allocation request IDs. Missing records are inserted; existing source records, accounts, approvals, operator actions, tanker balances, audits and submissions are preserved. Derived shortage assessments may be recalculated from the saved reports. There are no collection clears, database drops or automatic resets in this command. The old reset UI/API is disabled in the persistent demonstration environment. Counts only are printed. Neither startup nor seeding calls Gemini, routing or external messaging.

Do not run competing seed commands concurrently. A collision aborts safely or uses the existing unique record. An interrupted allocation scene is preserved rather than replaying its approvals/trip steps; review it through the municipal UI. This deliberately favors preserving operator actions over automatically completing a partial seed.

Open [the local frontend](http://localhost:5173). The default backend is `http://localhost:5000`; both `localhost:5173` and `127.0.0.1:5173` remain supported by development CORS. To return to the ordinary environment, stop the processes and remove the session overrides (`Remove-Item Env:DEMONSTRATION_MODE,Env:DEMO_SEED_ENABLED,Env:DEMO_DATABASE_NAME,Env:DEMO_AI_MODE`), or open a new terminal with the normal root configuration. No `.env` modification is necessary.

## Accounts and initial scenario

First seeding securely generates `.local/demo-credentials.json`, ignored by Git, and preserves it on subsequent runs. Open that file privately to obtain each account's email and password. Do not display it during a recording, paste it into logs or share the `.local` directory. Database passwords use the application's normal scrypt hash; login uses normal expiring/revocable sessions. There is no bypass login or shared default password. If you supply your own local credential file, it must match the generated format/version/database and contain a unique password of at least 24 characters for every defined account. Existing database passwords are never overwritten; losing/changing the file does not reset them.

| Account key | Count | Login URL | Access |
| --- | ---: | --- | --- |
| `admin` | 1 | `/login` | Municipal dashboard, reports, fleet, evidence, approvals, history |
| `citizen-01` through `citizen-16` | 16 | `/citizen/login` | Only their own reports and permitted area response |
| `operator-01` through `operator-09` | 9 | `/login?returnTo=/operator` | Only linked tanker and owned assignments/trips |

On an empty guarded database the seed creates:

| Entity | Count |
| --- | ---: |
| Accounts | 26 (1 admin, 16 citizens, 9 operators) |
| Service areas | 6 |
| Reports | 48 |
| Tankers | 9 |
| Municipal fairness evidence records | 5 |
| Allocations | 12 |
| Trips/deliveries | 9 |
| Completed demo OTP deliveries | 6; 3,000 simulated litres recorded |
| Other trip states | 1 ASSIGNED, 1 EN_ROUTE, 1 ARRIVED |
| Other allocation states | 2 REJECTED, 1 RECOMMENDED |

Audits are embedded in the existing tanker/allocation/evidence/delivery records and are generated by the real services. There is no separate invented audit collection. The same services generate, hash, verify and consume the six completed demo OTPs. This is simulated receipt evidence, not real SMS or independently observed household receipt.

Panchavati remains the hero area; Satpur, Indira Nagar, Nashik Road and Adgaon use supported locality fixtures. **Demonstration East Sector** is an explicitly fictional sixth service area available only in demonstration mode. Its population/environment/water evidence is incomplete and unverified. Reports vary in time, household size, supply duration and water level, with pending reports, simulated checks, duplicate/conflicting submissions, older clusters and emerging evidence. Severity and confidence come from the existing engine; final scores are never seeded as constants. Some fleet records are unavailable, stale or have unknown water, and must be excluded by the existing eligibility rules.

## Faculty walkthrough

1. Start using the command above without reseeding. Keep credential contents and session tokens off camera. Sign in as `admin` and open `/admin` without needing `?demo=true`.
2. Compare areas on the map/table: severity, shortage confidence, approximate people affected, verified versus pending/excluded evidence. Open shortage details. View `/admin/reports` for authorized report/source review and `/admin/analytics` for report activity, response and delivery records.
3. Open `/admin/tankers`. Inspect all nine tankers and their linked operators, recorded water/capacity, availability and observation freshness. Operator names in the fleet identify the matching key in your local credential file. Unavailable/stale/unknown records are not eligible merely because they exist.
4. Open `/admin/allocations`. A saved RECOMMENDED scene is present. Fill its **Rejection reason** and reject it to demonstrate review, then select **Request allocation recommendation**. Alternatively approve the existing recommendation directly. Do not request a second active recommendation for the same event. The backend selects the current priority and eligible tanker using stored fairness evidence.
5. Review the priority, previous deliveries, missing inputs, selected tanker and planned quantity. The optional **Request an agent explanation** checkbox uses clearly labeled simulation when `DEMO_AI_MODE=true`; it cannot approve or assign. Select **Approve allocation**, then **Assign approved tanker**. Freshness and eligibility are rechecked at each step.
6. Identify the assigned operator through the selected tanker at `/admin/tankers`. Sign out; sign in with that operator's generated credentials at `/login?returnTo=/operator`. Confirm only owned work is visible.
7. On the assigned trip card inspect destination, recorded origin, labeled distance/estimated ETA and observation warnings. Select **Start trip**, refresh to confirm EN_ROUTE, then **Mark arrived**. A stored origin is not live GPS. Optional street tiles are not required for the stored coordinate/schematic view.
8. Select **Generate demo OTP**, enter the transient six-digit code in **Delivery OTP**, then **Verify delivery OTP**. Do not record the code or claim SMS/independent verification. Enter a simulated delivered quantity within the planned/capacity/available bounds (for example 400 L when permitted), then **Complete delivery**. Refresh and confirm DELIVERED. Code replay and out-of-order completion are rejected.
9. Sign back in as `admin`. Inspect `/admin/deliveries`, timestamps and audit history; inspect the COMPLETED allocation, released reservation and deducted tanker balance. Dashboard/analytics delivered-water totals reflect recorded verified quantities. A delivery does not automatically resolve the shortage, and no exact people-served count is invented.
10. Sign in as a seeded citizen with reports in that area. `/my-reports` and the individual report status show the permitted area response; this does not claim delivery to every household. Account-owned seeded reports are private. The legacy public `/my-reports?demo=true` preview deliberately excludes owned reports.
11. Register a new citizen at `/register`. Registration alone creates zero reports and requests no location. Sign in, open `/report`, explicitly choose a locality center or request device location using its button. Denied location permission has manual alternatives. Enter household size, conditions and optional evidence, then submit. It becomes a PENDING, `CITIZEN_SUBMISSION`, account-owned demo-database record and participates in the same assessments. Repeat reports are not automatically independent verified emergencies.
12. Open **Track this report**, refresh, sign out and sign in again. Confirm it remains in `/my-reports`. Another citizen cannot read it. Administrators can review it through `/admin/reports`; public alerts withhold small clusters and generalize coordinates.
13. Stop/restart the application with the same demonstration flags to confirm the dataset remains. Do not rerun the seed just to demonstrate persistence; inspect the saved trip and citizen report after restart.

For an owned citizen handoff, the earliest eligible account-backed reporter for an arrived trip is its designated recipient. Only that account can obtain **Get recipient delivery code** from its report status page. Enter it as the assigned operator; acceptance in this environment remains `DEMO_OTP`. Other accounts cannot obtain the code, and the UI never exposes private staff details in citizen status. This route does not require SMS.

## Time and data limits

The initial report clock is persisted once. Re-seeding does not move timestamps, renew environmental/fleet evidence, refill water or manufacture current activity. Existing freshness windows still apply: after time passes, reports can become historical and evidence/tanker observations can become stale. Before a later demonstration, use honest simulated citizen submissions and the existing municipal evidence/tanker forms to record current observations, or explicitly choose another guarded demo database with separately provisioned credentials. Do not claim old data is fresh. The current credential file is tied to one target and is preserved on mismatch.

Population and environmental observations are scenario estimates. Completed quantities are exact recorded **simulated** quantities; they are not field measurements. Precise location consent/validation, own-report privacy, role guards and public aggregation remain enforced. Road navigation, live tracking/traffic, SMS, verified identity/residency, physical household receipt and numeric forecasting are not provided by this dataset.

## Agent verification and explicit live opt-in

| Role | Mocked provider using saved scenario | Simulated HTTP 503 / deterministic fallback | Live Gemini on this dataset |
| --- | --- | --- | --- |
| Crisis Detection | Validated severity/confidence/evidence; incomplete zone exercised | RULE_BASED; incomplete zone remains INSUFFICIENT_DATA | Not run |
| Resource Allocation | Authoritative fairness, candidate eligibility and quantity snapshot | RULE_BASED; approval/assignment remain separate | Not run |
| Logistics | Stored assignment/completion state and backend route estimates | RULE_BASED; no state override | Not run |
| Early Warning | Existing activity and missing forecasting evidence | RULE_BASED / INSUFFICIENT_DATA; no invented risk score | Not run |

Mock injection uses successful Gemini-shaped advice through the same validator but makes no provider request. Its execution metadata is not evidence of live Google availability. Invalid invented numerical prose is rejected; the preserved unit suites also cover unauthorized actions, unsupported references, false verification, truncation, bounded retry/circuit/concurrency behavior, cancellation and privacy. The new scenario tests compare agent facts to persisted backend snapshots and check no operational writes.

Historical authorized results are recorded separately in `docs/through-phase7-audit.md`: Crisis Detection, Logistics and Early Warning passed then; Resource Allocation received HTTP 503 and remained unverified. This task did **not** rerun live inference or treat those earlier synthetic tests as verification of this richer dataset.

Only after explicit authorization, with backend `GEMINI_API_KEY` and `GEMINI_MODEL_ID` configured and the same safe demonstration database selected:

```powershell
$env:DEMO_AI_MODE='false'
npm run test:ai:live -- --role=detect --persisted-demo
npm run test:ai:live -- --role=allocate --persisted-demo
npm run test:ai:live -- --role=logistics --persisted-demo
npm run test:ai:live -- --role=predict --persisted-demo
```

These are optional manual commands, never run by seed/startup/ordinary tests. Each makes one model-access preflight and one bounded Strands invocation (the existing structured-output/tool cycle can require multiple Google generations), with application retries disabled and strict validation/no fallback. They consume Google API quota and may incur charges under your account/model pricing. Allowlisted aggregate scenario evidence excludes names, email, household descriptions/photos/coordinates and credentials. No prompt/response body is logged. Results report actual execution mode, latency, validation or sanitized failure code. `VERIFIED_REAL_GEMINI` requires GEMINI execution; RULE_BASED is never a live pass. An unavailable/expired scenario or unsupported model is an error, not a fabricated live success. Without `--persisted-demo`, the existing command uses synthetic evidence without MongoDB.

## Checks and changed files

Run `npm test`, `npm run test:mongo`, `npm run lint`, `npm run build`, `npm run test:e2e` and `npm run test:dev-origins`. Mongo/browser tests use disposable UUID databases, independent of the persistent demo database; test-only cleanup remains guarded. See the verification report below for observed counts and the exact file inventory. Do not run `test:ai:live` as part of routine checks.

## Observed verification — 10 October 2026

| Check | Observed result |
| --- | --- |
| `npm test` | 157 passed; zero failures/skips |
| `npm run test:mongo` | 83 passed; zero failures/skips |
| `npm run test:e2e` | 98 passed: 49 desktop and 49 mobile |
| Focused persistent-demo browser tests | 4 passed before full run |
| `npm run test:dev-origins` | 2 passed: localhost and 127.0.0.1 |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Actual persistent seed / repeat command | Initial counts above; second run zero inserts, totals unchanged |
| Actual persistent database browser login/dashboard/history | Passed; 48 reports, 9 tankers, 12 allocations, 9 deliveries |
| Live Gemini inference | Not run; no live claim |

The unit fixtures verify increasing Panchavati and decreasing Indira Nagar submissions over adjacent scenario-hour windows, without calling this a forecast. MongoDB checks verify idempotence/reconnect, exact preservation of source and operational records, registration without manufactured reports, submission accumulation/provenance, citizen ownership, public location protection, operator authorization, recipient demo OTP/replay rejection, tanker balance updates, audits, dashboard/status integration, all-role provider-shaped validation and explicit outage fallback. Existing suites preserve expiration, attempts, concurrency, recovery, location consent, capacity/fairness and security regressions.

Desktop/mobile tests follow actual React forms, HTTP APIs and MongoDB: review/reject, request recommendation, approval, assignment, operator sign-in, start/arrival, demo OTP, completion/accounting and seed preservation; new registration/report persists after refresh/re-login. Screenshots were visually inspected. Street map tiles remain an external dependency; stored coordinate/offline views are preserved. Full existing Phase 1–7 tests pass.

The standalone persistent-database check initially had a browser cleanup failure that exposed its temporary demo session token in tool output. That session was revoked; cleanup now waits for requests, logs sanitized failures and signs out normally. The corrected check passed. No Gemini API key or account password was logged.

Private generated artifacts are under ignored `.local`: the demo credential file, QA screenshots, test logs and a local read-only verification helper. They are not committed documentation or production credentials. No real `.env` edit, report/operational deletion/reset, automatic commit/push, live inference, provider change, AWS deployment or Phase 8 implementation was performed.

### Complete tracked/new source file inventory

The following files changed for this task (repository-relative paths):
- .env.example
- apps/api/package.json
- apps/api/src/app.js
- apps/api/src/config/database.js
- apps/api/src/config/demonstration.js
- apps/api/src/config/env.js
- apps/api/src/controllers/reportController.js
- apps/api/src/demo/agentEvidence.js
- apps/api/src/demo/credentials.js
- apps/api/src/demo/persistentSeed.js
- apps/api/src/demo/scenario.js
- apps/api/src/demo/seed.js
- apps/api/src/demo/seedReports.js
- apps/api/src/models/Allocation.js
- apps/api/src/models/Area.js
- apps/api/src/models/Delivery.js
- apps/api/src/models/DemoSeedState.js
- apps/api/src/models/Report.js
- apps/api/src/models/User.js
- apps/api/src/routes/ai.js
- apps/api/src/routes/auth.js
- apps/api/src/routes/dashboard.js
- apps/api/src/routes/deliveries.js
- apps/api/src/routes/index.js
- apps/api/src/routes/operations.js
- apps/api/src/routes/shortages.js
- apps/api/src/scripts/testLiveAi.js
- apps/api/src/services/authService.js
- apps/api/src/services/deliveryService.js
- apps/api/src/services/reportService.js
- apps/api/src/services/shortageService.js
- apps/api/src/validation/report.js
- apps/api/test/demo.mongo.test.js
- apps/api/test/demo.test.js
- apps/web/src/components/CitizenDeliveryVerification.jsx
- apps/web/src/components/EnvironmentProvider.jsx
- apps/web/src/components/Layout.jsx
- apps/web/src/lib/environment.js
- apps/web/src/main.jsx
- apps/web/src/pages/AnalyticsPage.jsx
- apps/web/src/pages/DeliveriesPage.jsx
- apps/web/src/pages/OperationsPage.jsx
- apps/web/src/pages/ReportPage.jsx
- apps/web/src/pages/ReportReviewPage.jsx
- apps/web/src/pages/ShortagesPage.jsx
- apps/web/src/pages/ShortageStatusPage.jsx
- AQUASHIELD_SPEC.md
- docs/demo-guide.md
- docs/demo.md
- docs/phase7.md
- package.json
- packages/shared/reportOptions.js
- README.md
- tests/e2e/persistent-demo.spec.js
- apps/web/src/pages/ReportHistoryPage.jsx
- docs/ai-reliability.md
- docs/through-phase7-audit.md

Fleet seed identity also uses remembered MongoDB IDs in the private seed-state manifest. Municipal identifier/name edits therefore remain intact on rerun; the MongoDB regression test performs a real admin rename and compares every source/operational record after reseeding. Manifest metadata is added without rewriting fleet state.

Additional corrected source file: `apps/web/src/pages/ReportHistoryPage.jsx`. In trusted demonstration mode history remains citizen-authenticated even with `?demo=true` and shows only owned records; public preview/toggle links are hidden. The legacy preview outside trusted mode still excludes owned records. The dashboard no longer displays the legacy fixed five-area observation-date claim; it identifies persisted simulated inputs without inventing an observation date.


## Phase 8 numerical early warning

Open `/admin/predictions` as ADMIN and select **Evaluate current evidence**. This calculates and persists report-activity forecasts/alerts without Gemini or Strands. The existing 48-report faculty scenario intentionally lacks complete multi-day history: expect `INSUFFICIENT_DATA`, not an invented forecast. No timestamps or existing data are rewritten. Supported-forecast/alert demonstrations use explicit disposable synthetic browser fixtures: `npx playwright test tests/e2e/phase8.spec.js`. This is implementation verification, not real forecast accuracy. See [Phase 8 formulas, APIs, uncertainty and verification](phase8.md). Optional Early Warning explanation now consumes completed, current results when available; this does not alter the historical mocked/live verification table above.

## Phase 12 concise presentation run sheet

1. Start with the session flags above and npm run dev; privately obtain the already provisioned account credentials from .local/demo-credentials.json. Keep credentials and OTPs off recordings.
2. Citizen: /citizen/login → /report. Explain explicit location consent/manual locality selection, household size and optional photo. Submit once, follow Track this report, and show /my-reports after refresh. A lost response preserves the submission identity for a safe retry.
3. Administrator: /login → /admin. Compare Panchavati with other areas. Explain operational severity, confidence that a shortage exists, approximate population, and verified versus pending evidence. Follow Review evidence to /admin/reports; missing/old evidence remains visible as such.
4. Review /admin/tankers and /admin/allocations. Request a recommendation, inspect fairness and exclusions, then explicitly Approve allocation and Assign approved tanker. If no eligible current tanker/evidence exists, explain the restriction; use existing municipal forms to record honest simulated observations, without resets or forced approvals.
5. Sign in as the linked operator at /login?returnTo=/operator. Start trip → Mark arrived → Generate demo OTP → Verify delivery OTP → enter a permitted simulated quantity → Complete delivery. Next-step text follows the saved trip state. On a network/action error, Refresh saved trip reads the saved state before another action; it does not replay the operation. Route distance/ETA are estimates, not live GPS/traffic.
6. Administrator: /admin/deliveries, /admin/tankers, /admin/analytics and /admin/audit show persisted quantities, balances and history. Citizen: /my-reports → individual status shows the permitted area response; this is not proof of delivery to every household.
7. Administrator: /admin/predictions → Evaluate current evidence. Forecast target is approximate report activity over the displayed horizon, not physical water depletion. Inadequate history returns INSUFFICIENT_DATA. For a supported synthetic forecast, run npm run test:e2e -- tests/e2e/phase8.spec.js in the separate disposable test environment.
8. Controlled Gemini outage demonstration: npm run test:e2e -- tests/e2e/phase5.spec.js --grep "rule-based outage states". This injects HTTP 503 failures into the existing four-role test fixture, validates RULE_BASED/INSUFFICIENT_DATA labels and preserves human approval. It uses isolated test records, no real API key and no live Gemini requests. This proves tested fallback behavior, not live-provider availability. Review .local/qa/phase5-* screenshots generated by that test.
9. Stop npm run dev with Ctrl+C. Restart with the same flags to inspect persisted data. Do not advance clocks, reset records or reseed between presentations.

Presentation preparation: use browser zoom 100%, check desktop and mobile navigation, and verify source timestamps before describing data as current. Street-map tiles may require network access; stored coordinates and the schematic remain usable. The full offline verification command is npm run verify. It includes unit/API, MongoDB, lint, build, secret/config checks, desktop/mobile browser flows and both development origins, without live Gemini inference.
