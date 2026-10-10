# Phase 9 — deployment readiness preparation

This prepares the existing JavaScript application for a future deployment. It does not deploy it. Phase 1–8 calculations, authentication, operational approvals, operator ownership, OTP, audits and persistent demo isolation are preserved. No new Gemini inference, provider change, production migration, seed/reset, dynamic simulation, cloud resource, paid service or commit is part of this task. All twelve specification overrides remain unchanged.

## Existing architecture and safeguards

- Node 22.13+ npm workspaces, locked dependencies. React/Vite builds static `apps/web/dist`; Express/Mongoose starts `apps/api/src/server.js`. Strands/Google GenAI stay inside the existing API service. No separate agent service, TypeScript conversion, Redis or additional database service is needed.
- MongoDB persists users, hashed opaque sessions, reports, shortage assessments, fleet, allocations, trips/deliveries, predictions and audited alerts. The database is external to the application container; replacing an application container must not replace its database.
- Existing validation, body/photo bounds, explicit CORS, role/owner checks, login/submission/expensive-operation limits, safe error envelopes, scrypt password/OTP hashing and conditional operational writes remain intact.
- Phase 8 calculations/persistence/retrieval do not import Gemini/Strands. Optional agent explanations consume completed facts. Existing bounded attempts/deadlines, retries, circuit/concurrency limits and labeled rule-based fallback remain unchanged. Missing numerical evidence returns `INSUFFICIENT_DATA`.
- Startup connects/retries with bounds but does not seed, reset, create application accounts, call Gemini or evaluate predictions. Models disable automatic index creation; application services explicitly ensure required indexes when their corresponding storage paths are first used.

## Environment contract

Never replace the existing private root `.env`. `.env.example` is a development template, not a production configuration. Environment injection takes precedence over root dotenv configuration. Supply production secrets through a future backend runtime secret mechanism; frontend settings are public build inputs. Do not copy a development/demo file wholesale to production.

| Setting | Production requirement |
| --- | --- |
| `NODE_ENV` | Explicitly `production` |
| `MONGODB_URI` | Explicit authenticated URI, named live database, validated TLS. `mongodb+srv` defaults to TLS; ordinary `mongodb` requires `tls=true` or `ssl=true`. Certificate/hostname bypass and disabled TLS are rejected, including case variants and repeated disabling options. Percent-encode credential characters. No `admin`, `local`, `config`, demo/test database target or development fallback. This preparation supports username/password connections; other authentication methods need a separately reviewed configuration. |
| `CORS_ORIGIN` | Exact comma-separated HTTPS frontend origins, no wildcard, path or trailing slash. Development retains localhost and 127.0.0.1 defaults; production adds none. |
| `PORT` | Hosting platform's injected port, 1–65535, default 5000. Server binds `0.0.0.0`. |
| `SHUTDOWN_TIMEOUT_MS` | 1000–30000 ms, default 10000. Configure platform termination grace longer than this deadline. |
| `MONGODB_CONNECT_TIMEOUT_MS`, `MONGODB_RETRY_INTERVAL_MS` | Bounded 100–60000 ms; defaults 5000. Health ping has a separate 2000 ms bound. |
| `DEMONSTRATION_MODE`, `DEMO_SEED_ENABLED`, `DEMO_AI_MODE` | Absent or `false`; production refuses any enabled flag. |
| `MONGODB_TEST_DB_NAME` | Must be absent in production. Test tools generate guarded UUID names themselves. |
| `ADMIN_SESSION_HOURS` | 0.1–24 hours, default 8; same opaque-session lifetime for all existing roles. |
| `AI_PROVIDER` | `gemini` (default); no new provider is configured. |
| `GEMINI_API_KEY`, `GEMINI_MODEL_ID` | Backend-only and optional for deterministic operation. Both are needed for real advice. Blank/missing configuration is not provider availability. Preserve the chosen model; no model/key changes were made here. |
| AI timeout/retry/circuit/concurrency settings | Existing bounded settings in `.env.example` and [AI reliability](ai-reliability.md); no changes to agent generation flow. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by explicitly invoked administrator provisioning. No default account/password; production provisioning needs both. Do not inject provisioning passwords into the frontend or retain them unnecessarily in normal API runtime. |
| `VITE_API_BASE_URL` | **Public build-time value:** `/api` with a real same-origin reverse proxy, or `https://<backend-host>/api` for separate hosting. No credentials, query, fragment, HTTP backend or protocol-relative URL. Changing runtime environment cannot change an already built bundle. |
| `API_PROXY_TARGET` | Development Vite proxy only; it does not configure Amplify, static hosting or `vite preview`. |
| Deterministic detection/fairness/routing/prediction/privacy settings | Existing validated settings/defaults in `.env.example`; review assumptions and thresholds for the real jurisdiction. Optional routing remains unnecessary for supported estimates. |

Production frontend builds permit only `VITE_API_BASE_URL` as application public configuration. Vite's internally generated `VITE_USER_NODE_ENV` is allowed only for its three standard mode values. No key, password or arbitrary `VITE_*` variable is accepted. The main backend/frontend remain JavaScript.

There is no JWT signing secret and no authentication cookie. Sessions use 64-character random bearer tokens, SHA-256 hashes stored in MongoDB, expiry, current role checks and logout/revocation. The frontend currently stores its token in sessionStorage. `Secure`, `HttpOnly` and `SameSite` cookie flags therefore do not apply. Production HTTPS, XSS protections, security-header/CSP review and backend/DB access controls are required. Do not add credentialed CORS or treat CORS as authorization. CORS does not reject origin-less service calls; privileged routes still require authentication.

## Operational behavior

| Endpoint | Meaning |
| --- | --- |
| `GET /api/health/live` | Process HTTP liveness, 200 without MongoDB or provider probe |
| `GET /api/health/ready` | Mongo ping: 200 connected, 503 disconnected/unavailable. Optional AI fields distinguish configuration, REAL/DEMO mode and `availability: NOT_PROBED`; AI is not required for readiness. |
| `GET /api/health` | Preserved Phase 1 health contract, including MongoDB-based 200/503 |
| Frontend container `GET /health` | Static server liveness only, not database/API readiness |

Health responses are non-cacheable and expose no URI, model key, private records or stack. They do not prove successful inference, authorization, index readiness or write permission. Provider availability is established only by separately authorized actual execution and its sanitized result, never inferred from configured credentials. Existing agent status/fallback/reliability logging remains separate.

Startup/shutdown emits allowlisted JSON events and numeric port/exit-code fields only; unknown fields, errors, headers and environment objects cannot enter these new logs. Configuration failures name fields only. Shutdown handles SIGINT/SIGTERM, cancels connection retry timers, closes idle HTTP connections, drains requests, awaits the bounded connection attempt and disconnects MongoDB. A deadline terminates a stuck shutdown with failure. API responses add `nosniff`, frame denial and no-referrer headers. Deployment-edge TLS/HSTS/CSP and external log policies remain pending.

## Local verification commands

From the repository root with installed Node/npm and the local MongoDB test server:

```powershell
npm ci
npm run config:check
npm test
npm run test:mongo
npm run lint
npm run build
npm run security:check
npm run test:e2e
# Preserve a user server on 5173:
$env:AQUASHIELD_BROWSER_DEV_PORT='5175'
npm run test:dev-origins
Remove-Item Env:AQUASHIELD_BROWSER_DEV_PORT
node scripts/verifyCleanBuild.js
npm audit --omit=dev
npm audit
git diff --check
```

Do not run mutating tests against a production server. Existing Mongo/browser mutating fixtures explicitly select generated, guarded UUID databases; their cleanup removes only those fixtures. The legacy connection/health test only pings the configured connection and performs no application writes. No `test:ai:live` belongs in this sequence. Test/build execution does not prove live Gemini acceptance.

`node scripts/verifyCleanBuild.js` creates a new ignored `.local/clean-build-<uuid>` directory, copies Git-visible source including proposed new files, installs with `npm ci`, builds from that fresh source and scans the output for an injected synthetic backend secret. No `.env`, private credentials, installed modules or old build output are copied. It leaves its disposable output in place and never deletes existing work. Package versions/integrity are locked; Linux image execution/digest reproducibility is still pending.

For read-only production **configuration parsing**, supply the intended settings privately in the process environment, then run `npm run config:check -- --production`. It does not connect to MongoDB, create indexes, write data or call Google. It will reject the normal development `.env` if production overrides are incomplete. A successful parse is not a production connectivity/security test.

## Container preparation

Root build context; no local Windows paths. `.dockerignore` excludes private environment files, `.local`, AWS credentials, Git internals, keys/certificates, backups, installed modules, tests and prior artifacts. API image installs locked API workspace dependencies with `--omit=dev`, copies only API/shared runtime code, uses non-root `node` and an exec-form Node entrypoint. Frontend uses a build stage; final nginx-unprivileged image contains only static assets/configuration, not Node/build dependencies. Both have bounded health checks.

The prepared nginx configuration serves SPA routes, rejects missing assets rather than returning HTML, proxies `/api/` to the private `api:5000` service, retains bounded reads and upload allowance, and disables URI/query access logging. The app's tighter report/body bounds still apply. Its `/api` proxy is a local same-origin option, not an Amplify rewrite configuration.

```powershell
docker version
docker build -f apps/api/Dockerfile -t aquashield-api:phase9 .
docker build -f apps/web/Dockerfile -t aquashield-web:phase9 .
# Locally validate configuration without displaying expanded secrets:
docker compose --env-file .env.example config --quiet
```

`compose.yaml` is **local smoke configuration only**: it overrides backend `NODE_ENV=development` to support loopback HTTP, disables every demo/seed/AI simulation flag, publishes only `127.0.0.1:8080`, waits for API readiness and starts no MongoDB/Redis/provider service. It cannot be used as production configuration. For a later local run, privately create `.local/containers.env` with only `MONGODB_URI` pointing to an explicitly disposable existing test server; a host MongoDB can be addressed as `host.docker.internal`, not container `127.0.0.1`. Never target live operational or faculty demo data for smoke mutations. Gemini keys are not passed by this local Compose file.

```powershell
docker compose --env-file .local/containers.env config --quiet
docker compose --env-file .local/containers.env up --build
# In another terminal: static /health and proxied /api/health/ready must be 200.
# Open http://localhost:8080 and verify SPA refresh, auth and owned reporting.
docker compose --env-file .local/containers.env down
```

These run commands are documented for future use; no containers were started. Compose `down` here removes application containers/network only, with no database service or volume declared. API cloud images require real production configuration/HTTPS origins and platform TLS termination. Set platform port/probe paths and termination grace deliberately. Before release pin approved Node/nginx image digests, build on the target Linux architecture, scan images (including native Sharp dependencies), inspect final dependency contents/user/secret exclusion and exercise readiness, persistence and SIGTERM in containers. Current default image tags are mutable and do not establish bit-identical images.

## MongoDB protection, backups and indexes

No schema/model migration was added. No persistent demo record, timestamp, credential or operational state was refreshed/reset. Seeding stays explicitly invoked through its existing production refusal, guarded database names and insert/preserve behavior; never include it in an image command, startup, health check, CI against production or cloud build. The faculty database's 48 reports remain deliberately insufficient for historical numerical prediction; do not manufacture history.

For future production use a dedicated live database/user with least privilege, authenticated TLS, restricted network access and reviewed connection pool/timeouts. No public unrestricted DB endpoint or wildcard IP allowlist. Administrative/backup privileges should be separate from runtime access. Unique indexes and TTL session cleanup must be reviewed before traffic is admitted. Current services lazily call `createIndexes()`; this can require index permissions and fail on historical duplicates. Plan approved index creation against a backed-up database; inspect existing keys/duplicates and capacity first. Do not run `syncIndexes()`, drop indexes/collections, assume a health ping verified all indexes, or claim a migration was executed.

Backup/restore is a **future procedure, not an executed check**. MongoDB Database Tools (`mongodump`, `mongorestore`) are not installed here. Select tools compatible with the actual server/version and review the [official backup guidance](https://www.mongodb.com/docs/database-tools/mongodump/) and [restore guidance](https://www.mongodb.com/docs/database-tools/mongorestore/).

1. Obtain authorization for a consistent backup, retention policy and restricted encrypted storage. Account for concurrent writes; use the selected managed snapshot/point-in-time facilities or an approved coordinated dump procedure. A live standalone dump alone is not a proven multi-collection recovery point.
2. Keep credential-bearing Database Tools YAML configuration private under ignored `.local`, with file permissions restricted to the operator. Do not put URIs/passwords on visible command lines or print the file. Keep dumps out of Git, Docker context, recordings and unintended folder synchronization; this repository is inside OneDrive. Future secret/backup storage locations need their own access review.
3. For an authorized dump, after creating `.local/backups` and privately supplying the tools config (URI/password supported by the chosen tool version), the command shape is:

   ```powershell
   mongodump --config=.local/backup-tools.yml --archive=.local/backups/aquashield.archive --gzip
   ```

4. Verify encrypted storage, checksum, completeness, retention and access. A successful dump alone does not prove restorability.
5. Restore only into a **fresh isolated recovery server/database** with a separate private config, never onto the configured live/demo/test fixture DB. Abort if the target already contains records; do not use `--drop`. For a source namespace `aquashield.*` and fresh target `aquashield_restore_validation.*`, the reviewed command shape is:

   ```powershell
   mongorestore --config=.local/restore-tools.yml --archive=.local/backups/aquashield.archive --gzip --nsFrom='aquashield.*' --nsTo='aquashield_restore_validation.*'
   ```

6. Validate counts, index definitions, ownership/session restrictions, embedded audit continuity, trip/allocation/tanker balances, prediction history and OTP privacy without displaying private records. Record recovery-time/point results. Cutover/rollback needs separate authorization; nothing here changes a production connection or restores data.

## Future hosting comparison

| Option | Fit and remaining checks |
| --- | --- |
| Amplify Hosting + eligible App Runner + Atlas | Preferred specification option for static React and persistent Express API. Amplify needs npm-workspace/root build support, Node compatibility, `npm ci`/`npm run build`, artifact `apps/web/dist`, public HTTPS API build value and SPA rewrites excluding assets/API. App Runner must run this Node/native dependency stack, expose its injected port, probe `/api/health/ready`, permit DB/Gemini HTTPS egress, inject secrets and support adequate shutdown grace. Target account eligibility is unresolved. |
| Amplify + AWS container alternative + Atlas | Compare ECS Express Mode or another supported AWS container path if App Runner is unavailable. Reuse the prepared API image only after Linux/native dependency/health/security verification. Account access, network/secret/role/ingress/egress/cost suitability remain unverified. Do not provision during this task. |
| Local Compose + existing disposable MongoDB | Useful future smoke exercise; no cloud, extra database service or deployment proof. HTTP development mode is loopback-only. Production needs separately reviewed TLS/network configuration. |

[AWS App Runner's notice](https://aws.amazon.com/apprunner/) says it no longer accepts new customers starting 30 April 2026; existing services continue, with no new features planned. Verify account eligibility before selecting it. [Amplify monorepo guidance](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html) supports npm workspaces; actual appRoot/buildPath/artifact settings and `AMPLIFY_MONOREPO_APP_ROOT` must be verified in the later authorized deployment. No final cloud architecture or infrastructure was created.

## Security results and deployment gates

| Gate | Status / evidence |
| --- | --- |
| Required production config / rejected insecure demo targets | PASS: parser regressions and sanitized synthetic production configuration check; no real connection attempted |
| Mongo health and Gemini-independent readiness | PASS: HTTP tests plus real Mongo ping/disconnect test; provider never probed |
| Privileged/owned flows and numerical provider-outage behavior | PASS: preserved Phase 1–8 unit, Mongo and browser regressions; no live AI claim |
| Shutdown/retry cancellation and secret-free runtime fields | PASS: SIGTERM, cleanup/idempotency, stuck attempt deadline and allowlist tests |
| Locked clean source install/build and backend-secret canary | PASS: fresh ignored source copy, `npm ci`, build and eight output files scanned |
| Frontend production build and public configuration guards | PASS: build and regression checks |
| Secret exclusions / tracked-source/bundle heuristic scan | PASS: `npm run security:check`; no matching credentials/key artifacts tracked. Not a comprehensive secret-history or external security audit. |
| Dependency advisories | PASS: production and full npm audits report zero vulnerabilities after targeted patch. Previous critical `shell-quote` issue removed by concurrently 9.2.4 → 9.2.5, shell-quote 1.9.0 → 1.12.0. No framework/provider upgrade. |
| Local Compose configuration | PASS: `docker compose --env-file .env.example config --quiet`, using harmless template values |
| Linux container build/run, native Sharp and final images | PENDING: Docker CLI 29.7.2 installed but Linux engine pipe unavailable even outside sandbox; attempted API build could not connect. No image build/run pass claimed. |
| Base-image digest pinning / vulnerability scan | PENDING: select/build/scan actual images once engine/target is available |
| Cloud account/runtime/service compatibility, HTTPS/CSP/HSTS, secret injection, database ACL/network and cloud logs | PENDING: no cloud infrastructure inspected/changed; external production assessment required |
| Trusted proxy configuration and multi-instance limits | PENDING: Express retains `trust proxy=false`; current limit/circuit/detection/evaluation coordination is per process. Behind a proxy callers can share one apparent IP; before deployment choose verified trusted proxy topology and review abuse/availability behavior. Do not blindly trust forwarded headers. Cross-instance coordination requires later hardening. |
| Backups/restore, historical index/uniqueness audit and capacity/load/security assessment | PENDING: no real data mutation, migrations or tools installed/run |
| Real numerical accuracy / complete four-role live Gemini acceptance | PENDING: historical data inadequate; historical Resource Allocation live failure remains unverified. Offline regressions are not live-provider or physical-prediction proof. |
| Public AWS URLs/auth/report/persistence/SPA acceptance | PENDING: deployment deferred; no URLs invented |

Before deployment: resolve every infrastructure/container gate; review database permissions and index creation, secrets rotation, browser XSS/security policy, proxy rate-limit behavior, backup restore drill, load/timeout/concurrent-operation handling and logs. Retain separate evidence for actual provider execution. Only after separately authorized deployment verify public direct navigation/refresh, health/readiness, ADMIN/CITIZEN/OPERATOR boundaries, owned report persistence across reconnect, shortage/map/operations/OTP and numerical APIs with an unavailable provider. Record actual URLs/configuration/version and rollback procedure; local readiness alone is not a production release certificate.

## Executed commands and results — 10 October 2026

- `npm test`: **178 passed**, zero failed/skipped, including seven new readiness/config/build-env/runtime tests.
- `npm run test:mongo`: **92 passed**, zero failed/skipped. The read-only health case additionally verifies live/ready before and after disconnect.
- `npm run test:e2e`: **104 passed** (52 desktop + 52 mobile), covering the preserved Phase 1–8 workflows, role boundaries and numerical outage behavior with explicit fixtures/mocked providers.
- `$env:AQUASHIELD_BROWSER_DEV_PORT='5175'; npm run test:dev-origins`: **2 passed**, both hostnames with report persistence; user's 5173 server preserved.
- `npm run lint`, `npm run build`, `npm run config:check`, synthetic `npm run config:check -- --production`, `npm run security:check`, `git diff --check`: passed.
- `node scripts/verifyCleanBuild.js`: passed after sandbox workspace-link restriction was resolved by an approved rerun. Fresh install/build; synthetic backend secret absent from all eight output artifacts.
- `npm audit --json` and `npm audit --omit=dev --json`: zero findings after `npm update concurrently --ignore-scripts`. Initial production audit was already clean; initial full audit had two critical affected-package entries for the same shell-quote advisory. `npm update shell-quote --ignore-scripts` alone changed nothing because concurrently pinned it, leading to the targeted runner patch.
- `docker version` (also outside sandbox): client 29.7.2, engine unavailable. Compose `config --quiet`: passed. `docker build -f apps/api/Dockerfile -t aquashield-api:phase9 .`: blocked by the missing engine, not an image build success. Frontend container execution is consequently unverified.

Initial sandbox HTTP tests returned localhost EACCES and Vite encountered OneDrive EPERM; approved reruns passed. These were environmental failures, not skipped regressions. Logs/check artifacts stay in ignored `.local/phase9-*`. No live inference, cloud change, migration, reset, seed operation, automatic stage/commit/push or Phase 10 work occurred.

## Complete source/document inventory for this task

Added: `.dockerignore`, `compose.yaml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `deploy/nginx.conf`, `apps/api/src/runtime.js`, `apps/api/src/scripts/checkConfig.js`, `apps/api/test/readiness.test.js`, `apps/web/scripts/buildEnv.js`, `scripts/checkSecrets.js`, `scripts/verifyCleanBuild.js`, this document.

Modified: `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `apps/api/package.json`, API `src/app.js`, `src/config/env.js`, `src/controllers/healthController.js`, `src/routes/index.js`, `src/server.js`, `test/app.test.js`, `test/env.test.js`, `test/mongo.test.js`, web `scripts/build.js`, `README.md`, `AQUASHIELD_SPEC.md`. Business engines, agent prompts/provider, models, application pages and the real `.env` were not edited. Phase 9 stops here; actual deployment remains deferred.
