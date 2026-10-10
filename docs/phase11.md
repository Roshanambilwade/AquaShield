# Phase 11 — comprehensive testing and reliability

This is a regression and test-infrastructure phase. React/Express JavaScript, Gemini + Strands, the twelve specification overrides, authorization, numerical engines and operational application code are unchanged. No live inference, AWS deployment, dynamic simulation, ordinary/demo data reset or Git commit/push was performed. Passing these tests does not establish production readiness, independent household receipt or forecast accuracy.

## Inspection and confirmed gaps

The starting working tree was clean. Inspected the existing Phase 1–10 suites, README/specification and actual phase documents (including phase65, phase7, phase8, phase9-deployment-readiness, phase10, ai-reliability and demo-guide), workspace scripts, Playwright configuration/fixtures, database configuration, model/index declarations, role/session middleware, operational journals, analytics/prediction queries, provider reliability/validation, runtime shutdown and container configuration. There is no existing CI workflow directory. This phase supplies a portable local gate rather than claiming a configured hosted CI service.

Existing tests already cover most business acceptance criteria. Before edits, the approved baseline passed **185 unit/API and 103 MongoDB tests**. Gaps confirmed by inspection or execution:

1. No single ordered fail-fast verification command. Added `npm run verify`, with unit tests for nonzero exits, missing statuses, launch exceptions and terminated stages.
2. Test configuration could inherit normal/demo database targets and provider settings from the root environment; the legacy health test even pinged the configured application target. Automated entry points now explicitly select local/test MongoDB and blank provider credentials, disable persistent-demo/seeding/routing, and the health test uses its own UUID target. Individual synthetic tests can still explicitly enable their mocked/demo scenarios.
3. Browser configuration previously accepted an externally supplied UUID-shaped database name and teardown would drop it. The main Playwright process now always generates its own name; only Playwright workers inherit it. No test owns a caller-supplied browser database merely because its name looks safe.
4. During a full integration run overlapping a Docker image build, MongoDB socket timeouts caused failed teardown hooks to skip `disconnectDatabase()`, leaving a worker alive. A shared cleanup helper validates test mode, exact owned UUID name and active connection, bounds the drop command, and disconnects in `finally`. Failure remains a failed test. Failure-injection tests verify both deletion refusal and cleanup failure. Mongo integration files now run at most two at once, with a 120-second test ceiling; explicit simultaneous operation tests inside them are retained. Application timeouts were not increased. Docker/build work is run separately from integration workloads in the repeatable procedure.
5. Existing reconnect/login tests did not cover an entire HTTP lifecycle across actual backend process restarts. A new synthetic citizen-to-delivery test runs the real app/runtime in separate Node processes and restarts it during a trip and after completion.
6. Existing browser submission errors were primarily before commit. The new desktop/mobile regression commits a report through the actual API, drops the response, then retries from the retained form and proves the same submission ID, one Mongo report and one creation journal.
7. Added a bounded 5,001-report analytics fixture, assertions for preserved exact counts/unknown timings at the cap, one prediction query per summary, and independent analytics/audit rate-limit checks. No production load generator or dependency was added.

No confirmed defect required rewriting application business logic. New-test development corrected two test assumptions to match the existing contract: citizen OTP is `recipientOtp`, and an excessive delivered quantity is HTTP 422. No existing assertions were removed or weakened.

## Test architecture and repeatable commands

Requirements: Node 22.13+, installed locked npm dependencies, reachable local MongoDB (default `127.0.0.1:27017`), and the Playwright Edge browser used by the existing configuration. An alternative installed browser can be selected with `PLAYWRIGHT_CHANNEL`. Never point tests at an operational service account/server. `MONGODB_TEST_URI` explicitly selects a dedicated test server; test suites still generate their own UUID database names. Keep secrets out of command history.

```powershell
# From the repository root; install locked dependencies when needed:
npm ci
# Run all required offline gates, in order, with nonzero failure exit:
npm run verify
git diff --check
```

The runner executes these existing commands in sequence:

```powershell
npm test
npm run test:mongo
npm run lint
npm run build
npm run security:check
npm run config:check
npm run test:e2e
$env:AQUASHIELD_BROWSER_DEV_PORT='5175'
npm run test:dev-origins
Remove-Item Env:AQUASHIELD_BROWSER_DEV_PORT
```

`verify` sets port 5175 for development-origin testing unless explicitly overridden, preserving a user's 5173 server. Playwright refuses to reuse existing test servers on 5100/4174/5102. The runner builds before preview-browser testing. A failed stage stops subsequent stages; there are no automatic reruns or live-provider fallbacks. Configuration parsing in this runner checks the isolated test environment; production parser tests separately cover synthetic valid and invalid configurations. It does not validate a real cloud secret deployment.

Node's built-in test runner and Supertest remain the unit/API/Mongo framework. Playwright remains the desktop/mobile framework. The imported test bootstrap never changes the private `.env`. Existing suite-specific UUID names, test-only seeds and precise fixture cleanup are preserved. Shared cleanup is used by Mongo suites and browser suites owning separate databases; global browser teardown retains its exact-name check and `finally` disconnect. Normal operational and faculty demonstration databases are never dropped or reseeded. Failed infrastructure can leave an isolated test database behind; do not delete databases by wildcard or assume all UUID databases belong to this run.

Focused additions:

```powershell
Set-Location apps/api
node --import ../../scripts/testEnvironment.js --test test/reliability.test.js test/reliability.mongo.test.js
Set-Location ../..
npm run test:e2e -- tests/e2e/phase2.spec.js
```

## Acceptance coverage and evidence

| Area | Executed offline acceptance coverage |
| --- | --- |
| Phases 1–3 | Environment/CORS, health, strict report/photo validation, ownership and idempotency, deferred detection recovery, geographic/time clustering, suspicious/duplicate exclusion, unchanged severity/confidence/population calculations. |
| Phase 4 / 6.5 / portals | Register/login/logout, opaque hashed sessions, expired/revoked/disabled/role-changed accounts, cross-citizen and cross-operator denial, administrator-only mutation/read APIs, immutable citizen roles/verification, private household evidence, sanitized errors and navigation. Existing delayed-401 unit tests cover both clients and preserve a newer session. |
| Phases 6–7 | Authoritative eligibility/capacity/freshness/fairness, explicit approval/rejection, snapshot revalidation, concurrent reservations, assignment reconciliation, operator-only trip transitions, wrong/expired/replayed OTPs, concurrent verification/completion, bounded actual litres, interrupted completion recovery, exactly-once debit and committed audit metadata. |
| Complete lifecycle addition | HTTP citizen registration/login and three owned reports, municipal evidence review and ACTIVE event, recorded demand, eligible tanker/operator creation, recommendation replay, blocked unapproved/unauthorized assignment, approved concurrent assignment, cross-operator denial, competing starts, actual process restart while EN_ROUTE, arrival, designated citizen portal OTP with a wrong-code attempt, competing verification/completion, second process restart, persistent sessions/ownership, one 3,000-litre delivery, 5,000 litres remaining from 8,000, COMPLETED allocation, safe citizen response, analytics and one correlated completion audit. The live-source records are synthetic, not real field observations. Existing browser/DB tests separately retain clearly labeled demonstration OTP coverage. |
| Phase 8 | Exact documented EWMA/formulas/classification/horizons, UTC boundaries, duplicate/stale/invalid/insufficient evidence, future-review exclusion, repeat/concurrent evaluation, unique prediction/alert keys, optimistic acknowledge/resolve, escalation/reopening, audit integrity, history and provider-outage numerical availability. No numerical algorithm or threshold was changed. |
| Phase 10 | Inclusive/exclusive dates, action/cohort semantics, valid timing denominators, missing/reversed timestamps, duplicate joins, exact accepted litres, snapshot fleet utilization, area/provenance filtering, read-only persistence, strict audit filters/pagination/detail, actor/target/role/correlation/outcome transitions and sensitive-field redaction. |
| Runtime/security | Startup configuration rejection in an actual process without secret leakage, retry recovery without overlapping connections, graceful draining of an in-flight HTTP response before Mongo disconnect, bounded shutdown, health disconnect/reconnect, body limits, rate limits, exact CORS origins and safe error responses. Sessions are bearer tokens, not cookies; no secure-cookie guarantee is claimed. |
| Browser | Actual desktop 1440×1000 and mobile 390×844 flows for citizen/admin/operator portals, reports/history/map, allocation, trips/OTP, analytics/audit, predictions, loading/empty/insufficient/error states, retry, refresh and privacy. New lost-response-after-commit test proves retry cannot duplicate the saved report or audit. |

### Four agents: separate evidence categories

| Role | Mocked success and strict validation | Simulated outage / supported fallback |
| --- | --- | --- |
| Crisis Detection | Official Strands/GoogleModel mock transport plus persisted scenario tests; backend severity/confidence remain authoritative. Unsupported references, numbers and verification claims rejected. | RULE_BASED with original facts; weak evidence remains insufficient. |
| Resource Allocation | Same structured-output/evidence validation with authoritative fairness ordering and eligible candidates, not merely highest severity. | Validated deterministic recommendation; fresh evidence rechecked; no automatic approval/assignment. |
| Logistics | Backend trip/route evidence retained; no invented GPS, road facts, quantities or completion. | Existing authorized transitions, OTP, completion accounting and audit remain available. |
| Early Warning | Strict explanation of saved numerical facts; unsupported forecasts rejected. | Phase 8 supported calculations/retrieval/alert persistence and transitions remain independent; inadequate evidence is INSUFFICIENT_DATA. |

`ai.test.js`, `aiReliability.test.js`, `remediation.test.js`, `ai.mongo.test.js`, operations/delivery/prediction/demo Mongo tests and browser agent panels cover these distinctions. Failure injection includes HTTP 429/500/502/503/504, network/timeout, malformed/oversized/truncated/unfinished output, authentication/model/configuration errors, bounded retries and Retry-After, cancellation, ignored cancellation retaining occupied slots, cooldown, concurrency limits, single recovery probe, failed recovery and stale concurrent successes. Every accepted recommendation still passes evidence/schema validation. Agents have no write/dispatch tools.

**No live Gemini request was executed in Phase 11.** Mocked provider success is not live Gemini proof. The historical Resource Allocation live HTTP 503 remains unverified. Live testing remains separately authorized, potentially billable and outside normal automation; use the documented diagnostic procedure in ai-reliability.md/demo-guide.md only after authorization.

## Bounded workload and performance observations

Measured on Windows, Node 22.21.1, local MongoDB, existing pool bound of ten connections per API process. Integration execution uses two test files at a time; browser execution uses one worker. The new fixture inserts **5,001 synthetic legacy-shaped reports in two areas**, separate demo provenance, and builds the declared report indexes. Analytics retains total 5,001 and matching day counts, while timing calculations explicitly return CAPACITY_EXCEEDED/null. Mongoose debug counts query names only, never arguments: saved prediction retrieval executes **one aggregate**, independently of catalog area count, rather than one per area. One successful full-run measurement was **63 ms for analytics plus a second prediction-summary read** (fixture insertion/indexing excluded). This is a small local observation, not a throughput target, memory benchmark or production-scale capacity claim. Assertions test bounded behavior/counts, not a flaky wall-clock threshold.

Phase 8/10 aggregation caps and maxTimeMS, provider concurrency/deadlines and payload limits were reviewed. Older detection remains capped at 5,000 reports and still performs synchronous clustering. Some legacy area and report-response relationship queries rely on socket bounds and upstream dataset sizes rather than explicit result caps. Large imported histories, multi-process rate limiting, replica coordination, archival and memory-pressure testing remain production-hardening limitations; this phase does not replace those services with a worker architecture.

## Deployment checks and remaining limits

Optional checks, separate from the required offline runner:

```powershell
npm audit --json
npm audit --omit=dev --json
node scripts/verifyCleanBuild.js
docker version
docker compose --env-file .env.example config --quiet
docker build -f apps/api/Dockerfile -t aquashield-api:phase11 .
docker build -f apps/web/Dockerfile -t aquashield-web:phase11 .
npm run test:containers
```

The container smoke script uses only the explicitly built local images, a unique temporary Docker network/container names and a generated `aquashield_container_test_<UUID>` database on local MongoDB port 27017. Docker Desktop must support `host.docker.internal`. No root environment file or Gemini key enters the containers. It checks non-root users, absent backend `.env`, frontend SPA/static handling, protected API access, citizen reporting/idempotency, Mongo persistence and graceful API stop/restart. Cleanup removes only its generated containers/network/database. Images remain available for review. This is local HTTP smoke testing, not an AWS or production-TLS deployment.

Production TLS/authentication rules and demo refusal are tested with synthetic configuration. No real Atlas/cloud credentials, backup restoration, replica failover, multi-host stress, external SMS/routing, real household verification or prediction accuracy is established. The test disconnect/reconnect does not stop the user's MongoDB daemon or prove automatic driver recovery during every network partition. Browser tests use explicit demo or mocked provider behavior. Application security remains subject to the prior documented sessionStorage/XSS, external TLS/proxy/CSP, process-local limiter/circuit state and raw-DB audit-write limitations. No automatic database migrations or index provisioning against real data were performed.

## Observed results

Historical phase counts remain unchanged. Phase 11 adds **eight unit/API tests**, **three MongoDB tests** and **one browser scenario run on two viewports**. Observed verification on 10 October 2026:

| Command | Actual result |
| --- | --- |
| `npm run verify` | All eight stages passed and process exited zero. Its unit stage ran 192 tests; the final additional browser-database ownership regression was then included in the complete unit rerun below. |
| `npm test` (final) | **193 passed**, zero failures/cancellations/skips. |
| `npm run test:mongo` | **106 passed**, zero failures/cancellations/skips; bounded two-suite run took approximately 45 seconds including npm startup. |
| `npm run test:e2e` | **114 passed**, 57 desktop + 57 mobile, approximately 7.3 minutes. Existing assertions retained. |
| `npm run test:dev-origins`, port 5175 | **2 passed**, localhost and 127.0.0.1; actual report persistence/private retrieval. |
| `npm run lint` (final), `npm run build`, `npm run config:check`, `npm run security:check` (final), `git diff --check` | Passed; final secret check scanned 249 source files, zero findings, plus existing built output. |
| `npm audit --json` and `npm audit --omit=dev --json` | Zero vulnerabilities in both; network-enabled advisory checks, no dependency changes. |
| `node scripts/verifyCleanBuild.js` | Passed: fresh locked install and production build in a new ignored repository-local directory; synthetic backend secret absent from all eight scanned output artifacts. |
| Docker engine / Compose parsing | Engine 29.7.2 available; `docker compose --env-file .env.example config --quiet` passed. |
| API and frontend Docker builds | Both built successfully from the repository Dockerfiles with locked installs; images tagged `aquashield-api:phase11` and `aquashield-web:phase11`. |
| `npm run test:containers` | Passed, exit zero, including non-root users, HTTP health, SPA deep link, missing asset 404, role denial, report retry, actual Mongo document count and graceful stop/restart persistence. Its generated containers/network/database were cleaned up. |
| Twelve specification overrides / application code review | Overrides unchanged; **no application runtime source files modified**. |

Sandbox-denied localhost connections, Docker access, OneDrive resolution and npm workspace links were rerun with approved permissions. The separate overloaded integration run failed; it is not reported as a pass. Its cleanup failure motivated the shared helper, injected cleanup-failure regression and bounded test parallelism. No timeouts/assertions were weakened to conceal it. Existing nonfatal npm deprecation and terminal color warnings are not application failures. Test artifacts/logs are ignored under `.local/phase11-*`.

### Actual files changed

- `AQUASHIELD_SPEC.md`
- `README.md`
- `apps/api/package.json`
- `apps/api/test/ai.mongo.test.js`
- `apps/api/test/analytics.mongo.test.js`
- `apps/api/test/citizen.mongo.test.js`
- `apps/api/test/dashboard.mongo.test.js`
- `apps/api/test/delivery.mongo.test.js`
- `apps/api/test/demo.mongo.test.js`
- `apps/api/test/helpers/cleanup.js`
- `apps/api/test/helpers/runtimeProcess.js`
- `apps/api/test/mongo.test.js`
- `apps/api/test/operations.mongo.test.js`
- `apps/api/test/prediction.mongo.test.js`
- `apps/api/test/reliability.mongo.test.js`
- `apps/api/test/reliability.test.js`
- `apps/api/test/reports.mongo.test.js`
- `apps/api/test/shortages.mongo.test.js`
- `docs/phase11.md`
- `package.json`
- `playwright.config.js`
- `scripts/testEnvironment.js`
- `scripts/verify.js`
- `scripts/verifyContainers.js`
- `tests/e2e/persistent-demo.spec.js`
- `tests/e2e/phase10.spec.js`
- `tests/e2e/phase2.spec.js`
- `tests/e2e/phase6.spec.js`
- `tests/e2e/phase65.spec.js`
- `tests/e2e/phase7.spec.js`
- `tests/e2e/phase8.spec.js`
- `tests/e2e/portals.spec.js`
- `tests/e2e/remediation.spec.js`


## Pre-demo and pre-deployment checklist

1. Keep the private `.env` and demo credential file private. Use the faculty guide's persisted dataset; never reset it to make a test pass.
2. Run `npm run verify` against isolated test MongoDB and inspect the exit code. Keep failed logs separate from passing results; do not call mocks live AI.
3. Check actual demo freshness, tanker eligibility, actor roles and human approval requirements. Unknown evidence stays unknown. Demonstrate numerical insufficient-data honestly.
4. Before deployment, rerun locked clean build, dependency audit, container smoke and secret checks. Supply production configuration privately, run `npm run config:check -- --production`, and separately verify real TLS/database permissions/indexes, backup restoration and rollback.
5. Review unresolved scale/security/infrastructure gates. Only separately authorized deployment and verified public URLs can satisfy the AWS requirement. Stop at Phase 11; no Phase 12 or dynamic simulation is started.
