# Phase 5 — Strands/Gemini agent recommendations

This is the historical Phase 5 report: it added four read-only agent roles and replaced the administrator dashboard's inactive AI panel. React, Express and the integration are JavaScript. Phase 6/7 operations have since been implemented; prediction and AWS deployment remain separate. Current through-Phase-7 coverage and authorized 10 October live outcomes are in [the completion audit](through-phase7-audit.md): Crisis Detection, Logistics and Early Warning passed, while Resource Allocation returned Google HTTP 503. Older results below remain historical.

## Architecture and packages

Verified with Node.js 22.21.1. The repository requires Node 22.13+; Strands 1.20.0 requires Node 22+. The API pins `@strands-agents/sdk@1.20.0` and its Google peer dependency `@google/genai@2.6.0`. Existing Zod validates requests and output. No TypeScript migration or separate service is required.

The official `Agent` uses an explicit `GoogleModel` from `@strands-agents/sdk/models/google`. Each invocation gets its own agent, role instructions, bounded structured-output schema and a read-only `get_shortage_evidence` tool that returns the authorized aggregate snapshot. It has no database-write, shell, browser, dispatch or arbitrary network tools. Agent retries are disabled, turns are capped at three, provider output is bounded and timeout cancellation is passed to Google and Strands. SDK printing/logging is disabled to avoid leaking prompts or provider errors. [Official SDK](https://github.com/strands-agents/sdk-typescript), [Google provider](https://strandsagents.com/docs/user-guide/sdk/model-providers/google/)

Express authenticates the existing admin session, validates the request, loads current MongoDB evidence and constructs an allowlisted snapshot. Existing shortage and dashboard services supply scores, report counts, available fleet/delivery records and reporting-hour counts. The provider receives zone references rather than user-entered locality names, private descriptions, photos, citizen tokens or household coordinates. Available fleet coordinates are operational records, not household locations.

Backend severity, shortage confidence, estimated population, duration and geographic calculations remain unchanged. Priority ordering is severity descending, then known duration descending, then stable event ID. Existing fairness helpers retain null priority when verified demand volume is missing; no per-person demand assumption is invented. Recorded previous delivery is supplied when available. Numeric risk, routing and ETA remain unknown because their later workflows do not yet exist.

The result separates `facts` from `advice` and includes an evidence digest, rule/prompt versions, request ID, timestamp, role and execution metadata. Generated output must match the strict schema, cite the selected/priority zone, preserve the backend priority and use an allowed assessment action. Numeric quantities belong in backend facts; generated prose containing digits, HTML, URLs or detected completion claims is rejected. These checks cannot prove every qualitative sentence: human review remains required. Recommendation confidence is null rather than an invented percentage.

## Agent responsibilities

| Role                | Implemented behavior                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crisis Detection    | Explains cluster evidence and shortage confidence; recommends field verification without marking any report verified.                                                                           |
| Resource Allocation | Explains the backend priority area, reasons, fairness limitations and missing delivery/demand evidence. Does not select or assign a tanker.                                                     |
| Logistics           | Reviews available fleet records and identifies missing routing/ETA/capacity inputs. No fleet is seeded or fabricated.                                                                           |
| Early Warning       | Explains current evidence and available reporting-hour counts, identifies missing historical/supply inputs and recommends monitoring. Numeric risk remains unknown; EMERGING is not a forecast. |

## Local setup and modes

Install dependencies with `npm install --cache .local/npm-cache`. Keep the existing MongoDB and admin setup. Configure the ignored root `.env`:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL_ID=
DEMO_AI_MODE=true
AI_TIMEOUT_MS=15000
AI_FAIRNESS_MAX_ADJUSTMENT=15
```

`.env.example` enables local demo mode. If the variable is absent, the validated default is false. Production rejects demo AI and demo evidence. `AI_TIMEOUT_MS` accepts 1000–60000; fairness maximum adjustment accepts 0–30 but cannot produce a fairness score until verified demand is available. Remove reliance on legacy `STRANDS_MODE`; if an older `.env` says `AI_PROVIDER=bedrock`, change it to `gemini` before real mode. Bedrock and AWS CLI credentials are not required.

Start `npm run dev`, provision an administrator with `npm run admin:create`, and optionally seed the fictional multi-area scenario with `npm run seed:demo`. Open `/admin?demo=true`, select an agent and click **Generate recommendation**. The evidence selector's `demo` flag selects fictional records; `DEMO_AI_MODE` independently controls model execution.

- **Demo mode:** no model request or Strands agent invocation occurs. Deterministic role responses use the same validation contract. UI/API show `DEMO_SIMULATION`, `isDemo=true`, `providerExecuted=false` and no model/provider identity.
- **Real mode:** set `DEMO_AI_MODE=false`, a backend-only `GEMINI_API_KEY` and a supported, account-accessible `GEMINI_MODEL_ID`, then restart the API. Successful calls show `REAL_GEMINI`, `providerExecuted=true`, Google Gemini, Strands and the configured model. Missing configuration returns `AI_NOT_CONFIGURED`; failures/timeouts never silently fall back to demo or Bedrock.

Never commit, log or expose the API key through `VITE_*`, browser storage, API responses or screenshots. Shell variables take precedence over `.env`. No secret values are needed in documentation or test fixtures.

## Protected APIs

All five endpoints use POST, existing bearer-token admin authorization and the standard `{ success, data }` / `{ success:false, code, message, details }` response convention:

- `/api/ai/detect`
- `/api/ai/allocate`
- `/api/ai/logistics`
- `/api/ai/predict`
- `/api/ai/recommend-allocation` — same Resource Allocation implementation as `/allocate`.

Body: `{ "demo": true, "eventId": "<existing MongoDB event ID>" }`. Both fields are optional; `demo` defaults to false. Without `eventId`, assessment uses the top current zone. Allocation compares all current zones regardless of selected event. Historical/superseded events cannot be selected. Clients cannot supply prompts, provider keys, metrics, roles or fleet facts. Unsupported fields and query parameters return 422.

Responses use `Cache-Control: no-store`. The shared limiter permits twenty assessment requests per connection per fifteen minutes, and each API process permits two concurrent assessments. Existing CORS remains exact-origin. Controlled errors include `AI_NOT_CONFIGURED` (503), `AI_PROVIDER_FAILED`/`AI_INVALID_OUTPUT` (502), `AI_TIMEOUT` (504), `AI_NO_EVIDENCE` (422), `AI_EVIDENCE_LIMIT` (503), authorization and demo-access errors. Existing reporting/health/dashboard services continue independently of provider availability.

## Real execution verification

Run `npm run test:ai:live` after configuring the backend key/model and `AI_PROVIDER=gemini`. This explicitly invokes the Crisis Detection role through Strands using fictional evidence only, without MongoDB or private citizen data. It validates the result and prints safe execution metadata. Missing key/model produces an explicit **SKIPPED**, never a success claim. A failed request exits unsuccessfully without raw provider details.

Initial Phase 5 verification had no configured Gemini credentials. A subsequent live diagnostic on 9 October 2026 loaded the root .env with real mode and a 60000 ms timeout. Google confirmed access to the configured gemini-3.8-flash model. Generation reached Google but the final retry returned HTTP 503 after approximately 4.4 seconds, reported as AI_PROVIDER_UNAVAILABLE. Another attempt reached the bounded agent deadline; a stream trace observed first response data after approximately forty-five seconds. **A complete validated live Gemini assessment remains unverified.** Model metadata access and received stream data do not prove a successful assessment. An automated transport test executes the actual Strands Agent and GoogleModel against a mock Google function-call stream; this proves SDK wiring/parsing, not a real Google request.

The live command now prints only configuration presence/model, fixed stage names, timing counters and sanitized error categories. It runs a separate metadata preflight capped at ten seconds, followed by generation capped at AI_TIMEOUT_MS. During generation the service deadline caps the whole multi-turn assessment; the Google HTTP timeout caps each request using the same bound and the shared abort signal. There is no remaining hardcoded fifteen-second generation timeout. The browser allows sixty-five seconds, and does not participate in this CLI test. Timeout cancellation is retained; no demo fallback or automatic model substitution occurs.

The pinned Google SDK's retryOptions.attempts=1 wrapper discarded HTTP statuses before normal error parsing. Omitting retryOptions makes one fetch in version 2.6.0 and preserves the status; Strands retries remain disabled. Safe categories now distinguish authentication/permission, unavailable model, invalid request, quota/rate limits, provider unavailability, network/TLS, provider timeout, agent deadline and output/schema limits. Raw provider data is never logged or returned. Google service unavailability cannot be repaired by increasing a client timeout; retry explicitly later using the same configured model.

The final credential audit found the configured key in the local tracked .env.example and cleared that value back to an empty placeholder. The working ignored root .env was preserved. A subsequent audit found no copies of the configured key in tracked/unignored files and no Google/AWS credential patterns in Git history. No credential value was printed.

Files changed for this diagnostic fix: .env.example; apps/api/src/services/ai/provider.js, agentService.js and new providerErrors.js; apps/api/src/scripts/testLiveAi.js; apps/api/test/ai.test.js; apps/web/src/lib/adminApi.js; tests/e2e/phase5.spec.js; README.md; AQUASHIELD_SPEC.md; docs/demo.md; this report. Main calculation services, authentication and CORS configuration are unchanged. No Phase 6 work was started.

## Verification and limits

### Same-model timeout isolation — 9 October 2026

The root .env now selects gemini-3.7-flash with AI_TIMEOUT_MS=60000. Its DEMO_AI_MODE is true; the live diagnostic explicitly overrides this to false without changing .env. No model/key substitution occurred. Metadata access was confirmed. Independent diagnostic calls produced:

| Call | Result | Elapsed |
| --- | --- | --- |
| Direct Google SDK, short unary prompt | AI_PROVIDER_UNAVAILABLE, Google HTTP 503 | approximately 2.07 seconds |
| Strands assessment through GoogleModel | AI_PROVIDER_UNAVAILABLE, Google HTTP 503; no stream-open event | approximately 10.69 seconds total, including preflight |
| Direct Google SDK, same short prompt streamed | Stream opened, first chunk received, completed with text present; response text not logged | approximately 22.85 seconds |

The supplied 60375 ms AGENT_DEADLINE log identifies the timer in agentService.js, not an intrinsic Strands timeout. It starts before provider invocation and caps the entire multi-turn assessment. Google has its own per-request timeout using the same configured limit. The agent deadline starts earlier and can win even if Google has not yet returned headers or a first chunk. Timers overlap; their limits are not added or shortened. The ten-second metadata preflight is a separate completed request. No browser timeout applies to the CLI. Waiting for the stream and consuming its chunks are both bounded by the outer deadline and shared cancellation. A regression test simulates one received chunk followed by a stalled stream and verifies deadline classification and signal cancellation.

These results reproduce generation failure without Strands, supporting intermittent Google generation availability/latency as the immediate problem. The historical timeout alone cannot prove whether the delay was in Google processing or the network. Metadata success does not guarantee generation availability, and a successful short streamed prompt does not validate the full agent assessment. There is no evidence of an infinite application wait or a fixed shorter generation timeout. No timeout increase, retry loop, model change, key regeneration, fallback or unrelated feature was introduced. Deadline settlement now precedes abort dispatch so cancellation cannot race to mislabel the result as invalid output.

Run each diagnostic explicitly from the repository root (the existing nested npm command does not forward these arguments correctly):

```powershell
node apps/api/src/scripts/testLiveAi.js --direct
node apps/api/src/scripts/testLiveAi.js --direct-stream
npm run test:ai:live
```

The direct modes send only “Reply with the word OK only.” They print fixed stages, timing, chunk counts and whether text exists. No generated content, keys, raw errors or headers are printed. Each mode makes one request, keeps the existing configured deadline, and bypasses Strands only for diagnosis. Next action: inspect Google's service status and retry the existing Strands test explicitly when generation availability stabilizes. If short streamed requests continue succeeding while assessments consistently fail, compare the same assessment payload directly before attributing the difference to Strands; prompt size/tool configuration is not isolated by a short-prompt comparison.

Changed for this isolation task only: new apps/api/src/services/ai/directDiagnostic.js; apps/api/src/scripts/testLiveAi.js; apps/api/src/services/ai/agentService.js; apps/api/test/ai.test.js; this report. Verification: 98/98 API/unit tests and lint passed. No changes were committed; Phase 6 was not started.

Initial Phase 5 verification passed 93/93 API/unit tests, 27/27 MongoDB tests, 64/64 desktop/mobile browser tests, and 2/2 development-origin browser tests. After the live-diagnostic fix, 95/95 API/unit tests and 8/8 Phase 5 desktop/mobile browser tests passed, including the explicit Google-unavailable retry state. Lint and the production build passed again. Browser tests ran the application and verified citizen submission/persistence, shortage detection, admin sessions, map controls and all four demo agent roles. Existing Phase 1–4 assertions are retained; only intentional phase metadata and the replaced panel's accessible label changed. The historical Phase 4 configuration test explicitly selects unconfigured AI mode. MongoDB tests create and remove only isolated test databases, and browser tests retain their existing account/report cleanup.

Credential-pattern checks found no Google/AWS keys or private-key blocks in tracked/unignored files or Git history. The root .env is ignored and has never been tracked. Frontend source and build contain no Gemini key/provider integration. All twelve override rules and the existing calculation services remain unchanged. These checks do not substitute for a real Gemini request.

Known limits: generated prose still needs human review; there is no recommendation history/persistence or allocation approval endpoint. No tanker selection, routing engine, calibrated recommendation probability, numeric risk engine, real fleet feed or AWS deployment is claimed. Assessments are bounded to thirty current zones; exceeding that limit is explicit, not silently truncated. Rate/concurrency limits are per process and need shared enforcement before scaling. Available hourly counts include duplicates and may omit empty hours. Fairness-adjusted priority remains unknown until verified demand inputs exist.

## Changed files

Paths below are relative to the repository root.

- Configuration/dependencies: `.env.example`, `package.json`, `package-lock.json`, `apps/api/package.json`, `apps/api/src/config/env.js`, new `apps/api/src/config/ai.js`.
- API integration: `apps/api/src/app.js`, `apps/api/src/routes/index.js`, `apps/api/src/services/dashboardService.js`, new `apps/api/src/routes/ai.js`.
- New agent modules: `apps/api/src/services/ai/agentService.js`, `contracts.js`, `demo.js`, `evidence.js`, `prompts.js`, `provider.js`, `providerErrors.js`; `apps/api/src/scripts/testLiveAi.js`.
- UI: new `apps/web/src/components/AiRecommendationPanel.jsx`; `AdminDashboardPanels.jsx`, `apps/web/src/pages/ShortagesPage.jsx`, `apps/web/src/lib/adminApi.js`, `apps/web/src/admin.css`.
- Tests: new `apps/api/test/ai.test.js`, `apps/api/test/ai.mongo.test.js`, `tests/e2e/phase5.spec.js`; updated `apps/api/test/app.test.js`, `apps/api/test/dashboard.mongo.test.js`, `tests/e2e/phase4.spec.js`, `playwright.config.js`.
- Documentation: `AQUASHIELD_SPEC.md`, `README.md`, `docs/demo.md`, `docs/phase4.md`, this file.

## Pre-Phase-7 remediation update

For the subsequent focused resilience update, see [AI reliability](ai-reliability.md). It supersedes the historical single-attempt API behavior described above: operational APIs may return explicit rule-based evidence, while live diagnostics remain strict and never accept fallback as live success.

See [the remediation report](remediation.md) for current public aggregation, bounded detection refresh, authoritative allocation advice, recovery policy, fleet eligibility, citizen response history, test isolation and agent verification. Earlier test counts in this document are historical phase snapshots. No live Gemini inference was run during remediation; demo and mocked-provider tests are not proof of live execution. Phase 7 and deployment remain outside this task.
