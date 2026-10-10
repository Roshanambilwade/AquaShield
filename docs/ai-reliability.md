# Gemini resilience and agent reliability

This focused update preserves Phases 1–7 and the Gemini + Strands architecture. No live inference, provider change, deployment or Phase 8 implementation is part of this verification. Mocked success is not proof of live Gemini availability. The historical Resource Allocation live HTTP 503 remains recorded in the through-Phase-7 audit.

## Execution and evidence

Protected assessment APIs now return a validated rule-based assessment when provider execution is unavailable and authorized evidence can be loaded. Authentication, input errors, missing/out-of-scope evidence and client cancellation still fail explicitly. An empty evidence set remains `AI_NO_EVIDENCE` rather than an invented assessment. Missing Gemini configuration does not prevent evidence-based review.

| Method | Existing execution mode | Meaning |
| --- | --- | --- |
| `GEMINI` | `REAL_GEMINI` | Actual provider result passed the existing schema and evidence validation. |
| `RULE_BASED` | `RULE_BASED` on agent APIs; `DETERMINISTIC_ONLY` on saved allocations | Existing backend facts remain authoritative; no completed AI analysis is claimed. |
| `DEMO` | `DEMO_SIMULATION` | Explicit `DEMO_AI_MODE` simulation, never recovery from a real-mode failure. |

Responses add `execution.method`, `providerAttempted`, `aiAnalysisCompleted`, `providerStatus`, `fallbackReasonCode`, `attempts`, `circuitState`, and `assessmentStatus`. Existing `requestId`, evidence version, source/demo flag, human-review requirement and `approved: false` remain. `providerExecuted` retains its successful-execution meaning; failed attempts are identified separately. The dashboard renders an explicit rule-based message, safe reason code, correlation ID and insufficient-evidence status. Allocation records preserve the same provenance and their established mode; a recommendation requested without AI has `NOT_REQUESTED` status.

`?demo=true` chooses fictional evidence independently of execution mode. A real Gemini request or rule-based assessment can use explicitly selected demo evidence; that evidence is labeled and stays separate from real records. Production demo restrictions remain. Provider failures never call the demo generator.

## Agent-specific behavior

| Role | Fallback and limits |
| --- | --- |
| Crisis Detection | Presents existing severity, shortage confidence, report counts and population estimates. An active shortage with finite severity/confidence remains reviewable; insufficient/emerging evidence is marked `INSUFFICIENT_DATA`. No new verification claims. |
| Resource Allocation | Uses the authoritative operational snapshot, fairness, eligible candidates and selected priority. Without a candidate, returns insufficient data. Recommendations still recheck freshness/eligibility after provider latency; explicit administrator approval and assignment remain separate. |
| Logistics | Preserves persisted trip facts and deterministic distance/ETA estimates where available. Missing route inputs require manual review. No live GPS, traffic or arrival claims are generated. Operator transitions, OTP verification and actual-litre accounting do not call the model. |
| Early Warning | Preserves available evidence and missing-input information. There is currently no numeric forecasting service; fallback is `INSUFFICIENT_DATA` with manual review, not a forecast. Phase 8 remains deferred. |

Fallback prose is role-specific and contains no invented numeric facts. Both provider advice and fallback advice pass `validateAdvice()`. The provider's rejected text is discarded. No severity, confidence, fairness, population, distance, ETA or risk formula is duplicated or replaced.

## Bounded shared provider policy

One process-local reliability instance per application configuration is shared by the four roles and allocation explanations. Strands retries remain disabled and the pinned Google SDK uses its existing single-fetch path, so only this layer retries an assessment.

| Variable | Default | Accepted range |
| --- | --- | --- |
| `AI_TIMEOUT_MS` | 15000 | 1000–60000 ms total provider assessment, including retries/backoff |
| `AI_ATTEMPT_TIMEOUT_MS` | 60000 | 1000–60000 ms, clipped to remaining total deadline |
| `AI_MAX_RETRIES` | 1 | 0–2 retries after the initial attempt |
| `AI_RETRY_BASE_MS` | 500 | 50–5000 ms |
| `AI_RETRY_MAX_DELAY_MS` | 5000 | 100–10000 ms |
| `AI_CIRCUIT_FAILURE_THRESHOLD` | 3 | 1–20 transient attempt failures since last successful reset |
| `AI_CIRCUIT_RESET_MS` | 30000 | 1000–300000 ms |
| `AI_MAX_CONCURRENT` | 2 | 1–4 active assessments, including backoff and unsettled transport |

The example environment retains its existing 60000 ms total setting. Existing private environment files and model IDs are unchanged. Local environment changes require a backend restart.

Retryable failures: HTTP 429/500/502/503/504, recognized network failures and provider timeouts, when enough budget remains. Backoff doubles by attempt, is capped, and uses 50–100% jitter. Authentication, invalid model/request/configuration, malformed/unsupported output, output limits and other unclassified failures are not retried. Cancellation is never converted to fallback.

Applicable `Retry-After` seconds/date or Google `RetryInfo` delay is honored. If it exceeds the delay/deadline budget, the current assessment returns fallback and the shared cooldown blocks early new calls. The pinned Google SDK can discard raw response headers; the layer cannot recover a discarded header, but handles exposed headers and structured RetryInfo. It never logs either raw source.

An open circuit immediately yields rule-based results. After the reset interval, one caller becomes the recovery probe; others remain blocked. Probe success closes the circuit; failure reopens it without retrying the probe. Stale concurrent successes cannot close a newly opened circuit. Concurrent calls during shared backoff receive a cooldown result; there is no unbounded queue.

Total/attempt timers abort the Google/Strands signal. If a transport ignores cancellation, the caller still receives a bounded response, but its concurrency slot stays occupied until transport settles, preventing overlapping retries. A permanently stuck transport can therefore reduce available AI capacity until restart. A default attempt can consume the whole total budget; retries are opportunities for earlier failures, not a promise to make another request after a full deadline.

Each assessment attempt retains the existing three-turn/6000-output-token agent limit and 3000-token per-generation limit. A retry restarts the read-only assessment, so default policy permits at most six generation turns; the maximum configured retry count permits nine, all within the same total deadline. This may consume additional quota if live execution is requested. The live diagnostic explicitly sets zero assessment retries and retains strict failures, so it cannot mistake fallback for successful live verification. No diagnostic was executed in this task.

Operational logs contain fixed event/role labels, server-generated correlation IDs, safe codes, attempt counts, timing and circuit state. No raw prompts, model output, household details, keys, headers or SDK stack traces are logged. Saved allocation provenance and existing operational audit trails remain intact; standalone assessments have safe logs, not a new durable assessment-history store.

## Verification

Automated tests inject providers or use explicitly configured demo mode, and use isolated MongoDB test databases. Browser coverage runs the actual local application on desktop and mobile; the new fallback presentation cases use the actual backend service with an injected failing provider and isolated persisted evidence, while MongoDB tests exercise outage handling through the protected API. The presentation fixture avoids consuming the shared API rate-limit window; production security limits are unchanged.

- `npm test`: unit/API, retry policy, HTTP failures, cancellation, deadlines, strict output validation, cooldown, concurrency and recovery.
- `npm run test:mongo`: persisted report/shortage workflows, all-role outage responses, allocation fallback provenance, approval/ownership/audit protections, and trip/OTP/completion after failed logistics advice.
- `npm run test:e2e`: full citizen/admin/operator workflows and all-role fallback presentation on desktop/mobile.
- `npm run lint` and `npm run build`: static checks and production frontend build.

Final results on 10 October 2026: **155 unit/API tests passed; 78 MongoDB integration tests passed; 94 desktop/mobile browser tests passed; lint and production build passed.** The new browser cases caught a conflicting static configuration label, which was fixed. Their fixture was then isolated from the API rate-limit window after a later mobile case was throttled. The final full browser run passed with production limits unchanged. No live Gemini calls were made.

These checks establish supported deterministic continuity, not live-provider health, forecasting capability or production-scale resilience. Circuit/cooldown/concurrency state is in memory per backend process and is not coordinated across replicas. Evidence/database availability is still required, and insufficient evidence still needs human review.

## Changed files

- Policy and defaults: `.env.example`, `apps/api/src/config/ai.js`.
- Shared reliability/fallback: `apps/api/src/services/ai/reliability.js`, `ruleBased.js`, `agentService.js`, `providerErrors.js`; refreshed limitations text in `allocationEvidence.js`.
- API/operations integration: `apps/api/src/routes/ai.js`, `apps/api/src/services/operationsService.js`.
- Strict live diagnostic policy: `apps/api/src/scripts/testLiveAi.js` (no live execution).
- Dashboard status: `apps/web/src/components/AiRecommendationPanel.jsx`.
- Tests: `apps/api/package.json`, `apps/api/test/aiReliability.test.js`, `ai.test.js`, `ai.mongo.test.js`, `operations.mongo.test.js`, `delivery.mongo.test.js`, `tests/e2e/phase5.spec.js`.
- Documentation: `README.md`, `docs/phase5.md`, this file. The specification's twelve overrides and core deterministic services are unchanged.
