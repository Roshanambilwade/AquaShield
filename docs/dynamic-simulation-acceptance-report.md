# Phase 13 dynamic simulation — acceptance report

Audit date: **11 October 2026**. Implementation starts from clean committed `fc8289e`. Scope is the supplied Phase 13 safe dynamic simulation request. No commit, push, deployment, live Gemini request, faculty reseed or private configuration edit is part of this work.

## Initial state and preservation

The repository already contained Phases 1–12, authentication/ownership, submitted-evidence review, numerical forecasting, manual allocation, operator OTP delivery, private advisories, analytics/audit and the polished portals. The pre-change `npm run verify` completed with **exit 0**: 197 unit/API tests, 122 MongoDB tests, 128 desktop/mobile browser tests, two development-origin tests, lint, production build, secret check and configuration check.

Before implementation verification, a read-only MongoDB snapshot fingerprinted every document in every faculty collection, with collections and documents sorted consistently. It also fingerprinted `.env` and `.local/demo-credentials.json`. The ignored before evidence file contains only counts and digests; no document contents or credential values are published here. After the final verification, `node .local/phase13-preservation.mjs --after` completed with **exit 0**, reporting `facultyDatabaseUnchanged=true`, **13 collections**, and `privateFilesUnchanged=true`. All collection names, counts and complete sorted-document digests matched the baseline; both private files matched byte-content fingerprints. This comparison performed no database writes. No faculty credential, report, allocation, delivery, tanker balance, observation timestamp or audit journal was refreshed by this task.

## Implementation decisions

The simulation uses its own explicitly named development database. Both the URI and selected database must match; production, faculty/ordinary names, mismatched overrides and populated unmarked targets are refused. Existing collections must belong to the saved run. Preparation is explicit, insert-only and repeatable; completed preparation preserves existing operator/admin actions and credentials. Test cleanup only drops freshly generated, owned UUID databases.

One persistent `municipal-v1` run controls a maximum 24 ticks, 72 household reports, six areas, two initial tankers, 75 synthetic accounts and 250 control commands. The initial virtual clock is six hours behind preparation; each tick advances 15 simulated minutes. Real timestamps, fleet freshness, OTP expiry and authentication remain actual operational time. Start/Pause/Resume/Step/Stop and bounded 1×–3× speed are ADMIN-only. The scheduler waits at least five real seconds, prevents overlaps and has no browser-triggered write loop. Restart pauses the run; it never silently resumes. Stop retains records and is terminal.

Tick reports pass existing validation and submission services. Existing clustering/severity/confidence/population calculations derive assessments. Unknown inputs stay unknown and population remains approximate. Forecast observations enter only at tick four through the existing clearly labeled retrospective synthetic fixture. Forecast calculations select SYNTHETIC_FORECAST and never contaminate ordinary report history. Existing numerical formulas, fairness/eligibility, capacity, OTP and delivery accounting logic are unchanged.

Simulation context attaches immutable source/run/tick/virtual-time metadata to new source and operational records, including manual actions, sessions and audit entries. Existing records are not backfilled. The workspace displays real saved data and links to the existing manual workflows. It does not automatically recommend, approve, assign, start trips, verify OTPs, complete deliveries or publish advisories. AI requests are never initiated by ticks or reads.

Ticks are recoverable idempotent writes, not a cross-collection transaction. A failed tick retains partial evidence and its attempt timestamp; retrying its next uncommitted tick recovers without report duplication. Committed tick retries are read-only successes, including after Stop. The completion journal is written once. Safe stage/reason diagnostics contain no raw error messages, evidence, provider responses, URI credentials or secrets. A scheduler storage failure cancels further scheduling and persists FAILED when storage returns.

## Exact changed files

New backend files:

- `apps/api/src/config/simulation.js`
- `apps/api/src/models/SimulationRun.js`
- `apps/api/src/models/simulationProvenance.js`
- `apps/api/src/routes/simulation.js`
- `apps/api/src/scripts/prepareSimulation.js`
- `apps/api/src/services/simulationContext.js`
- `apps/api/src/services/simulationService.js`
- `apps/api/src/simulation/scenario.js`

Backend integration files:

- `apps/api/src/app.js`, `apps/api/src/server.js`, `apps/api/src/routes/index.js`
- `apps/api/src/config/database.js`, `apps/api/src/config/demonstration.js`, `apps/api/src/config/env.js`
- `apps/api/src/services/auditContext.js`, `apps/api/src/services/shortageService.js`
- `apps/api/src/services/reportService.js`, `apps/api/src/services/deliveryService.js`, `apps/api/src/services/citizenAlertService.js` (optional provenance projection)
- `apps/api/src/models/AdminSession.js`, `AdvisoryReadState.js`, `Allocation.js`, `AllocationEvidence.js`, `Area.js`, `CitizenAdvisory.js`, `Delivery.js`, `EarlyWarningAlert.js`, `ForecastObservation.js`, `Prediction.js`, `Report.js`, `ShortageEvent.js`, `Tanker.js`, `User.js` (shared optional provenance hook)
- `apps/api/src/models/auditTrail.js` (optional provenance in existing audit subdocuments)

Frontend files:

- New `apps/web/src/pages/SimulationPage.jsx`
- `apps/web/src/App.jsx`, `apps/web/src/components/AdminLayout.jsx`, `apps/web/src/components/Layout.jsx`
- `apps/web/src/lib/adminApi.js`, `apps/web/src/product.css`

Tests, scripts and documentation:

- New `apps/api/test/simulation.test.js`, `apps/api/test/simulation.mongo.test.js`, `apps/api/test/helpers/simulationRuntime.js`, `tests/e2e/simulation.spec.js`
- `apps/api/package.json`, `package.json`, `scripts/testEnvironment.js`, `.env.example`
- `README.md`, `AQUASHIELD_SPEC.md`, `docs/demo-guide.md`, new `docs/dynamic-simulation.md`, this report

Ignored `.local` utilities/logs/screenshots hold only local verification evidence and separately generated private simulation credentials. No new paid dependency, provider, lockfile change or main-application language conversion was introduced. All 12 top-of-specification override rules are preserved.

## Verification evidence

The final serialized **`npm run verify` completed with exit 0**, passing every stage and **467 tests**: **202 unit/API**, **131 MongoDB integration**, **132 desktop/mobile browser** and **2 development-origin** tests. Lint, production build, secret exposure and configuration parsing passed. All existing assertions remain intact. Actual command history:

| Command/check | Actual outcome |
| --- | --- |
| Baseline `npm run verify` | Exit 0; 197 unit/API, 122 MongoDB, 128 browser, 2 origin tests; all eight stages passed |
| Core environment/API tests | Exit 0; 30 passed after sandbox loopback restrictions required approved execution |
| Initial `npm run test:simulation` | Exit 0; 11 passed, including actual child-process restart |
| Extended focused simulation run | Exit 1; 12/13 passed. A new assertion incorrectly rejected a committed retry; corrected to assert read-only success and reject tick 25 |
| Focused simulation browser run | Exit 0; 4 passed on desktop/mobile after fixing local table overflow and waiting for the existing lazy owned-trip creation |
| First full post-change `npm run verify` | Exit 1; 202 unit/API and 130 MongoDB passed, lint/build/security/configuration passed; browser 130/132 passed. Failures: new tick-four failure and a trace-file write error during existing ADMIN browser teardown |
| Ordered acceptance journey run concurrently with that browser stage | Exit 1; initial registration passed; citizen submission received HTTP 503. Owned UUID cleanup completed |
| Second full post-change `npm run verify` | Exit 1; 202 unit/API and 130 MongoDB passed, lint/build/security/configuration passed; browser 130/132 passed. Both failures were the newly added audit-search assertion: the exclusive end omitted the current minute and the target was not restricted to the trip journal |
| Serialized `npm run test:acceptance-journey` | Exit 0; 11 checks, 3 actual backend process restarts, 3 newly submitted reports, 1 delivery, 3000 recorded simulated litres, 5000 remaining tanker litres, zero provider calls; owned UUID cleanup completed |
| `node .local/phase13-cli-check.mjs` | Exit 0; actual preparation script executed twice in a newly owned UUID database, preserving 75 accounts and 2 tankers; private credential file produced without logging secrets; owned database cleanup completed |
| Final serialized `npm run verify` | Exit 0; 202 unit/API, 131 MongoDB, 132 browser, 2 origin tests; lint, production build, security and configuration passed |
| `node .local/phase13-preservation.mjs --after` | Exit 0; all 13 faculty collections and both private files matched the read-only before fingerprints |
| `git diff --check` | Exit 0; no whitespace errors |

Local command logs: `.local/phase13-baseline.log`, `.local/phase13-focused.log`, `.local/phase13-focused-final.log`, `.local/phase13-browser.log`, `.local/phase13-verify.log`, `.local/phase13-verify-final.log`, `.local/phase13-verify-complete.log`, `.local/phase13-journey.log`, `.local/phase13-journey-final.log`, `.local/phase13-cli.log`, `.local/phase13-preservation-final.log`. The two failed full runs are retained as history; they are not described as passes. Compiler output includes the existing Mongoose `new` option and NO_COLOR/FORCE_COLOR warnings, not verification failures.

The suites are subsequently run separately. No assertion, authentication check, numerical threshold or application deadline is relaxed to obtain a pass. Safe diagnostics distinguish a failed tick's service stage and bounded reason without publishing raw evidence. The first concurrent tick failure's underlying service reason was not captured; it is not represented as a proven formula/provider defect. Its original safe response confirmed SIMULATION_TICK_FAILED. The new browser test waits for the actual command response and verifies HTTP 200 before checking the committed clock. Audit verification searches the current minute within the existing allowed time bound and restricts the target to DELIVERY, asserting exactly one completed trip journal.

Focused coverage includes target/name/URI refusal, disabled mode, anonymous/OPERATOR/CITIZEN restrictions, strict commands, preparation idempotency, partial-report-write recovery, concurrent claim refusal, duplicate prevention, source-specific calculations, zero automatic allocations/deliveries, a real scheduled tick, pause without trailing writes, actual child-process restart without resume, full 24-tick/72-report exhaustion, safe terminal stop on the final permitted control and refusal to adopt an unmarked populated target. Final review corrected the history-budget boundary so a run cannot exhaust its permitted controls while retaining an uncontrollable scheduler. Existing tests continue to cover OTP expiry/replay, ownership, quantity validation, exactly-once completion and numerical provider-outage independence.

The simulation browser journey performs six steps, report review, supported simulated demand/delivery evidence, recommendation, approval and assignment, owned operator start/arrival/demo OTP/400-litre completion, exact tanker debit, analytics/audit inspection, manual advisory publication, citizen owned history and area inbox/read state persisted after reload. It confirms that unauthorized citizens cannot see controls. The earlier existing acceptance journey is separate from this new simulation journey.

## Responsive inspection

The new workspace was exercised at **1440×1000, 768×1024 and 390×844**, with automated page-width checks and manual inspection of saved desktop/tablet/phone screenshots. The municipal design is retained; mobile controls wrap and the table scrolls within its panel. Full-page screenshots:

- `.local/qa/simulation/desktop-1440.png`
- `.local/qa/simulation/desktop-768.png`
- `.local/qa/simulation/desktop-390.png`
- Corresponding `mobile-1440.png`, `mobile-768.png`, `mobile-390.png` from the mobile project

No OTP, password, session token or private credential screen is captured in these workspace screenshots. Operator verification is a controlled synthetic browser test, not proof of physical receipt.

## Known limits and human startup

No failing regression remains in the final serialized verification. The first concurrent-run tick failure was not reproduced in subsequent serialized full runs; its underlying service reason remains unconfirmed, so no stress-test or concurrency-load reliability claim is made. One backend instance per simulation database is supported. Distributed scheduling/leader election, production scalability, stress testing, live Gemini, AWS, Docker, external messages, live GPS and physical deliveries were not verified. Real fleet observations can become stale; refreshing them remains an explicit admin action. Partial evidence may be visible before a failed tick commits. Stopped runs are preserved; a fresh demonstration requires a deliberately new isolated database, not a reset. The finite synthetic activity scenario does not model physical water depletion.

Use the exact PowerShell flags and `npm run simulation:prepare` / `npm run dev` procedure in [the startup guide](dynamic-simulation.md). Use the separate ignored simulation credentials. Faculty startup requires a fresh shell with simulation flags disabled. Do not edit the real `.env`, reuse faculty credentials, rerun faculty seeds or clear databases. No next phase is authorized by this report.
