# Deployment readiness and repository cleanup report

Date: 11 October 2026. Preparation only; no deployment, Git commit/push, data migration or live inference.

## Initial state and inspection

Branch `main`, HEAD `3de088e` (`done simulation`). The opening working tree contained the previous interrupted preparation's README edit plus untracked `amplify.yml`, `deploy/amplify-rewrites.json`, `deploy/backend.env.example` and `docs/deployment.md`. Those changes were preserved/refined; the new guide was renamed to the requested `docs/deployment-readiness.md`. Initial `git diff --check` identified a trailing README blank line, corrected without rewriting its existing sections.

Inspected root/API/web manifests and lockfile (npm lockfile v3, workspaces `@aquashield/web` and `@aquashield/api`), API and frontend entry points/clients, runtime, Mongoose configuration, health routes, CORS/authentication/session/error/rate middleware, provider/environment guards, Dockerfiles/Compose/ignore rules, previous readiness/reliability reports and existing startup/test/build scripts. The actual `.env` was inspected by field names only; no values were emitted. Its legacy unused fields were not removed or modified. No nested ignore or AGENTS files were found. Local/private files remain ignored.

## Changes and decisions

| File | Change/reason |
| --- | --- |
| `apps/api/src/config/env.js` | Reject local-only production Mongo hosts even with credentials/TLS, including replica lists and normalized IPv4-mapped IPv6. Existing SRV/TLS/auth/database guards, local defaults, pooling, retries and dotenv precedence remain. |
| `apps/api/test/readiness.test.js` | Add production-local URI rejection/development acceptance regression and protected database/configuration coverage. Existing assertions retained. |
| `amplify.yml` | One root-context npm workspace build for `apps/web`, Node 22, locked install, explicit HTTPS API requirement, `apps/web/dist` artifacts. No secrets or seed commands. |
| `deploy/amplify-rewrites.json` | Manual Amplify-console SPA rewrite configuration; no competing hosting build. |
| `deploy/backend.env.example` | Placeholder-only backend deployment settings; production disables all demo/simulation/preparation flags. |
| `.env.example` | Clarify local versus Atlas backend secret and Amplify public API build setting; no real values added. |
| `.gitignore` | Exclude private credentials JSON wherever saved and OS/editor temporary files. No ignored files deleted. |
| `README.md` | Link current deployment guide and accurately distinguish prepared hosting from unverified cloud/Atlas. |
| `docs/deployment-readiness.md` | Hosting/runtime/environment/network/Atlas/authentication/rollback guide, manual requirements and safe read-only ping. |
| `docs/deployment-readiness-report.md` | This actual-execution report. |

No tracked file was removed, no dependency/lockfile changed, no application page/business engine/provider implementation rewritten. Generated outputs, credentials, audit/screenshot evidence and databases were retained. Root lockfile manifests match the actual workspaces; a fresh isolated `npm ci` and build verifies installation without reinstalling the user's workspace.

Atlas already works through standard `MONGODB_URI`; no second connector or database selector was introduced. Production requires authenticated TLS and a named non-demo/test/simulation database; it cannot silently use the development fallback. Environment injection wins over dotenv. Demo/simulation database selectors are inactive because production rejects their activating flags; test-name overrides are forbidden. Backend listens on the platform port/all interfaces, retries bounded connection attempts, marks readiness unavailable until Mongo ping passes and supports bounded graceful shutdown. Startup neither seeds nor prepares records.

Amplify uses static Vite output and a public HTTPS backend URL, not a development proxy. Backend deployment uses the existing image Dockerfile, repository-root context, locked production API dependencies, shared runtime modules and non-root Node 22 entrypoint. No `apprunner.yaml` source-runtime method was added. App Runner eligibility is external: AWS now restricts new customers. The owner must verify account/region access before provisioning; an alternative would require a separately approved deployment decision.

## Verification record

Logs and read-only preservation fingerprints are ignored under `.local/deployment-*` and `.local/readiness-*`, with no private values in reports. Completed results follow.

- Initial focused readiness execution: exit 1 due to sandbox EACCES on local HTTP tests; Mongo preservation was likewise sandbox-blocked and its approved read-only retry passed.
- First approved `npm run verify`: exit 1, 202/203 unit/API tests passed. The new regression found driver normalization of `::ffff:127.0.0.1` to `::ffff:7f00:1`; the production host check was corrected. No assertion or timeout weakened.
- `node scripts/verifyCleanBuild.js`: exit 0. Fresh ignored source copy, locked `npm ci`, completed production build, eight generated files scanned and backend-secret canary absent. A pre-existing dependency deprecation warning was nonfatal.
- Isolated hosted build (`node .local/readiness-hosted-build.mjs`): exit 0, including the exact Amplify `npm ci --include=dev --no-audit --no-fund` command with `NODE_ENV=production`. Synthetic HTTPS API URL was found in the production bundle; backend-key canary and Mongo URI were absent across eight output files. No browser/main workspace build was overwritten by this check.
- Git-history pattern scan (`node .local/readiness-history-scan.mjs`): exit 0. 777 historical blobs inspected for Google/AWS access-key/private-key patterns, zero findings. This bounded pattern scan is not proof that every possible secret type is absent.
- `docker version --format '{{.Server.Version}}'`: exit 1, Linux engine pipe absent. Current image build/runtime unavailable; historical Phase 11 image testing is not claimed as a current pass. `test:containers` was not run because its prerequisite engine is unavailable.
- `docker compose --env-file .env.example config --quiet`: exit 0; local smoke configuration parsing only, not container execution or cloud acceptance.
- Hosting YAML/SPA JSON parsing and app-root/build-path/artifact/install-command assertions: exit 0 (`HOSTING_CONFIGURATION_PARSE_PASS`). Amplify's AWS build environment and `nvm use 22` itself remain untested locally on Windows.
- Final `npm run verify`: exit 0. All eight steps passed: **203 unit/API**, **131 Mongo integration**, lint, production frontend build, secret scan, configuration parsing, **132 desktop/mobile browser** and **2 localhost/127.0.0.1 development-origin** tests. Total **468** tests. Browser tests include all four `tests/e2e/simulation.spec.js` cases (desktop/mobile controls and full manual workflows), so the requested targeted browser command was not repeated redundantly. Existing citizen/admin/operator, report/photo/persistence, allocation, OTP/accounting, deterministic forecasts and provider-outage behavior passed without live Gemini.
- `npm run test:simulation`: exit 0, **14/14** tests, no failed/skipped tests. These repeat the simulation checks already present in full verification.
- `npm run test:acceptance-journey`: exit 0, **11/11** checks, three actual backend restarts, three persisted reports, one OTP-verified controlled delivery recording 3000 L and a 5000 L remaining balance. Zero provider calls; owned UUID cleanup completed. This is synthetic local acceptance, not real household delivery or live Atlas.
- Read-only protected-state comparison (`node .local/readiness-preservation.mjs --after`): exit 0. All sorted document fingerprints/collection inventories in the faculty demonstration and persistent `aquashield_simulation` databases matched the before-test baseline. Root `.env`, faculty/simulation credential files and `package-lock.json` byte fingerprints also matched. No protected persistent preparation/seed/reset was performed.
- Final `npm run security:check`: exit 0, 297 source files plus bundle inspected, no findings. Final `git diff --check`: exit 0. Specification/12 overrides were not changed. No tracked files deleted, dependencies upgraded, Git commit/push or deployment performed.

## External requirements and release limits

The Atlas connection string was neither requested in chat nor used. Actual Atlas DNS/TLS/ACL/permissions/write/restart tests remain unverified. AWS services, images, secrets, networks and public URLs were not created or changed. No broad Atlas IP allowlist is recommended: use restricted developer IP for a local ping and verified VPC/NAT Elastic IP or supported private networking for App Runner.

Pending owner actions: choose clean deployment data versus a separately authorized reviewed migration; configure Atlas project/cluster/database-scoped user/backups/network/secret; verify App Runner account eligibility/region, registry and image digest, secret-access roles, platform port/probe and outbound routes; configure Amplify origin/build setting/SPA rewrites; provision the first administrator explicitly; run public auth/ownership/report/persistence/manual-delivery smoke checks with controlled acceptance data. No demo credentials or records are copied.

Production simulation and demo AI remain disabled. Gemini remains optional for numerical services, with existing bounded real advice behavior; no calls were made. Process-local rate/circuit controls, trusted proxy/IP behavior, edge CSP/HSTS and cross-instance enforcement remain release review requirements; this task does not claim high-scale production certification. No paid service or new provider was introduced.
