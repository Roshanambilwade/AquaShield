# Phase 13 — safe dynamic municipal simulation

This is a bounded, local, synthetic demonstration using the existing application services. It is separate from the persistent faculty demonstration and from ordinary records. No live Gemini, external messaging, AWS deployment, live GPS or physical delivery is implied.

## Safe preparation

Use a **new PowerShell session**, Node 22.13+, the installed dependencies and a development MongoDB server. Stop your previous local development session with Ctrl+C before reusing its ports. Do not change the root `.env` or `.local/demo-credentials.json`. Do not run `seed:demo` or `seed:forecast-demo` for this scenario. These commands override configuration only in this shell:

```powershell
$env:NODE_ENV='development'
$env:DEMONSTRATION_MODE='true'
$env:DEMO_AI_MODE='true'
$env:FORECAST_DEMO_ENABLED='true'
$env:DEMO_SEED_ENABLED='false'
$env:SIMULATION_ENABLED='true'
$env:SIMULATION_DATABASE_NAME='aquashield_simulation'
$env:MONGODB_URI='mongodb://127.0.0.1:27017/aquashield_simulation'
$env:SIMULATION_TICK_INTERVAL_MS='15000'
$env:SIMULATION_PREPARE_ENABLED='true'
npm run simulation:prepare
$env:SIMULATION_PREPARE_ENABLED='false'
npm run dev
```

The example assumes a local development MongoDB service without authentication. If your development server requires credentials, supply its existing connection through a private environment variable, explicitly naming the same isolated simulation database. Never use a production or faculty URI. Both the URI database and selected database must match. The name must be `aquashield_simulation` or a lowercase alphanumeric suffix separated by underscores, distinct from `DEMO_DATABASE_NAME`. Production rejects simulation configuration. Automated tests additionally require a newly generated `aquashield_simulation_test_<32-hex-UUID>` name.

Preparation creates a persistent run marker, 75 fictional accounts (one ADMIN, two OPERATORs, 72 CITIZENs), six service areas and two labeled synthetic tankers. It does not create approvals, assignments, deliveries or reports. Preparation requires its explicit flag, refuses unmarked existing data, and preserves a completed preparation on repeat. It never deletes or resets records. An interrupted preparation may be resumed with the same target and credential file.

Credentials are generated once in the ignored `.local/simulation-credentials-aquashield_simulation.json` file (the configured database name forms the filename). Open that file privately to find the administrator, operators and household accounts. Never share it, print it into logs, commit it or substitute faculty credentials. Existing faculty credentials are not reused or overwritten. Close this shell when finished; use a fresh shell for ordinary/faculty startup so these overrides do not carry over.

Sign in through the municipal login page, then open `/admin/simulation` or the **Simulation** municipal navigation item. That item appears only when the backend explicitly reports simulation mode. The global badge says **Demonstration Environment · dynamic simulation**. The API and controls remain ADMIN-only regardless of navigation visibility.

## Controls and evidence

- **Start**: from READY, schedule the first tick after the configured interval.
- **Pause**: wait for an already claimed tick to finish, then cancel further scheduled ticks. It does not roll back saved evidence.
- **Resume**: explicitly schedule further work from PAUSED. Backend restart never resumes automatically.
- **Advance one tick**: run the next tick from READY, PAUSED or FAILED; successful manual steps remain PAUSED.
- **Stop**: wait for a claimed tick, stop scheduling and retain all records. STOPPED is terminal; there is no reset or resume button for a stopped run.
- **Speed**: 1×, 2× or 3×; real intervals are the configured 5–60 seconds divided by speed, with a minimum five seconds. There is one backend timer, never a browser write loop.
- **Refresh**: retrieve saved data only. While running, the visible page polls every five seconds; hidden pages stop polling.

The single deterministic `municipal-v1` scenario has at most 24 ticks, three new households per tick and 72 reports. Each tick advances 15 virtual minutes, with an initial anchor six hours before preparation. Real creation, audit, authentication, OTP, fleet freshness and operational times remain separate. The scenario stops automatically at its limit. Command history is capped at 250 control actions; the final permitted control safely stops the run with SIMULATION_LIMIT.

Early ticks concentrate reports in Panchavati. Later ticks introduce the other existing supported areas with varied household sizes, problem types, shortage durations and reported levels, including UNKNOWN. Stable submission IDs depend on run, tick and household. Reports enter through existing validation/submission services as PENDING. Clustering, severity, confidence and approximate population come from existing backend calculations; simulation never sets the final scores or claims physical verification.

Simulation-created records carry `simulation.source=DYNAMIC_SIMULATION`, run ID, tick and virtual event time. Reports display both virtual event time and real receipt time. The run's append-only journal records real control/completion times, actors where applicable and virtual tick references. Existing operational audit history remains available through **Audit history**. The run journal is shown separately in the workspace timeline.

At tick four, the existing explicit synthetic forecast fixture introduces separately labeled retrospective observations. Numerical prediction runs use `SYNTHETIC_FORECAST`; these observations never become citizen reports, verification evidence or ordinary forecasts. Before sufficient source-specific history exists, the numerical service returns INSUFFICIENT_DATA. These are deterministic report-activity forecasts, not measured physical water depletion. No Gemini call is required. The workspace shows source-separated completed calculations, uncertainty/detail links and actual stored classifications rather than fixed UI output.

## Manual municipal and citizen journey

1. Step through six ticks. Inspect new pending reports, derived shortages and approximate population. Use **Review reports** to perform the existing authenticated submitted-evidence review. Reviewing a synthetic report does not establish a real-world shortage.
2. Use **Review fairness and allocate**. Eligibility uses existing freshness, capacity, available litres, assigned operator, reservations and active-trip rules. Enter supported, explicitly simulated demand/delivery evidence through the existing form where needed. Recommendation, approval and assignment are separate ADMIN actions. The simulator performs none of them.
3. Sign in as the assigned synthetic OPERATOR. Open **Your assignments**, start the trip and mark arrival. Use the existing protected demonstration OTP procedure, record actual simulated delivered litres and complete delivery. All ownership, OTP expiry/replay, quantity and exactly-once accounting protections apply. Route/ETA outputs retain their existing estimate labels; no GPS or physical receipt is verified.
4. Sign back in as ADMIN. Inspect saved delivery litres, tanker balance, analytics and audit history. Initial tanker observations age according to **real** time; if they become stale, enter a new explicitly simulated observation through the existing guarded fleet workflow. Ticks do not secretly refresh them.
5. In **Citizen advisories**, explicitly publish a supported, clearly labeled simulated area advisory. Numerical alerts do not automatically publish messages. As a synthetic CITIZEN, choose the corresponding service area in **My Alerts**, inspect relevant advisories, mark one read and reload. **My Reports** shows only that household's reports and permitted response updates. No SMS or push is sent.

The workspace links to these existing screens and displays saved results. It does not implement parallel allocation or delivery APIs. AI assessments retain the existing labeled demo/rule-based/live provenance; enabling this engine never triggers agent requests.

## Failure, restart and isolation

A tick claims the persistent run before writing and commits its clock only after derived work completes. Concurrent claims are rejected. Already committed tick retries are read-only successes. Partial tick failure retains its evidence and original attempt timestamp; refresh saved state and retry the **same next tick** with Advance one tick. FAILED already stops scheduling, so no additional Pause command is needed. Stable IDs and existing upserts prevent duplicated reports, forecast observations and completed journals. Do not reseed to recover. If storage fails before a scheduled claim, scheduling stops; FAILED is persisted once storage recovers. There are no repeated background retries.

Restarting a backend with a RUNNING, FAILED or in-flight run records RESTART_PAUSED and leaves it PAUSED. Inspect saved evidence and explicitly retry the pending tick before resuming when recovering partial work. Stopped runs remain stopped. To demonstrate a new independent run, deliberately choose a **new isolated database name and matching URI**, then prepare it; the old run is retained. There is no automatic database removal.

Startup validates the name/URI/connected target and checks every existing collection against the run's provenance before application writes. An unmarked populated target is refused and preserved. Simulation configuration is disabled by default and forbidden in production. Existing role/security middleware protects all normal operations. The faculty database is neither selected nor read for scenario preparation.

This scheduler supports **one backend instance per simulation database**. It does not claim a distributed lease, leader election or multi-instance restart coordination. Do not run multiple simulation backends against one target. A tick consists of recoverable idempotent writes rather than one cross-collection transaction, so partial evidence may be visible before its clock commits. The scenario uses two initial tankers and a finite retrospective forecast fixture; it is not a continuous physical water model or production load simulator. Historical screenshots and actual verification results are in [the acceptance report](dynamic-simulation-acceptance-report.md).

## Offline verification

```powershell
npm run test:simulation
npm run test:e2e -- tests/e2e/simulation.spec.js
npm run verify
npm run test:acceptance-journey
```

All test preparation/cleanup is confined to newly named owned UUID databases. Tests make no live Gemini inference requests. The ordinary root environment is not replaced by the simulation startup instructions.
