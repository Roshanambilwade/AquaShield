# Pre-simulation acceptance remediation

**11 October 2026.** Starting commit: `5cb9a45`, branch `main`. This report supersedes the current-status conclusions of the preserved [acceptance audit](pre-simulation-acceptance-report.md), without changing that historical document.

The missing manual report review and personalized citizen inbox are implemented. A guarded administrator action can record a new simulated present-time tanker observation. A separate opt-in synthetic forecast fixture now demonstrates the original numerical engine across all six faculty areas. **The faculty fleet still requires an explicit suitable tanker assessment; zero eligible faculty tankers were observed in the read-only readiness check.** Passing local tests does not establish live Gemini availability, production readiness, predictive accuracy or physical delivery.

## Acceptance issues and limits

| Original issue / acceptance boundary                                           | Status                                     | Evidence and remaining condition                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing manual ADMIN verify/reject                                             | PASS                                       | Protected UI/API; conditional PENDING transition, required note, atomic actor/time/correlation audit and authoritative derived refresh.                                |
| Missing personalized citizen notifications                                     | PASS                                       | Persisted explicit area preference, backend-filtered local/municipal inbox, stable publication identity, expiry/withdrawal/history, individual persisted read state.   |
| Stale fleet has no safe freshness workflow                                     | PASS for workflow                          | New explicit observation preserves prior evidence; an isolated browser/API/Mongo scenario obtains a valid allocation candidate. Freshness/eligibility rules unchanged. |
| Faculty fleet immediately eligible                                             | FAIL until manual preparation              | Read-only faculty snapshot: nine tankers, zero eligible, nine active operators. No faculty tanker was automatically refreshed/refilled. Follow the manual steps below. |
| Insufficient faculty report history                                            | PASS for honest behavior                   | Ordinary history still returns `INSUFFICIENT_DATA` for every area. Existing reports/timestamps are preserved.                                                          |
| Supported Phase 8 demonstration                                                | PASS for synthetic implementation behavior | Separate 190-observation fixture, six persisted predictions and four alerts, all twelve windows covered; existing formulas/thresholds and source separation retained.  |
| Read-only readiness                                                            | PASS                                       | Guarded command returns report sources, operators, eligibility/reasons/timestamps, reservations/trips, both histories and persisted counts without mutations.          |
| README/spec/proxy/static-clock drift                                           | PASS                                       | Phases 1–12 status, historical stop instruction, preview proxy behavior and actual wall-clock/static-history limits reconciled. All twelve overrides retained.         |
| Phase 1–12 offline regression                                                  | PASS                                       | Full eight-stage runner exited zero: 197 unit/API, 122 MongoDB, 122 desktop/mobile and two development-origin tests; lint/build/config/security passed.                |
| Live Gemini, physical delivery/household receipt, real forecast accuracy       | NOT VERIFIED                               | No inference, field visit, external measurement or accuracy validation performed.                                                                                      |
| Docker runtime, backup restoration, AWS/public deployment and production scale | NOT VERIFIED                               | Engine/tooling limits and unexecuted production gates described below.                                                                                                 |

## Manual submitted-evidence review

ADMIN may `POST /api/dashboard/reports/:id/review` with `{ "status": "VERIFIED" | "REJECTED", "note": "..." }`. Notes are required for both decisions (5–500 characters). Ordinary report creation remains unable to set verification fields. The backend enforces ADMIN authorization before parsing review input; CITIZEN/OPERATOR cannot review reports.

The update compares the persisted dataset and `verificationStatus: PENDING`. Only one competing transition succeeds. Missing/wrong-dataset IDs return 404; repeated/terminal transitions return 409. The private review service is the only sanctioned update of the immutable verification field. It atomically records reviewedBy, reviewedAt, reviewNote, provenance and a REPORT_VERIFIED/REPORT_REJECTED journal with actor, server timestamp, before/after status, reason and correlation ID. Rejected documents/history remain stored.

The existing shortage detection service recomputes derived assessments after success. If derived refresh fails, the saved review remains authoritative and the response says `PENDING_RETRY`; it does not discard the review. Admin detail shows review history. The owner sees safe status/time/provenance without private reviewer IDs, notes or audit entries.

**This verifies submitted evidence only.** Simulated reviews use `SIMULATED_ADMIN_EVIDENCE_REVIEW`; ordinary reviews use `ADMIN_SUBMITTED_EVIDENCE_REVIEW`. Neither establishes identity, residency, a physical inspection, shortage resolution or delivery to each household. Existing simulated seed verification remains separately described. Delivery completion does not verify every report.

## Personalized citizen advisories

| API                                                               | Authorized role / behavior                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/citizen/alerts/area`                                    | CITIZEN: selected area and safe available-area catalog.                                                      |
| `PUT /api/citizen/alerts/area` with `{areaId}` or `{areaId:null}` | CITIZEN: explicit validated saved preference; no inferred home location/geolocation.                         |
| `GET /api/citizen/alerts?page=1&limit=20&history=false`           | CITIZEN: matching selected area plus authorized MUNICIPAL audience; active unread count and bounded history. |
| `PUT /api/citizen/alerts/:id/read` with `{read:true/false}`       | CITIZEN: only an advisory relevant to this user; unrelated area returns 404.                                 |
| `GET /api/advisories/areas` / `GET /api/advisories`               | ADMIN: publication catalog and bounded municipal history.                                                    |
| `POST /api/advisories`                                            | ADMIN: validated source, fixed safe wording, area/audience and expiry.                                       |
| `POST /api/advisories/:id/withdraw` with `{revision}`             | ADMIN: conditional withdrawal, revision increment and atomic audit.                                          |

Municipal endpoints support the existing guarded demo dataset selector. Citizen dataset choice is server-controlled. Publication accepts a current manually reviewed report, accepted completed delivery, or current supported ordinary-history HIGH/CRITICAL numerical assessment. Unverified report claims, arbitrary message fields and synthetic-forecast publication are rejected. A nonproduction trusted demonstration can explicitly publish a `SIMULATED` / `DEMONSTRATION` notice using a stable scenario key.

The stable identity includes dataset, audience, area, category, source type and source ID. ObjectId casing is canonicalized; concurrent repeats produce one document. Repeating publication does not extend expiry or resurrect withdrawn notices. Expiry is derived from saved server time and retains history. Reads are keyed uniquely by citizen plus advisory; reading never changes global advisory status, prediction lifecycle or shortage resolution. Changing area immediately changes server-authorized visibility. A municipal notice retains its actual affected-area name even when its audience is broader.

Safe citizen projections exclude source IDs, household identity, private description/photo/coordinates, staff IDs, review notes and internal audit. ADMIN prediction APIs remain ADMIN-only. No SMS, email or paid messaging dependency was added. `/my-alerts` includes loading, empty, error, pagination, active unread count and read/unread actions; `/admin/advisories` provides explicit publish/withdraw controls. Expiry/withdrawal/history, separate-user state, unrelated-area access, repeated login and actual backend restart are tested.

## Safe present-time simulated tanker observation

`POST /api/operations/tankers/:id/observation` is ADMIN-only and accepts current revision, availableLitres, idle operational status, optional valid location, assessment note and `confirmSimulated:true`. It requires a connected, verified nonproduction demo/test database under existing safety rules. Server-generated current time is mandatory: client timestamps/extra fields are rejected. Capacity is not editable here; litres cannot exceed recorded capacity. AVAILABLE requires an active linked operator.

Reservations, noncompleted deliveries and busy allocation states block observation. Existing future-dated observations and concurrent stale revisions are rejected. Prior timestamp, litres, status and location are retained in the observation history with actor, assessment and `SIMULATED_PRESENT_TIME_OBSERVATION` provenance. TANKER_OBSERVED is recorded atomically. No old timestamp is falsified. Existing tanker-edit CAS was also restricted to idle AVAILABLE/UNAVAILABLE states to prevent edits of active legacy EN_ROUTE/ARRIVED tankers.

The fleet UI now distinguishes operational status from actual allocation eligibility and displays reasons. No automatic bulk inspection/refill or forced allocation exists. Tests verify stale rejection, fresh candidate eligibility, unsafe trip/reservation guards, quantity bounds, authorization, client timestamp rejection and concurrent updates. Existing eligibility suites retain inactive-operator coverage.

## Forecast fixture and actual persisted results

`npm run seed:forecast-demo` requires **DEMO_SEED_ENABLED=true**, **FORECAST_DEMO_ENABLED=true**, **DEMONSTRATION_MODE=true**, nonproduction mode, the configured safe demo database name, and a matching connected database. Existing guarded UUID test databases are allowed for automated verification. Unsafe/mismatched targets abort before writes. No startup hook calls this command.

Observations live in the dedicated ForecastObservation collection. They are neither Report documents nor user accounts. Stable insert-only identifiers include the completed UTC cutoff, area, window and ordinal. Inserts preserve existing timestamps/documents; repeats insert zero. Preflight checks the generated history through the unchanged engine before writes. Reusing a cutoff with incompatible existing fixture settings aborts rather than mixing/changing that batch. New cutoffs retain old batches; retrieval chooses one latest completed batch with the existing bounded input limit.

Default unchanged gates: **twelve complete six-hour UTC windows**, positive eligible evidence in each, **at least eighteen observations and six distinct reporter keys**, twelve-hour freshness, existing invalid-record filters and bounds. All six prepared areas cover **12/12** windows. Synthetic keys identify fictional observation sources, not verified people. The adapter supplies unverified/PENDING inputs; **zero synthetic observations claim VERIFIED field evidence**.

The actual faculty preparation inserted **190** records; repeat inserted **0**. The authenticated ADMIN evaluation used `POST /api/predictions/evaluate?source=SYNTHETIC_FORECAST`, persisted **six predictions and four HIGH/CRITICAL alerts**, and made **zero provider calls**. A repeated identical evaluation preserved full prediction/alert records, including timestamps/audits. Evaluation is an explicit action; GET/page refresh does not generate alerts.

Observed faculty window: **8 October 2026 00:00 UTC → 11 October 2026 00:00 UTC**; forecast horizon **six hours**. These numbers are calculated by the existing engine, not inserted desired outputs:

| Area                                     | Synthetic observations / reporter keys | Covered windows | Risk index / class | Approximate next-window eligible reporting activity | Persisted elevated alert |
| ---------------------------------------- | -------------------------------------: | --------------: | ------------------ | --------------------------------------------------: | ------------------------ |
| Panchavati / AREA_01                     |                                40 / 40 |           12/12 | 85 / CRITICAL      |                                                   4 | Yes                      |
| Satpur / AREA_02                         |                                32 / 32 |           12/12 | 81.88 / CRITICAL   |                                                3.88 | Yes                      |
| Indira Nagar / AREA_03                   |                                24 / 24 |           12/12 | 0 / LOW            |                                                   2 | No                       |
| Nashik Road / AREA_04                    |                                28 / 28 |           12/12 | 58.44 / HIGH       |                                                2.94 | Yes                      |
| Adgaon / AREA_05                         |                                36 / 36 |           12/12 | 85 / CRITICAL      |                                                   4 | Yes                      |
| Demonstration East Sector / DEMO_AREA_06 |                                30 / 30 |           12/12 | 5.62 / LOW         |                                                2.05 | No                       |

**These are uncalibrated report-activity indices/estimates over synthetic observations, not physical water depletion, operational severity, genuine shortage probability or demonstrated accuracy.** Uncertainty remains HIGH for unverified synthetic inputs. Operational severity/confidence on this source are Unknown. Supported results become stale with the wall clock; no virtual clock or continuous preparation exists.

Ordinary history still passes through Report-only extraction and remains insufficient in all six faculty areas. Synthetic history is selected explicitly (`source=SYNTHETIC_FORECAST`); default `REPORT_HISTORY` queries include existing legacy records and exclude synthetic results. The source flag is immutable; a hydration regression for missing legacy source fields was fixed without updating historical documents. API results and UI label synthetic provenance. Source-separated prediction/alert keys prevent overwriting operational results. Synthetic results do not feed operational risk KPIs, allocation candidates, authoritative AI evidence or citizen publication. Invalid/insufficient fixture evidence continues to return `INSUFFICIENT_DATA`.

**Unchanged:** `predictionEngine.js`, prediction thresholds/configuration, severity/confidence/fairness engines, OTP security and delivery state machine, Phase 10 metric definitions. Analytics only adds an explicit synthetic-alert exclusion. No fake operational reports, users, login credentials or historical inspections were created.

## Verification evidence

Final full-run result: **PASS, exit 0 for all eight stages**. Logs remain ignored under `.local`; the completed full-run log is `.local/remediation-verify-final.log`, focused regression log `.local/remediation-targeted-final.log`, and ordered journey log `.local/remediation-journey.log`.

| Command / check                                                         | Result                                                                                                                                 |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                                        | PASS: 197 unit/API + 122 MongoDB + 122 desktop/mobile + two development-origin tests; no failures/skips; all eight stages exit zero.   |
| Runner lint / production frontend build / configuration parsing         | PASS. Production/public connectivity is not implied by the isolated configuration check.                                               |
| Final `npm run security:check` / `git diff --check`                     | PASS: 272 source files, zero heuristic secret findings; no whitespace errors. All twelve override rules compare unchanged with HEAD.   |
| `npm run test:acceptance -w @aquashield/api`                            | PASS: **20 tests**, zero failures/cancellations/skips; real local MongoDB with an owned UUID database.                                 |
| Targeted `npx playwright test tests/e2e/acceptance-remediation.spec.js` | PASS: **6 tests**, three scenarios on desktop and mobile.                                                                              |
| `npm run test:acceptance-journey`                                       | PASS: **11 ordered checks**, three actual backend process restarts, isolated browser/API/Mongo data; no seed reports or live provider. |
| `npm run lint` after final journey correction                           | PASS.                                                                                                                                  |
| Faculty fixture prepare / repeated prepare                              | PASS: 190 inserts / zero inserts, all six unchanged quality gates supported.                                                           |
| Authenticated faculty source evaluation / repeated evaluation           | PASS: six predictions/four alerts; repeat preserves records; default ordinary source unaffected; zero provider calls.                  |
| Native faculty before/after fingerprints                                | PASS: nine existing operational collections unchanged; only intended prediction/alert additions among the original eleven collections. |
| Docker Compose template                                                 | PASS: `docker compose --env-file .env.example config --quiet`.                                                                         |
| Docker engine/runtime                                                   | NOT VERIFIED: confirmed engine pipe unavailable outside sandbox; no current image/runtime success claimed.                             |
| Backup restore                                                          | NOT VERIFIED: `mongodump` and `mongorestore` were not installed/available; no restoration performed.                                   |

The full verification runner uses isolated test configuration, blanks model credentials and disables inherited ordinary seed/provider/routing behavior. It preserves existing tests and includes the new unit, Mongo and desktop/mobile cases. Sandbox loopback EACCES and OneDrive build EPERM initially required approved local-service/build execution. Intermediate genuine failures were fixed: an insufficient test allocation zone, an accessible form-label mismatch, generated multiline test-helper syntax, and legacy immutable source hydration. The ordered harness also needed to await completed role navigation after login before issuing its next hard navigation; this was a test race, not evidence of broken application session persistence. Failed runs are not counted as passing runs.

The successful ordered journey is **citizen browser registration/report → ADMIN submitted-evidence review → fresh explicit simulated tanker observation → recommendation → separate approval → assignment → owned operator start → restart → arrival → demo OTP verification → accepted 3,000 L completion → restart → history/analytics/audit → validated delivery advisory → citizen area/read state → third restart/re-login → synthetic forecast evaluation**. Mongo confirms one delivery/completion journal for that delivery target, exact **5,000 L** balance from 8,000 L, retained report ownership and safe area response. Wrong-role approval/unapproved assignment/other-operator access/repeated completion are rejected. No physical delivery claim is made.

This continuous journey ran at desktop size with screenshot/overflow checks at desktop and mobile for key pages. Separate scenario tests run both viewports; the continuous journey is not claimed to have been independently repeated entirely at mobile size. Successful mobile citizen-inbox and desktop synthetic-forecast screenshots were visually inspected. Local screenshots/logs contain only synthetic test actors and are not committed.

## Existing data preservation

Native faculty snapshots before preparation and after evaluation compared the original eleven collections. **users, areas, reports, shortageevents, tankers, allocationevidences, allocations, deliveries and demoseedstates remained byte-fingerprint equivalent.** Only predictions and earlywarningalerts changed through the intended source-separated additions. The new synthetic collection contains 190 observations. Normal admin authentication created and revoked a temporary session; credentials and accounts were not regenerated.

No ordinary/faculty reset, drop, delete, bulk overwrite, report timestamp refresh, fleet mutation, allocation, trip or OTP change was performed. Test cleanup targets only each owned disposable UUID database. The real `.env` and private credential files were not modified/printed. The original untracked acceptance report remains untouched. No files outside the repository were modified, and no stage/commit/push was performed.

## Exact faculty preparation steps

Keep the already provisioned faculty database and private credentials. From the repository root, in PowerShell, use process-only flags rather than overwriting `.env`:

```powershell
$env:NODE_ENV='development'
$env:DEMONSTRATION_MODE='true'
$env:DEMO_DATABASE_NAME='aquashield_demo'
$env:DEMO_AI_MODE='true'
$env:FORECAST_DEMO_ENABLED='true'
$env:DEMO_SEED_ENABLED='false'
npm run demo:readiness
$env:DEMO_SEED_ENABLED='true'
npm run seed:forecast-demo
$env:DEMO_SEED_ENABLED='false'
npm run demo:readiness
npm run dev
```

Use the configured safe faculty database name if it differs from this existing `aquashield_demo` target; the connected-target guard must match. Do not run `seed:demo` or reset the database to obtain these capabilities. The forecast source flag must remain enabled in the backend runtime; production rejects it. The command only prepares a new immutable batch when the completed cutoff changes.

1. Sign in with the existing ADMIN account. Open Tankers and inspect actual eligibility reasons and reservations/trips. Select a suitable idle, unreserved simulated tanker linked to an active operator. Explicitly assess litres/state, expand **Record simulated present-time observation**, write the assessment, check the authorization box and save. Check that eligibility now passes. If no tanker is suitable, leave its state unchanged and investigate the displayed blocker.
2. At Citizen reports, open a PENDING report, inspect available evidence, enter the required note and explicitly verify or reject. These are submitted-evidence decisions, not field visits. Terminal decisions cannot be casually reversed.
3. Use the existing allocation evidence/recommendation workflow with sufficiently current evidence. Approve and assign as separate ADMIN actions; no forced allocation is provided.
4. Use the linked OPERATOR account for trip progression and authorized demo OTP/quantity completion. A real operational recipient handoff remains separate; no external messaging or verified physical quantity is implied.
5. At Citizen advisories, select the affected service area and audience. Publish validated current reviewed-report/delivery/ordinary-forecast evidence, or explicitly choose a simulated advisory scenario with a stable key. Never publish synthetic forecasts as real emergencies. Withdraw explicitly when appropriate.
6. Sign in as CITIZEN, open **My Alerts**, select the service area and mark a relevant advisory read/unread. Refresh/re-login preserves state. This does not resolve the shortage or close a global alert.
7. As ADMIN, open Early warning, select **Prepared synthetic forecast history**, click **Evaluate current evidence**, and review computed results/uncertainty/source labels and persisted alert history. Switch to **Available report history** to demonstrate honest insufficiency. Do not call Gemini to obtain these calculations.
8. Use `npm run demo:readiness` before presentations. When source windows/observations age, prepare/evaluate explicitly again; tanker assessments must remain explicit current actions. No refresh-all control or automatic scheduler exists.

## Provider, deployment and other unverified gates

**Live Gemini: NOT VERIFIED for every role in this remediation.** All real inference requests were prohibited and none were made. The existing Gemini + Strands architecture and fallback remain unchanged. Existing mocked-provider, outage, validation and four-role tests pass only for their offline boundary. Historical successes/failures in earlier reports are historical; they do not guarantee current provider availability.

Docker CLI/Compose are installed, but the checked Linux Docker engine pipe was missing even with approved outside-sandbox execution. The Compose template parses; current image build, health, runtime and container persistence remain NOT VERIFIED. Backup tools were absent, so no disposable dump/restore or production disaster-recovery proof is claimed. AWS/public URLs, Atlas production networking/TLS/roles, production secrets/proxy setup, routing service, independent field receipt, multi-instance/load behavior and current dependency advisory/clean-install scans remain separate unexecuted gates. No AWS or cloud resources were created.

**Dynamic simulation remains unimplemented:** no virtual clock, event generator, scheduler, background seeding/evaluation, Start/Pause/Resume/Stop controls or automatic approval/assignment/verification/delivery completion. The static demo uses saved evidence; fleet and forecast freshness use actual server time.

## Changed files

New files:

- API models: `apps/api/src/models/AdvisoryReadState.js`, `CitizenAdvisory.js`, `ForecastObservation.js`.
- API services: `apps/api/src/services/citizenAlertService.js`, `demoReadinessService.js`, `reportReviewService.js`, `tankerObservationService.js`.
- API fixture/router/scripts: `apps/api/src/demo/forecastFixture.js`, `apps/api/src/routes/citizenAlerts.js`, `apps/api/src/scripts/demoReadiness.js`, `seedForecastDemo.js`.
- Tests: `apps/api/test/acceptanceRemediation.test.js`, `acceptanceRemediation.mongo.test.js`, `tests/e2e/acceptance-remediation.spec.js`, `tests/helpers/acceptanceJourney.js`.
- Frontend: `apps/web/src/components/TankerObservation.jsx`, `apps/web/src/pages/AdvisoriesPage.jsx`, `CitizenAlertsPage.jsx`.
- This report: `docs/pre-simulation-remediation-report.md`.

Modified files, grouped by directory (each abbreviated filename uses the preceding directory):

- Root: `.env.example`, `AQUASHIELD_SPEC.md`, `README.md`, `package.json`.
- `apps/api`: `package.json`; `src/app.js`; `src/config/demonstration.js`, `env.js`; `src/models/EarlyWarningAlert.js`, `Prediction.js`, `Report.js`, `Tanker.js`, `User.js`; `src/routes/dashboard.js`, `operations.js`, `predictions.js`.
- `apps/api/src/services`: `analyticsService.js`, `auditContext.js`, `auditService.js`, `dashboardService.js`, `operationsService.js`, `predictionService.js`, `reportService.js`; `apps/api/src/validation/analytics.js`.
- `apps/web/src`: `App.jsx`, `polish.css`; `components/AdminLayout.jsx`, `Layout.jsx`, `ReportDetails.jsx`; `lib/adminApi.js`, `portalAccess.js`; `pages/OperationsPage.jsx`, `PredictionsPage.jsx`, `ReportReviewPage.jsx`.
- `scripts/testEnvironment.js`.
- Docs: `docs/demo-guide.md`, `phase7.md`, `phase8.md`, `phase9-deployment-readiness.md`, `phase10.md`, `phase11.md`, `phase12.md` (historical phase records point to current remediation status).

The already-existing untracked `docs/pre-simulation-acceptance-report.md` is preserved and is not an implementation change. No dependency or lockfile change was required.
