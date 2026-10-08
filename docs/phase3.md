# Phase 3 — detection, confidence and severity

## Run and inspect

Run `npm run seed:demo` and `npm run dev`. Open `/admin?demo=true` to inspect five simulated zones. Select a geographic marker or zone card, inspect both weighted calculation tables, or open a persistent event detail URL. `/admin` and `/alerts` show real citizen evidence only. `Run detection` recalculates from MongoDB; it accepts no client scores. New report submissions automatically update real shortage events. Citizen report status pages show the matching aggregate without exposing other citizens' reports.

The demo has 63 independent fictional households plus two repeats and one conflicting report: 66 total. Panchavati has 37 eligible households, 31 simulated field checks, long supply interruption, low household water levels, 43°C simulated heat and a simulated incident. Satpur is HIGH; Indira Nagar is MEDIUM; Nashik Road is LOW; Adgaon has only two independent submissions and is EMERGING. These classifications are computed, not seed fields. Changing the underlying water levels, timestamps, household sizes or configured weights changes the output.

## Geographic/time clustering and handling

The Haversine formula calculates distances. Reports are processed in timestamp/ID order. Complete-link clusters require **every** pair to be within `CLUSTER_RADIUS_KM` (1 km) and `CLUSTER_TIME_WINDOW_HOURS` (6 hours). This prevents chain bridging across neighborhoods or days. Real and demo evidence never mix. Locality strings/selected area IDs cannot force distant coordinates into the same cluster.

Repeated keys within `DUPLICATE_RADIUS_KM` (0.1 km) and `DUPLICATE_WINDOW_HOURS` (6 hours) are duplicates, regardless of submission ID or text. Each browser key contributes once per cluster even if it moves within the cluster. Different keys at one approximate locality center remain separate reports, with reduced geographic confidence. Browser keys are **not verified identities** and cannot prevent multi-device fraud.

Supply timestamps disagreeing with stated duration by more than `DURATION_CONFLICT_HOURS` (6 hours), or same-key movement faster than `SUSPICIOUS_SPEED_KMH` (200 km/h) within the duplicate window, are flagged suspicious. These reports remain privately retrievable but are excluded from numeric calculations. Review flags are heuristics, not accusations. Rejected reports are excluded. There is no citizen-controlled verification/status field or field-verification endpoint.

`verifiedReportCount` counts explicit VERIFIED records among eligible contributors. Automated agreement does not mark a report verified. Seed verification is explicitly `SIMULATED_FIELD_CHECK`; new citizen reports remain PENDING.

Events are EMERGING below `CLUSTER_MIN_REPORTS` (3) or `CONFIDENCE_CONFIRMED_THRESHOLD` (60), ACTIVE above these evidence thresholds, and HISTORICAL after `CLUSTER_ACTIVE_HOURS` (24) without a new report. EMERGING means limited current evidence, **not a forecast**. Stable keys derived from the first report make repeated detection idempotent. Event versions no longer backed by clusters after deletion, merge or split become SUPERSEDED and are omitted from normal reads. This does not assert a shortage was resolved.

## Confidence

Confidence means evidence that a genuine shortage exists; it has no relation to the percentage of water remaining. Inputs are normalized to 0–100:

| Component | Calculation | Default weight |
| --- | --- | --- |
| Consistency | Share reporting the most common problem type | 35% |
| Geographic concentration | `100 - 50 × diameter / radius`, times precision factor `0.5 + 0.5 × fraction of precise locations` | 25% |
| Independence | Unique eligible browser keys / `CONFIDENCE_INDEPENDENT_TARGET` (10), capped at 100 | 20% |
| Infrastructure | 100 for a nearby incident active at observation time; otherwise 0 (no evidence available) | 10% |
| Time concentration | `100 - 50 × report span / window`, clamped to 0–100 | 10% |

The weighted sum is rounded to one decimal. A single report provides no geographic/time clustering evidence, so those two components score zero. `CONFIDENCE_WEIGHTS` is validated JSON with weights totaling 100. The UI shows the components, verified count, approximate diameter, report time span, excluded counts and incident evidence. In this phase incident/environmental inputs exist only as labeled simulation data. Real reports never inherit simulated signals merely by selecting Panchavati.

## Population and duration

Approximate affected population = sum of unique eligible reporting household sizes / assumed reporting coverage. `POPULATION_REPORT_COVERAGE` defaults to 0.25; an area record may supply an estimate instead. This assumption is **not measured uptake**, and the UI exposes it. When an area population estimate exists, extrapolation is bounded by that estimate, but never falls below the reported household total. Without a census estimate there is no defensible upper bound, so it remains null. This is a simple MVP model, not a calibrated inference model. Cross-device households and separate time windows may overlap; dashboard totals are approximate sums of non-historical events.

Duration is the median elapsed time since each eligible report's last supply. If that time is unknown, use reported duration plus report age. Unknown duration stays null. This describes reported continuing interruption, not a verified infrastructure outage. Demo calculations use the latest fixed seed timestamp as observation time so outputs never drift with the current date.

## Deterministic severity

No AI/LLM participates in numeric scoring. The backend calculates and persists the weighted sum:

| Component | Normalization / default | Weight |
| --- | --- | --- |
| Duration | Hours / `SEVERITY_DURATION_MAX_HOURS` (25), capped at 100 | 25% |
| Estimated population | Population / `SEVERITY_POPULATION_MAX` (750), capped at 100 | 20% |
| Household water stress | Median category score: EMPTY=100, LESS_THAN_25=90, BETWEEN_25_50=60, ABOVE_50=20; UNKNOWN=null | 20% |
| Environmental stress | Temperature linear between `SEVERITY_TEMPERATURE_MIN_C` (25) and `SEVERITY_TEMPERATURE_MAX_C` (44) | 15% |
| Vulnerability | Vulnerable-share estimate / `SEVERITY_VULNERABILITY_MAX_RATIO` (0.25), capped at 100 | 10% |
| Shortage confidence | Calculated confidence directly | 10% |

All values are clamped to 0–100 and final score rounded to one decimal. `SEVERITY_WEIGHTS` is validated JSON totaling 100. Thresholds default to LOW <30, MEDIUM ≥30, HIGH ≥60, CRITICAL ≥80; `SEVERITY_THRESHOLDS` configures ascending medium/high/critical cutoffs.

Unknown components stay null. Weights are not silently redistributed. Displayed severity is the known weighted contribution, explicitly labeled partial, with the maximum possible score if unknown components were all maximally severe. Classification uses the displayed score; missing evidence may raise it. Water stress is a category score, not a claim of measured water quantity. Normalizers and coverage are illustrative configuration, not validated municipal policy.

## Persistence, API and scope

`Area` stores labeled simulation context; `ShortageEvent` stores aggregate metrics, private membership references, score components and evidence. API serialization omits membership IDs, anonymous hashes, descriptions, photos and household coordinates. Aggregate zone centers are public; a single-report event can reveal an approximate location. This prototype is intended for fictional/local demonstration until account authorization and privacy aggregation thresholds are introduced.

`GET /api/shortages[/:id]?demo=true|false` refreshes aggregates. `POST /api/shortages/detect` and `POST /api/shortages/:id/calculate-severity` accept only an empty object, recompute from stored evidence and are rate limited. `GET /api/shortages/:id/severity` returns the breakdown. All use the existing exact-origin CORS/security/error middleware. Production rejects demo shortage requests and seeding.

Detection runs synchronously in a serialized queue per API process. A batch limit of 5,000 reports fails explicitly rather than dropping evidence; a paginated background worker and cross-process locking are future work. Detection failures after successful persistence return `detectionStatus=DEFERRED`; unchanged submission retries and subsequent status/shortage reads recalculate from MongoDB. Report status shows the deferred state. No derived failure discards a saved citizen report. Event keys/indexes prevent duplicate persisted events.

The zone map uses projected geographic coordinates with north up and severity markers; it works offline, shows aggregate centers and has keyboard selection. It is clearly labeled a coordinate-based map without street tiles. Paid APIs and external tile availability are not required.

`fairnessEngine` contains pure previous-delivery penalty, need adjustment and priority helpers; missing delivery history returns null. It is not called by severity and exposes no allocation workflow. Accounts, field-verification actions, AI/AWS execution, forecasts, tanker management, allocation and delivery remain deferred. No Phase 4 features are implemented.

## Tests

Final verification on 8 October 2026:

| Check | Result |
| --- | --- |
| API/configuration/business-logic tests | 72 passed |
| Real MongoDB integration tests | 15 passed |
| Desktop/mobile browser regressions (Phases 1–3) | 42 passed |
| Actual localhost/127.0.0.1 development-origin browser submissions | 2 passed |
| Frontend production build, lint, diff whitespace check | Passed |
| Demo seed command and live `/api/health` | Passed; MongoDB connected |

The final browser flow returned HTTP 201, verified Report and ShortageEvent documents directly in MongoDB, and checked derived values in citizen status and the municipal dashboard. Test-created citizen records were removed by exact ID. The local development app remains running on API port 5000 and web port 5173.

`npm test`: existing health, CORS, environment, validation, photo/rate-limit tests plus deterministic clustering, bounded time windows, chains, repeated/suspicious keys, confidence, coverage estimates, unknown inputs, duration, severity weights/boundaries, reproducible demo and fairness helpers.

`npm run test:mongo`: original health/persistence/photo/privacy/idempotency checks plus automatic event creation/updates, population/confidence exclusion rules, reconnect persistence, public aggregate privacy, repeatable multi-area seed, superseding stale events and safe API failures. Mutating tests use unique temporary databases and drop only their own database.

`npm run build`, `npm run lint`, `npm run test:e2e`: desktop/mobile tests preserve Phase 1/2 flows, check derived demo values and all four levels, map selection, emerging evidence, detail refresh, real independent citizen submissions → MongoDB event → dashboard/status, and loading/error/retry states. `npm run test:dev-origins` continues real browser submissions from both local development origins. Browser tests delete only their created citizen IDs and refresh derived aggregates afterward.

## Exact Phase 3 file inventory

New backend modules: `apps/api/src/config/detection.js`; `apps/api/src/models/Area.js`; `apps/api/src/models/ShortageEvent.js`; `apps/api/src/services/geography.js`; `apps/api/src/services/confidenceEngine.js`; `apps/api/src/services/populationEngine.js`; `apps/api/src/services/severityEngine.js`; `apps/api/src/services/reportClusteringService.js`; `apps/api/src/services/shortageService.js`; `apps/api/src/services/fairnessEngine.js`; `apps/api/src/routes/shortages.js`; `apps/api/src/demo/areas.js`.

Existing backend files changed: `apps/api/package.json`; `apps/api/src/app.js`; `apps/api/src/config/env.js`; `apps/api/src/controllers/reportController.js`; `apps/api/src/models/Report.js`; `apps/api/src/routes/index.js`; `apps/api/src/routes/reports.js`; `apps/api/src/validation/report.js`; `apps/api/src/demo/reports.js`; `apps/api/src/demo/seedReports.js`; `apps/api/src/demo/seed.js`.

New frontend modules: `apps/web/src/lib/shortages.js`; `apps/web/src/hooks/useShortages.js`; `apps/web/src/components/ShortageDetails.jsx`; `apps/web/src/components/ShortageMap.jsx`; `apps/web/src/pages/ShortagesPage.jsx`; `apps/web/src/pages/ShortageStatusPage.jsx`; `apps/web/src/shortages.css`.

Existing frontend/shared files changed: `apps/web/src/App.jsx`; `apps/web/src/main.jsx`; `apps/web/src/pages/HomePage.jsx`; `apps/web/src/components/ReportDetails.jsx`; `packages/shared/reportOptions.js`.

Tests: new `apps/api/test/detection.test.js`, `apps/api/test/shortages.mongo.test.js`, `tests/e2e/phase3.spec.js`; updated `apps/api/test/app.test.js`, `apps/api/test/reports.mongo.test.js`, `tests/e2e/phase1.spec.js`, `tests/e2e/phase2.spec.js`, `tests/development/origins.spec.js` for current metadata/demo size, navigation and derived test-data cleanup.

Configuration/documentation: `.env.example`; `README.md`; this `docs/phase3.md`. No dependencies were added, no package lockfile changes, no secrets or files outside the repository were edited.
