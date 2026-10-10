# Phase 8 — deterministic report-activity early warning

Phase 8 adds JavaScript backend calculations, persistent predictions/alerts, protected municipal APIs and `/admin/predictions`. It preserves the Phase 1–7 engines and operational workflows. No Gemini or Strands import exists in the numerical engine or persistence service. The existing Early Warning role may explain completed, current results on explicit request; missing keys, outages, cancellation and circuit state cannot block numerical APIs. No live inference was requested during implementation.

## Target and available evidence

`ELIGIBLE_REPORT_ACTIVITY` estimates the eligible report count in the next observation window for a service area. It does **not** estimate physical shortage probability, reservoir depletion, demand, rainfall, time until water runs out or recovery after delivery. Existing shortage severity and shortage-existence confidence are separate observed context, never risk inputs.

Inputs are persisted Report creation timestamps, service-area IDs, reporter-key hashes, coordinates used internally for the existing Phase 3 duplicate/suspicious checks, supply-time/duration conflict checks, review status and simulation provenance. Raw reports, coordinates, hashes, contact details, description and photos are never returned by prediction APIs or sent as prediction evidence. Configured locality/Area names define the area catalog. Reports lacking a supported area cannot establish area-specific history. Current ShortageEvent context is read separately; historical severity snapshots, resolved shortage history, validated demand/storage and observation-uptime records do not exist. Delivery quantities do not establish recovery, so are not extrapolation inputs.

## Exact calculation

Model: `report-activity-ewma-v1`. Hash of numerical and duplicate-handling settings is `configVersion`. Same data/configuration/cutoff yields the same calculation regardless of input order.

Let `W` be window hours (default 6), `N` be history windows (default 12), and `T = floor(now / W) × W` in UTC. Use N complete, non-overlapping windows `[T−NW,T)`. Include an additional duplicate-window lookback before that interval when checking eligibility, across areas within the same provenance. Exclude rejected reports, repeats and suspicious reports through the preserved Phase 3 algorithm. A later review is treated as PENDING at an earlier cutoff because review-status history cannot be reconstructed.

A window with no eligible records is **unknown**, not confirmed zero activity. All N windows must have positive sampled activity. This confirms sampled report coverage only, not collection uptime. Require at least 18 eligible reports, six independent reporter keys (not verified identities), and an observation within the configured freshness limit (default 12 hours). Invalid evidence, more than 50% excluded area evidence, missing windows, low sample/diversity or a capped history read all produce `INSUFFICIENT_DATA`, null score and null forecast.

For suitable history:

1. Keep original observed counts visible. Calculation cap `C = max(1,4 × median(counts))`; `x_i = min(count_i,C)`.
2. Baseline `B = mean(x_1 … x_(N−4))`. The last four windows form the recent interval.
3. EWMA starts at B and updates `E = 0.5 × x_i + 0.5 × E` for each recent window.
4. Relative change `g = (E−B)/max(B,1)`. Trend `t = clamp(g,0,1)`.
5. Persistence `p = fraction of recent windows with x_i ≥ 1.25B`.
6. Recurrence `r = fraction of baseline windows with x_i ≥ 1.25B`. This means recurring elevated activity windows, **not** recurrence after a verified resolution.
7. Risk index `R = round_2(100 × (0.50t + 0.35p + 0.15r))`.
8. Approximate next-window count `F = round_2(clamp(E,0,2B))`. Forecast interval is `[T,T+W)`; generation time may be later than T. Do not shift this horizon on retrieval.
9. Sensitivity range `[min(recent counts,F), min(max(recent counts,F),2B)]`, rounded to two decimals. This is a bounded descriptive sensitivity range, **not** a statistical confidence interval.

Normalization compares each area to its own baseline. High constant raw volume alone gives zero index. Threshold defaults: LOW <25; MODERATE ≥25; HIGH ≥50; CRITICAL ≥75. The index is uncalibrated and never a percentage chance of shortage. All threshold settings must ascend. Small/capped/variable/unverified evidence is disclosed.

Uncertainty is MODERATE even for suitable stable samples because participation and outcome validation are unknown. It becomes HIGH when most records are unverified, normalized median absolute deviation exceeds 0.5, or outliers were capped. Unsuitable evidence is UNAVAILABLE. No physical shortage accuracy or calibrated probability is claimed.

## Configuration and freshness

See root `.env.example`: `PREDICTION_WINDOW_HOURS` ∈ {3,6,12}; history windows 8–28; minimum reports 8–1000; reporters 3–100; stale hours 3–72; ascending moderate/high/critical thresholds. Only a horizon equal to the configured window is accepted. All are backend settings, no client-supplied numerical facts or clock. Gemini configuration is unnecessary.

GET retrieves saved results without evaluating or making provider calls. Results expire when their forecast window ends or observations exceed the freshness limit. Changed configuration is labeled CONFIG_CHANGED. Expired results remain in history with STALE and are excluded from current high-risk KPIs. Unevaluated areas return INSUFFICIENT_DATA / NOT_EVALUATED. Dashboard high-risk KPI is unknown until at least one current supported forecast exists.

## MongoDB and alert lifecycle

Prediction stores unique calculation key, area, horizon, provenance, actor, generation time, immutable-by-service result snapshot and timestamps. Unique key deduplicates unchanged evaluations. The compound history index supports provenance/area/horizon/time retrieval.

EarlyWarningAlert has one unique key per provenance/area/horizon, retaining configuration/model versions, target/result/window/quality/factors/recommendation, revision, cycle, actors/times and audit. Config changes preserve the same alert history. Only supported HIGH/CRITICAL conditions create an alert. Unchanged conditions do not create new alerts or audit entries. Later conditions append UPDATED, ESCALATED, DEESCALATED or DATA_UNAVAILABLE; insufficient evidence never implies recovery. Escalation clears acknowledgement for renewed review. A resolved alert reopens ACTIVE only for a changed urgent condition, incrementing cycle.

ADMIN lifecycle: ACTIVE → ACKNOWLEDGED → RESOLVED. Resolve requires a reason; it does not resolve an observed shortage, approve allocation or dispatch/complete a tanker. Conditional revision/status writes ensure concurrent transitions cannot both succeed. Audit entries and state changes are atomic within the same document. Unique indexes prevent duplicate alert keys and prediction keys; duplicate races are handled. Audit types also include CREATED and REOPENED. Maximum audit entries 1000; further updates fail safely without trimming history. Archival beyond this limit is a documented future operational requirement.

Reads cap history at 5000 records plus overflow detection, catalog at 50 stored areas, evaluation at 20 areas, relevant severity records at 100, pages at 100 and page size at 50. Mongo history/reads use five-second bounds. Evaluation checks a fifteen-second deadline between areas; already completed snapshots remain idempotently saved on partial failure. Mongo connection/socket bounds also apply. Expensive POSTs share ten requests/minute/IP and one evaluation/backtest at a time per API process. Horizontal multi-instance coordination/rate limits require later deployment hardening; optimistic database revisions protect alert writes across processes.

There is **no scheduler** or continuous polling. Evaluation is a bounded administrator-triggered action. No automated emergency promises or external notifications.

## API contracts

All routes require a current ADMIN bearer session; anonymous, citizen and operator access is rejected. Responses use the existing success/error envelope and `Cache-Control: no-store`. Strict query/payload allowlists reject injected filters, clocks and scores. Optional `?demo=true` is disabled in production; trusted demonstration mode always selects its demo dataset.

| Method / route | Contract |
| --- | --- |
| GET `/api/predictions` | Latest saved result per catalog area, current high-risk count and supported horizon |
| GET `/api/predictions/areas/:areaId` | Current/saved area detail or unknown state |
| GET `/api/predictions/areas/:areaId/history?page=1&limit=20` | Bounded saved history; hasMore |
| POST `/api/predictions/evaluate` | `{areaIds?:[known IDs],horizonHours?:configured W}`; calculate and persist; providerRequested=false |
| POST `/api/predictions/backtest` | `{areaId}`; rolling-origin report-activity evaluation, no operational writes |
| GET `/api/predictions/alerts` | page/limit, optional status/areaId; audited records |
| GET `/api/predictions/alerts/:id` | Alert detail including audit history |
| POST `/api/predictions/alerts/:id/acknowledge` | `{revision,note?:string}` |
| POST `/api/predictions/alerts/:id/resolve` | `{revision,note:nonempty string}` |

Optional existing POST `/api/ai/predict` explains a completed current result from the selected shortage's service area. It does not generate a prediction or write an alert. The existing strict advice/evidence validator remains unchanged; quantitative facts are separate. RULE_BASED fallback says AI is unavailable, preserving completed facts. No optional explanation is required to open the numerical dashboard.

## Backtesting and observed results

Rolling-origin backtesting considers at most eight cutoffs spaced W hours apart. Features receive only records created before their cutoff, with later review status withheld. The next interval supplies eligible report outcomes; no-observation outcomes are unknown and skipped. At least three usable cutoffs are required to show MAE, `mean(abs(predicted−observed))`; otherwise null and INSUFFICIENT_VALIDATION_DATA. It tests report activity only and remains limited by incomplete review history, reporting bias, collection uptime and unknown no-report outcomes.

Read-only review on 10 October 2026: configured real dataset had **5 reports**, demonstration dataset **48 reports**. Both had **zero usable backtesting cutoffs**, INSUFFICIENT_VALIDATION_DATA and null MAE. No real accuracy was established. No data was refreshed, overwritten or deleted.

Explicit synthetic tests: twenty constant-count windows (three reports/window) yielded eight usable cutoffs and MAE 0. Rising fixture baseline 2/recent 6 yielded EWMA 5.75, bounded approximate forecast 4 and index 85/CRITICAL. These are formula/implementation checks, **not** real-world validation or seeded final scores.

## Running and demonstration

```powershell
npm run dev
# Sign in as ADMIN, open /admin/predictions, select Evaluate current evidence.
# Existing persisted faculty seed is too short/sparse for forecasts: demonstrate its honest insufficient-data state.
npm test
npm run test:mongo
npm run build
npm run test:e2e
npm run test:dev-origins
npm run lint
# Targeted supported-forecast and alert UI demonstration against disposable synthetic fixtures:
npx playwright test tests/e2e/phase8.spec.js
```

Frontend adds PredictionsPage and an accessible observed-versus-predicted chart with data table, timestamps/horizon, separate observed severity/confidence, factors, freshness/uncertainty, history/backtesting and alert controls/audit. It supports loading/error/retry, empty/not-evaluated/insufficient/stale/config-changed states, desktop/mobile and existing role guards. Screenshots from browser tests are `.local/qa/phase8-desktop.png` and `phase8-mobile.png`. Simulated scenarios are explicitly labeled. No production demo seed or dynamic simulation was introduced.

## Files changed for Phase 8

New: `apps/api/src/config/prediction.js`; `models/Prediction.js`, `models/EarlyWarningAlert.js`; `services/predictionEngine.js`, `services/predictionService.js`, `services/ai/predictionEvidence.js`; `routes/predictions.js`; `apps/api/test/prediction.test.js`, `prediction.mongo.test.js`, `helpers/predictions.js`; `apps/web/src/pages/PredictionsPage.jsx`, `components/PredictionChart.jsx`; `tests/e2e/phase8.spec.js`; this document.

Modified: `.env.example`, `AQUASHIELD_SPEC.md`, `README.md`, `apps/api/package.json`; API `app.js`, `config/env.js`, `routes/index.js`, `services/dashboardService.js`, `services/ai/{agentService,evidence,prompts,demo}.js`, `demo/agentEvidence.js`, `test/app.test.js`; web `App.jsx`, `components/{AdminLayout,AdminDashboardPanels}.jsx`, `lib/adminApi.js`, `styles.css`; `docs/{ai-reliability,demo-guide,through-phase7-audit}.md`.

The repository already contained uncommitted persistent-demo changes before Phase 8; they were preserved. Full validation results are recorded below after execution. No staging/commits, live Gemini, AWS/Bedrock, paid dependencies, Phase 9 or dynamic simulation.

## Executed verification (10 October 2026)

- `npm test`: **171 passed**, 0 failed/skipped. Includes deterministic prediction, cutoff/eligibility/quality/outlier/threshold/reproducibility and later-review leakage checks, plus all preserved unit/API tests.
- `npm run test:mongo`: **92 passed**, 0 failed/skipped. Includes actual Mongo persistence across reconnection, unique indexes/idempotency, lifecycle/audit, concurrent transitions, provenance/privacy, authorization, strict inputs/pagination/rate limits and a protected Early Warning endpoint under a mocked Gemini outage while numerical evaluation/retrieval remain available.
- `npm run test:e2e`: **104 passed** (52 desktop + 52 mobile), including all Phase 1–7 browser workflows and three Phase 8 cases per viewport. Local app servers and real browser/Mongo integration were used with explicit synthetic fixtures; no live provider requests.
- `npm run lint`, `npm run build`, and `git diff --check`: passed.
- Default `npm run test:dev-origins` could not start because the user's server occupied 5173. It was preserved. `$env:AQUASHIELD_BROWSER_DEV_PORT='5175'; npm run test:dev-origins`: **2 passed**, localhost and 127.0.0.1 submission/persistence/retrieval. Existing default-origin unit checks remain intact.
- Read-only actual-database historical coverage review returned the inadequate real/demo histories described above. This was not live forecast accuracy validation.

All keys remained private. Existing user/uncommitted changes and operational records were preserved; tests cleaned only their own guarded disposable databases. No live Gemini request, paid dependency, AWS deployment, Bedrock, dynamic simulation, later phase or commit was introduced.
