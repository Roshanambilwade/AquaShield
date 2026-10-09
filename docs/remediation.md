# Pre-Phase-7 remediation and agent verification

Scope: repair F1–F10 in the existing JavaScript application. No Phase 7, deployment, Bedrock, staging or commits. Existing working-tree changes were preserved. This report describes this remediation, not authorship of earlier uncommitted phases.

## Findings and fixes

| Finding | Root cause | Fix and regression coverage | Remaining limit |
| --- | --- | --- | --- |
| F1 — public household privacy | Public serialization returned a singleton's exact center and household population breakdown. | Live clusters below `PUBLIC_MIN_HOUSEHOLDS` are withheld from public list/detail/severity and owner aggregate views. Larger centers use `PUBLIC_LOCATION_GRID_DEGREES`; household breakdowns are removed and area labels come from the locality allowlist. Municipal endpoints retain precise evidence. Unit coverage includes singleton, small, larger and configurable thresholds; Mongo/browser tests check private access and public suppression. | Default minimum 5 (configurable 3–100), grid 0.02 degrees (0.01–1). Public totals cover published clusters only. Fictional demo data is exempt. This is suppression/generalization, not differential privacy or proof against external inference. |
| F2 — allocation evidence | Generic AI ranked crisis severity while operations used verified fairness and eligible tankers. | Both allocation advice paths now use `allocationSnapshot` and `buildAllocationEvidence`. Ineligible/assigned events are excluded; reservation, operator, quantity and freshness rules determine candidates. Fairness penalties, partial inputs, selected fleet and excluded fleet reasons are authoritative facts. Mongo tests compare both surfaces before/after fairness and assignment changes. | Evidence is a point-in-time snapshot; approval and assignment still revalidate. Crisis assessment intentionally retains its distinct scope. |
| F3 — unsupported AI claims | Schemas/references/digit checks did not reject “All reports are verified.” or word quantities. | Conservative assertion exclusions reject positive verification/completion claims, spelled-out quantities, unauthorized operational commands and selected unsupported fleet/risk assertions. Existing strict schema, allowed actions, evidence references and size limits remain. Every role has mocked-provider rejection tests plus official Strands/GoogleModel mock transport coverage. | Arbitrary free-form prose cannot be proved true by these rules. Human review remains mandatory. Validated output is advice, never authority. |
| F4 — interrupted assignments | Reserved retries skipped eligibility checks; obsolete unreserved intents had no cancellation route. | Recovery rechecks current event, priority, operator, quantity and freshness, treating only its own reservation as a candidate. Invalid interrupted intents are audited and rejected through replayable `RECONCILING`; conditional release never matches another allocation's reservation. Active-event uniqueness remains held until release completes. Tests cover before/after reservation crashes, revoked operators, invalidated events, repeated recovery, other owners, competing decisions and interrupted cancellation. | Standalone MongoDB has no cross-document transaction. Eligibility is checked at decision time, not continuously after assignment. If a process stops mid-transition, an administrator must retry assignment/rejection. An old in-flight writer's reservation is cleaned by its conflict path or a repeated rejection; uniqueness and ownership checks remain fail-closed. |
| F5 — citizen history | Only report detail loaded the area response. | One owner-scoped batch adapter returns only status/approval time/assignment time to list and detail. My Reports shows approved/assigned area response without implying verification or delivery. Mongo and browser regressions cover submission, municipal response, refresh, renewed login and denial to other citizens/operators. | Status requires persisted event membership; missing relationships remain null. No new verification workflow. |
| F6 — delayed 401 | Both clients cleared whichever session was currently stored. | Each request captures its authorization header and clears credentials only if the failed request still owns the stored session. Mocked transports test renewal, account changes and genuine expiration for both clients. | Browser session storage retains the existing application security model. |
| F7 — fleet eligibility/freshness | Dashboard counted raw AVAILABLE status and discarded operational observation fields. | Dashboard reuses `tankerEligibility`, checks active operators, exposes eligible count separately from recorded availability, and sends observation time/age/status plus eligibility on map records. Map popups show unknown/stale observations. Mongo regressions cover missing water/time, stale observations, disabled operators, reservations and unavailable records. | A recent observation is still a recorded observation, not live telemetry. Missing coordinates produce no invented marker. |
| F8 — selected evidence refresh | Detail fetching depended on event ID, which did not change after detection. | Detection revision now participates in the selected detail hook. Existing abort/response guards prevent prior requests overwriting current state. Desktop/mobile regression changes persisted water evidence, reruns detection and checks the same event and updated context. | Independently fetched panels can briefly load at different times; loading states remain explicit. |
| F9 — public read pressure | Every public read appended a full detection/write batch. | One gate per database and live/demo mode coalesces reads, reuses successful results, and holds at most one dirty generation. A drain does at most two batches, then returns `DETECTION_BUSY` if evidence keeps changing. New submissions, seeds and explicit detection force refresh. Unit tests cover overlaps, bounded work, invalidation, expiry and errors; existing Mongo tests cover persistence failure and idempotent recovery. | Default reuse 15 seconds, configurable 1–60 seconds. Direct out-of-band writes can remain unreflected until expiry or explicit detection. The process-local gate is not a distributed lock; the existing 5,000-report limit remains. |
| F10 — product/docs | Landing/alerts and agent limitations still described operations as future work; test target documentation called mutating tests read-only. | Copy now distinguishes implemented approval/assignment, future trips/delivery/forecasts, public suppression, demo/mocked tests and unverified live AI. README, phase notes and this report explain current behavior and isolated test execution. | Historical phase verification counts remain labeled historical rather than retroactively claimed as current runs. |

## Files changed by this remediation

Paths are relative to the repository root. Existing changes in these files were retained.

- Configuration/safety: `.env.example`, `apps/api/package.json`, `apps/api/src/config/{env,database}.js`, `playwright.config.js`, `playwright.dev.config.js`, `tests/helpers/{admin,citizen,safety,teardown}.js`.
- F1/F9: `apps/api/src/services/{shortageService,detectionGate}.js`, `apps/api/src/routes/{shortages,dashboard}.js`, `apps/web/src/hooks/useShortages.js`, `apps/web/src/pages/{ShortagesPage,ShortageStatusPage}.jsx`, `apps/web/src/components/ShortageDetails.jsx`.
- F2/F3/agent verification: `apps/api/src/services/ai/{agentService,allocationEvidence,contracts,demo,evidence,prompts}.js`, `apps/api/src/scripts/testLiveAi.js`.
- F4: `apps/api/src/services/operationsService.js`, `apps/api/src/models/Allocation.js`, `apps/api/src/demo/seedOperations.js`, `apps/web/src/pages/OperationsPage.jsx`.
- F5: `apps/api/src/controllers/reportController.js`, `apps/api/src/services/{reportService,reportResponseService}.js`, `apps/web/src/pages/ReportHistoryPage.jsx`, `apps/web/src/components/ReportDetails.jsx`.
- F6: `apps/web/src/lib/{adminApi,api}.js`.
- F7/F8: `apps/api/src/services/dashboardService.js`, `apps/web/src/components/{AdminDashboardPanels,ShortageMap,StreetShortageMap}.jsx`.
- F10: `apps/web/src/pages/HomePage.jsx`, `README.md`, `docs/{phase3,phase4,phase5,phase6,phase65,demo,remediation}.md`.
- Regressions: `apps/api/test/{remediation,ai,ai.mongo,operations.mongo,citizen.mongo,shortages.mongo,dashboard.mongo}.test.js`, `tests/e2e/{phase1,phase3,phase4,phase5,remediation}.spec.js`.

## Four agent roles: what is verified

All four roles share `agentService.js`, `provider.js`, `contracts.js`, `prompts.js` and protected `routes/ai.js`. Strands uses explicit GoogleModel, strict Zod structured output, a read-only immutable evidence tool, disabled SDK logging/retries, bounded turns/output/deadline and cancellation. There is no approval/assignment tool. Allocation and assignment APIs require the administrator's authenticated action and ignore AI authority.

| Role / endpoint | Evidence and prompt inspection | Executed offline checks | Live Gemini |
| --- | --- | --- | --- |
| Crisis Detection / `POST /api/ai/detect` | Aggregate clustering, report/verified counts, confidence, severity; requests field assessment without claiming it happened. | Unit/demo, hostile output rejection, official Strands GoogleModel mock transport, protected Mongo-backed API and browser simulation. | Not executed in remediation. |
| Resource Allocation / `POST /api/ai/allocate` and `/recommend-allocation` | Shared operational snapshot; backend fairness, eligibility, reservations and missing inputs; priorityRef cannot be model-selected. | Same shared checks plus Mongo comparison with operations recommendations and assigned/reserved exclusions. | Not executed in remediation. |
| Logistics / `POST /api/ai/logistics` | Recorded fleet evidence; routing/ETA remain unknown; cannot dispatch or select a tanker. | Unit/demo, hostile output rejection, official SDK mock transport, API authorization and browser simulation. | Not executed in remediation. |
| Early Warning / `POST /api/ai/predict` | Current emerging evidence and historical-input limitations; risk remains null because the numeric forecasting model is not implemented. | Unit/demo, hostile output rejection, official SDK mock transport, API authorization and browser simulation. | Not executed in remediation. |

Tests reject missing/unsupported references, extra authority fields, wrong actions, fabricated digits/word quantities, false report verification and completion claims. Existing timeout, cancellation, malformed output, authentication, model, network, rate-limit and provider error-category tests remain. These tests verify application contracts and mocked protocol behavior, not Google service availability or the truth of every possible sentence.

## Live test proposal — explicit authorization required

No live Gemini inference or metadata calls were made during remediation. Prior phase diagnostic history is not current live verification.

Required backend configuration in ignored root `.env`: `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, the existing account-accessible `GEMINI_MODEL_ID`, and bounded `AI_TIMEOUT_MS` (currently supported range 1,000–60,000 ms). Normal live mode uses `DEMO_AI_MODE=false`. The diagnostic explicitly forces real mode without editing `.env`; it loads root configuration independent of shell cwd. It never prints the key, raw output, request headers or raw provider errors. Missing configuration is SKIPPED, not success. Do not use a `VITE_` key.

After the user explicitly authorizes live inference, run from repository root:

```powershell
node apps/api/src/scripts/testLiveAi.js --role=detect
node apps/api/src/scripts/testLiveAi.js --role=allocate
node apps/api/src/scripts/testLiveAi.js --role=logistics
node apps/api/src/scripts/testLiveAi.js --role=predict
```

Each command first requests model metadata, then performs one bounded agent invocation with fictional evidence and no MongoDB access. Allocation fixtures use the deterministic ranking engine and explicitly empty/unknown fleet/fairness inputs. A role can require up to three model turns; the four-role procedure can therefore make up to twelve generation requests plus four metadata requests. Generation consumes Gemini quota and may incur charges under the configured account's billing arrangement. No retries, timeout increases, key regeneration or model changes are proposed. Stop on quota/auth/model errors and report them before further calls.

Success must include `VERIFIED_REAL_GEMINI`, role, generation latency and `validation=PASSED`; record safe error category/stage/elapsed time otherwise. Provider execution alone is insufficient if response validation fails. `npm run test:ai:live` remains the existing default Crisis Detection command.

Optional diagnostics, only with separate authorization to include these additional calls:

```powershell
node apps/api/src/scripts/testLiveAi.js --direct
node apps/api/src/scripts/testLiveAi.js --direct-stream
```

Each sends one short prompt using the same Google GenAI SDK/model and bounded timeout. Neither establishes that any full agent assessment works.

## Test safety and results

Mutating Mongo suites use generated UUID database names through explicit `dbName`; browser fixtures/API share an explicit generated `MONGODB_TEST_DB_NAME`, require test mode and reject unsafe names. Authenticated fixture helpers verify the connection before writes/cleanup. Teardown drops only its verified generated database. The original Mongo health check only pings/reads the ordinary target. The normal development database/accounts were not seeded, reset or deleted. No paid AI calls are in these test commands.

Final executed results (9 October 2026):

| Command | Result |
| --- | --- |
| `npm test` | 120 passed; 0 failed, cancelled or skipped. Includes all four roles through official Strands/GoogleModel mock transport and per-role hostile-output rejection. |
| `npm run test:mongo` | 59 passed; 0 failed, cancelled or skipped. Mutating checks used generated isolated databases. |
| `npm run test:e2e` | 86 passed (43 desktop, 43 mobile); 0 failed in the final clean run. Includes preserved Phase 1–6.5 workflows, same-event evidence refresh and citizen submission → municipal approval/assignment → history refresh → renewed login → cross-account/operator denial. |
| `$env:AQUASHIELD_BROWSER_DEV_PORT='5175'; npm run test:dev-origins` | 2 passed; localhost and 127.0.0.1 submission/persistence checks used a separate Vite/test API and isolated database. Existing unit checks also cover both default port-5173 origins. |
| `npm run lint` | Passed. |
| `npm run build` | Passed; production frontend built successfully. |
| `git diff --check` | Passed. |
| Live Gemini inference | Not run; awaiting the user's explicit authorization. |

Initial sandbox runs could not connect local HTTP/MongoDB test servers; permitted reruns resolved those environment restrictions. Earlier browser runs had six outdated test expectations, then four failures caused by concurrently shared trace folders and the new fixture's missing explicit CORS origin. Expectations, separate artifact directories and the fixture origin were corrected; all 86 checks passed in the final sequential suite. No tests were deleted or disabled to obtain this result. There are no outstanding failures in the executed final suites.

Phases 1–6.5 regression coverage passed. Persistent ordinary application records were preserved. No live-provider success, Phase 7 implementation, deployment or commit is claimed.
