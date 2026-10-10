# AquaShield

An intelligence and decision layer for emergency water management, by **AquaSentinels** for Environmental Hacks — Heat & Water Track.

**Phases 1–8, including Phase 6.5, are implemented locally; complete live Gemini execution remains unverified.** Phase 8 adds Gemini-independent numerical report-activity forecasts and audited early-warning alerts; see [formulas, APIs, data limits and verification](docs/phase8.md). Phase 7 adds persisted operator trips, deterministic route estimates, protected OTP verification, actual delivered litres, completion recovery, municipal history and private citizen response updates. See [Phase 7 behavior, demo, security and verification](docs/phase7.md), [Phase 6.5 accounts](docs/phase65.md), [Phase 6 operations](docs/phase6.md), [Phase 5 agents](docs/phase5.md), [Phase 4](docs/phase4.md) and [Phase 3 calculations](docs/phase3.md).

Phase 8 verification: 171 unit/API tests, 92 MongoDB tests and 104 desktop/mobile
browser tests passed, plus both development hostnames on isolated port 5175; lint/build passed. These tests use mocked providers or explicit demo mode.
See [requirement coverage, remaining blocker and manual citizen handoff](docs/through-phase7-audit.md).

Phase 9 prepares future deployment without deploying: production configuration guards,
liveness/readiness, safe runtime logs/shutdown, containers and locked clean builds.
Verification: 178 unit/API, 92 MongoDB, 104 desktop/mobile and two origin tests passed;
lint/build/secret checks and both npm audits passed. Docker engine execution and external
production checks remain pending. See the [readiness report](docs/phase9-deployment-readiness.md).

**Strategy:** AWS will host the functioning application; it is not a mandatory AI/LLM provider. Phase 5 integrates Strands Agents SDK with Google Gemini for four roles. All numeric facts remain deterministic backend calculations. On 10 October 2026, authorized live Crisis Detection, Logistics and Early Warning tests passed validation; Resource Allocation generation returned Google HTTP 503 and remains unverified. Bedrock is optional; AWS deployment has not been performed. See the [through-Phase-7 audit](docs/through-phase7-audit.md) and [honest demo guide](docs/demo.md).

## Completed

Gemini outages now use bounded retries/circuit recovery and explicitly labeled rule-based assessments where backend evidence supports them. See [AI reliability, configuration and limits](docs/ai-reliability.md). No new live Gemini verification is claimed by this update.

- JavaScript npm workspaces: React + Vite in `apps/web`; Node.js + Express in `apps/api`.
- Responsive base layout, client-side routing, and a system status page.
- MongoDB connection through Mongoose, bounded timeouts, initial connection retries, and graceful shutdown.
- Root environment configuration, validation, and `.env.example` without real credentials.
- Explicit CORS origins, JSON size limits, consistent API errors, frontend error boundary, and status errors with retry.
- API/configuration tests, a read-only real MongoDB integration test, and desktop/mobile browser tests.
- Citizen reporting with device location capture, manual coordinates, or an explicitly approximate locality center.
- Household problem type, supply time, approximate shortage duration, water level, household size, and optional description/photo.
- MongoDB Report model, Zod validation, citizen account-owned history, and report confirmation/status pages; legacy anonymous records remain preserved.
- Size-limited JPEG/PNG photos, validated and re-encoded by Sharp with metadata removed; submission rate limiting.
- Repeatable simulated report seeding and real persistence tests, including reconnects and safe submission retries.
- Geographic/time clustering, duplicate/suspicious evidence handling, persisted shortage events and independently counted verified reports.
- Configurable deterministic confidence/severity, approximate affected-population estimates, elapsed shortage duration and explicit unknown inputs.
- Municipal shortage overview with an offline geographic zone map, LOW/MEDIUM/HIGH/CRITICAL badges, emerging evidence and inspectable calculation tables.
- Administrator provisioning, password hashing, expiring MongoDB sessions, role authorization and server-side logout.
- Protected command center with eight KPI cards, OpenStreetMap/Leaflet plus offline map fallback, private report layers, event filters/details, activity and evidence analytics.
- Four Strands/Gemini agent roles, protected read-only APIs and a responsive recommendation panel with backend numeric evidence, source references, missing inputs and human-review status.
- Explicit key-free demo simulation, real-provider configuration/errors, bounded calls and validated output. Complete live Google assessment remains unverified after provider unavailability.
- Persisted tanker management, source-attributed fairness evidence, deterministic eligible-candidate selection, explicit approval/rejection/assignment, audit snapshots, concurrency checks and private operator assignment views.
- Database-backed ASSIGNED → EN_ROUTE → ARRIVED → DELIVERED trip controls, scrypt-hashed expiring delivery OTPs, actual litre accounting, conditional completion recovery, municipal delivery history and owner-scoped citizen response tracking. A designated citizen can retrieve a private, single-use delivery code from their own report after arrival; SMS is not required. Account participation is not independent identity or household-receipt verification. Demo OTP reveal remains fictional and non-production only. Phase 8 adds independent numerical report-activity forecasts; physical water forecasting is not supported.
- Logistics advice consumes persisted backend trip/route estimates without dispatch authority. Operational analytics show recorded assignments, water response by area, response times, snapshot fleet utilization and high-priority areas needing support review.

## Running locally

Use **Node.js 22.13+** and a running **MongoDB** instance (MongoDB 8 is suitable).
From the repository root:

```powershell
npm install --cache .local/npm-cache
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. The backend listens on `http://localhost:5000`.
Start MongoDB using your existing installation, or set `MONGODB_URI` in `.env` to your connection string. The default is `mongodb://127.0.0.1:27017/aquashield`.

The API stays reachable if MongoDB is unavailable; `/api/health` returns **503**, and initial connections are retried. After a successful connection, Mongoose handles reconnection. There is no in-memory database fallback.

```powershell
npm run lint
npm test
npm run test:mongo
npm run test:ai:live
npm run build
npm run test:e2e
npm run test:dev-origins
npm run seed:demo
npm run admin:create
```

`test:mongo` requires reachable MongoDB. Its health check is read-only; all mutating suites use generated UUID database names and drop only those databases. `MONGODB_TEST_URI` can select the test server. Browser fixtures and the test API share a generated, explicit test-only database; helpers verify it before account/report writes and cleanup. Final teardown verifies the exact database name before dropping it. Ordinary application records and accounts are preserved.

Provision an administrator with `npm run admin:create`. Development generates a random password in the ignored `.local/admin-access.json` when `ADMIN_PASSWORD` is unset. Open `/admin` and sign in using that file. Existing accounts are never overwritten. Production provisioning requires explicit `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters). No public administrator/operator registration or shared default password exists. See [Phase 4](docs/phase4.md) for session/security details and map fallback.

## Citizen report workflow

1. Register at `/register` with name, email and a password of at least 12 characters, then sign in at `/citizen/login`. Open `/` and choose **Report water shortage**. The backend assigns CITIZEN; public registration cannot create administrators or operators.
2. Capture device location, enter coordinates, or select the approximate Panchavati locality center. Enter the actual area/locality separately if necessary. Location permission denial has a manual fallback; no map or geocoding service is required.
3. Choose the problem, household water level, and household size (1–100). Supply time and approximate duration may remain unknown; unknown values are stored as `null`, not made up.
4. Optionally add a description (up to 2000 characters) and a JPEG/PNG photo (up to 2 MB and 16 million input pixels). The server verifies the image, resizes it to at most 1280 × 1280, re-encodes as JPEG, and strips metadata.
5. Submit. The API saves a MongoDB report and the confirmation shows its ID and **Pending verification** status. Open the status page or `/my-reports` to retrieve the saved report. Refreshes read MongoDB, not a frontend mock.

Citizen accounts reuse the existing scrypt password hashing and expiring, revocable MongoDB bearer sessions. The frontend retains the existing sessionStorage token key; refresh preserves the session, and sign-in from another browser retrieves account-owned history. The backend sets immutable report ownerId from authentication, never the request body. Another citizen cannot read a private report by ID. Old browser keys no longer authorize live reporting or private history; ownerless records remain preserved as legacy/imported for officer review. See [Phase 6.5](docs/phase65.md) for security assumptions and compatibility.

Login routes citizens to `/my-reports`, administrators to `/admin`, and operators to `/operator`, preserving an intended destination only for that role or a public page. Shared navigation/landing links show permitted portals; direct wrong-role URLs display a denial with a return link without discarding the valid session. Account/logout is available throughout the application. Sign out and authenticate as another provisioned account to use another role. See [portal access, root cause and verification](docs/portal-access.md).

Officers can review reporter names, email/contact verification state and supporting household evidence under `/admin/reports`. Names/contact/locality are user-provided; email ownership, identity and residency are not verified. No email/SMS provider, fake OTP or government ID is used. Public live clusters below the configured household threshold are withheld, coordinates of larger clusters are generalized, and household population breakdowns are suppressed. Authorized municipal views retain precise evidence. Agent snapshots omit citizen identity and household coordinates. Own history and status pages show recorded area approval/assignment without claiming household delivery. See [remediation policy and verification](docs/remediation.md).

The client sends a unique `submissionId`. Retrying an unchanged submission returns the existing report instead of creating another, including concurrent retries. POST submissions are limited to 30 per connection/IP per 15 minutes with an in-process limiter; production deployments will need appropriate proxy configuration and a shared limiter.

Household size is citizen-provided. Phase 3 derives approximate population, shortage confidence and severity in separate shortage events. Citizen reports remain pending field verification; no verification or edit endpoint is enabled. Public aggregate APIs never expose private report IDs, anonymous keys, descriptions, household coordinates or photos. Zone centers are averages of report coordinates, including explicitly approximate locality centers.

## Persistent faculty demonstration data

Follow [the persistent faculty guide](docs/demo-guide.md) for exact PowerShell configuration, private generated credentials and the full Phase 1–7 walkthrough. `npm run seed:demo` now requires `NODE_ENV=development`, `DEMONSTRATION_MODE=true`, `DEMO_SEED_ENABLED=true` and an explicitly named `DEMO_DATABASE_NAME=aquashield_demo`. It selects a separate database on the configured MongoDB server, preserving the normal application database and the real root `.env`. Production mode, missing flags and target mismatches are refused.

An empty safe target receives 16 citizen accounts, 9 operator accounts, 1 admin, 48 owned reports across 6 areas, 9 tankers, 5 municipal fairness evidence records, 12 allocations and 9 trips/deliveries. Six completed trips use genuinely generated/verified **demo** OTPs and record 3,000 simulated litres through the existing services. Panchavati remains the hero; the fictional sixth area has insufficient/emerging evidence. Severity/confidence/population are derived, not hardcoded. Re-seeding inserts missing records without deleting/resetting existing actions or submissions. It does not renew timestamps or observations. Credentials are private in ignored `.local/demo-credentials.json`; no default password/backdoor exists. Read the guide's freshness limitations before later demonstrations.

The server provides the demonstration environment banner and source context; newly registered citizens create no automatic reports. Explicit submissions become normal persisted, owned `CITIZEN_SUBMISSION` records alongside `DEMO_SEED` scenarios. Own history works at `/my-reports`, without `?demo=true`; the legacy public demo preview excludes owned records. No live Gemini call occurs during seed/startup/regression tests. Four-role mocked success and provider-outage fallback are tested separately from live inference. The opt-in live script supports guarded aggregate `--persisted-demo` evidence with no fallback; see the guide before authorizing quota/charges. AWS deployment remains deferred. Phase 8 numerical APIs/dashboard require no Gemini key; sparse demo history returns INSUFFICIENT_DATA.

Browser tests require an installed Microsoft Edge by default and a built frontend (`npm run build` first). They start isolated API/preview servers on **5100/4174**, so those ports must be free. For Chrome, set `$env:PLAYWRIGHT_CHANNEL='chrome'`. For Playwright Chromium, set `$env:PLAYWRIGHT_BROWSERS_PATH` to a directory inside this repository, run `npx playwright install chromium`, then set `$env:PLAYWRIGHT_CHANNEL='chromium'`.

`npm run dev:api` and `npm run dev:web` run either workspace independently. `npm run start` runs the API without a watcher. `npm run build` creates `apps/web/dist`. `npm run preview` serves that build at `http://localhost:4173` with an API proxy; add that exact origin to `CORS_ORIGIN` when using preview. Vite preview is for local verification. Production hosting needs SPA fallback to `index.html` and an API reverse proxy, or an absolute `VITE_API_BASE_URL`.

## Environment configuration

Both applications use the root `.env`. Shell values take precedence. Backend startup validates active configuration without exposing secrets. Restart the relevant process after changing `.env`; rebuild for changes to browser variables.

The frontend build explicitly sets `NODE_ENV=production`, so the backend's development setting in the shared `.env` does not turn the React build into a development bundle.

| Variable                                      | Purpose                                            | Default                                                                                            |
| --------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                    | `development`, `test`, or `production`             | `development`                                                                                      |
| `PORT`                                        | API port                                           | `5000`                                                                                             |
| `MONGODB_URI`                                 | MongoDB URI                                        | Local `aquashield` database                                                                        |
| `MONGODB_CONNECT_TIMEOUT_MS`                  | Connection/server selection timeout                | `5000`                                                                                             |
| `MONGODB_RETRY_INTERVAL_MS`                   | Initial connection retry delay                     | `5000`                                                                                             |
| `CORS_ORIGIN`                                 | Comma-separated exact origins; no trailing slash   | Development/test: `http://localhost:5173,http://127.0.0.1:5173`; required explicitly in production |
| `VITE_API_BASE_URL`                           | Public relative or absolute API base URL           | `/api`                                                                                             |
| `API_PROXY_TARGET`                            | Vite dev/preview proxy target                      | `http://127.0.0.1:<PORT>`                                                                          |
| `MONGODB_TEST_URI`                            | Optional MongoDB test server; mutating suites use isolated UUID databases             | `MONGODB_URI`                                                                                      |
| `ADMIN_SESSION_HOURS`                         | Admin session lifetime, 0.1–24 hours               | `8`                                                                                                |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Provisioning command only; password ≥12 characters | Development can generate credentials; production requires email/password                           |
| `ROUTING_BASE_URL` | Optional backend OSRM-compatible HTTPS endpoint | Empty; straight-line fallback |
| `ROUTING_AVERAGE_SPEED_KPH`, `ROUTING_TIMEOUT_MS` | Labeled average-speed ETA / service timeout | `25` km/h / `5000` ms |
| `DELIVERY_OTP_TTL_SECONDS`, `DELIVERY_OTP_MAX_ATTEMPTS`, `DELIVERY_OTP_REISSUE_SECONDS` | Bounded expiry, attempts and cooldown | `300` / `5` / `60` |

Only variables prefixed with `VITE_` are exposed to the browser. Never use that prefix for secrets. `.env` files, build output, dependencies, and local test artifacts are ignored by Git.

### CORS and local origins

Use `CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173` in the root `.env` for the default development server. These are distinct browser origins, even though both refer to this computer. Explicit environment values replace the defaults; add any different frontend port or host to that list. Restart the API after changing it. Production requires an explicit list such as `CORS_ORIGIN=https://your-frontend.example`; local origins are never added automatically in production.

Keep `VITE_API_BASE_URL=/api` for the Vite proxy. The proxy preserves the browser's Origin on report POST requests, so its backend target is not the frontend origin to allow. CORS runs before routes and handles JSON/Authorization preflights with explicit origins. Authentication uses bearer sessions rather than credentialed cross-origin cookies.

`npm run test:dev-origins` starts a separate test API and Vite server, never reuses a normal development server, and uses a UUID-named test database. It checks both localhost and 127.0.0.1. Port 5173 must be free, or set `AQUASHIELD_BROWSER_DEV_PORT` to a free port (for example 5175). Existing CORS unit tests also cover both default port-5173 origins. Browser fixture guards reject ordinary databases; teardown drops only the verified test database.

Current admin authentication uses opaque MongoDB sessions, not `JWT_SECRET`. Redis, Mapbox and Bedrock placeholders remain optional. Strands/Gemini use backend-only `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, configurable `GEMINI_MODEL_ID`, `DEMO_AI_MODE` and bounded `AI_TIMEOUT_MS` (default 15000). `.env.example` currently uses `DEMO_AI_MODE=false`; explicitly set true for key-free simulation. Absence defaults to false. Production rejects demo AI and fictional evidence. Any legacy `.env` value `AI_PROVIDER=bedrock` must be changed to `gemini` before real execution; `STRANDS_MODE` is unused.

Explicit demo mode needs no key, performs no provider calls and shows “Demo AI simulation — no Gemini execution.” For real mode set `DEMO_AI_MODE=false`, a backend-only key and an account-accessible model ID, then restart. Missing configuration or provider failure returns an explicit error; there is no silent demo/Bedrock fallback. Never prefix the key with `VITE_`, commit it, log it or return it to browsers. AWS authentication is separate.

`npm run test:ai:live` checks model access, then sends only fictional evidence through the actual Strands/Google provider, validates the response and prints safe stage/timing/error metadata. Missing key/model prints **SKIPPED**, not success. Live calls require explicit authorization and can incur charges. Three roles passed the 10 October checks; Resource Allocation returned Google HTTP 503. See [current per-role results](docs/through-phase7-audit.md) and [the full agent guide](docs/phase5.md).

## Routes

| Frontend route               | Behavior                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `/`                          | Citizen landing page and base layout                                                 |
| `/report`                    | Water problem reporting form                                                         |
| `/report/success?id=<id>`    | Persisted report confirmation                                                        |
| `/my-reports`                | Signed-in citizen's account-owned report history |
| `/my-reports?demo=true`      | Clearly labeled simulated report history                                             |
| `/report/:id`                | Owner-only report details, verification status and aggregate shortage evidence       |
| `/status`                    | API/database health, loading/error states, retry                                     |
| `/login`                     | Administrator sign-in                                                                |
| `/register`, `/citizen/login` | Public citizen registration and shared-session citizen sign-in |
| `/admin/reports`, `/admin/reports/:id` | Officer-only reporter source, contact and supporting evidence review |
| `/admin`, `/admin/shortages` | Protected command center and shortage map/table                                      |
| `/alerts`                    | Public aggregate shortage evidence; no private report/fleet layers                   |
| `/alerts/:id`                | Public aggregate detail without private assessment context                           |
| `/admin?demo=true`           | Labeled deterministic multi-area demo                                                |
| `/admin/shortages/:id`       | Shortage evidence and numeric calculation details                                    |
| `/admin/analytics`           | Protected evidence analytics                                                         |
| `/admin/tankers`             | Protected fleet management and operator provisioning |
| `/admin/allocations`         | Fair recommendations, review, approval/rejection and explicit assignment |
| `/operator`                  | Authenticated operator's own tanker and assignments |
| `/operator/assignment/:id`    | Owned assigned-job detail, route estimates and trip controls |
| `/admin/deliveries` | Protected trip/delivery history, actual litres, verification audits and recovery |
| `/admin` AI panel            | Four role assessments with explicit real/demo mode, evidence and human-review status |
| Other paths                  | Friendly 404                                                                         |

| Method     | Backend route                                                              | Behavior                                                                           |
| ---------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| GET        | `/`                                                                        | Backend identity and API link                                                      |
| GET        | `/api`                                                                     | Phase/version and endpoint metadata                                                |
| GET        | `/api/health`                                                              | `200` when MongoDB responds to ping; `503` otherwise                               |
| POST       | `/api/reports`                                                             | CITIZEN session; validate/save account-owned report; `201` new, `200` idempotent retry |
| GET        | `/api/reports`                                                             | CITIZEN account's history; `page` and `limit` pagination                            |
| GET        | `/api/reports?demo=true`                                                   | Public simulated reports only                                                      |
| GET        | `/api/reports/:id`                                                         | Owner-only details/photo, or a public demo report                                  |
| GET        | `/api/shortages`, `/api/shortages/:id`                                     | Refresh and return public aggregates; `?demo=true` selects only simulated evidence |
| POST       | `/api/shortages/detect`                                                    | Admin-only aggregate refresh; rate limited                                         |
| GET / POST | `/api/shortages/:id/severity`, `/api/shortages/:id/calculate-severity`     | Public inspect / admin-only refresh of deterministic severity                      |
| POST       | `/api/auth/login`, `/api/auth/logout`                                      | Rate-limited shared login / authenticated session revocation                       |
| GET        | `/api/auth/me`                                                             | Validate current CITIZEN, ADMIN or OPERATOR session                                 |
| POST | `/api/auth/register` | Strict public citizen registration with server-assigned role |
| GET | `/api/dashboard/reports`, `/api/dashboard/reports/:id` | ADMIN-only source/contact and report evidence |
| GET        | `/api/dashboard/summary`, `/api/dashboard/map`, `/api/dashboard/analytics` | Protected metrics/activity, map layers and analytics                               |
| GET        | `/api/dashboard/shortages/:id`                                             | Protected assessment context and recorded delivery history if available            |

**Phase 5 admin-only POST endpoints:** `/api/ai/detect`, `/api/ai/allocate`, `/api/ai/logistics`, `/api/ai/predict`, `/api/ai/recommend-allocation`. Accept only optional `eventId` and boolean `demo`; the two allocation routes share one implementation. Recommendations cannot assign/dispatch resources. See [request/response and error details](docs/phase5.md#protected-apis).

Live report POST/list/detail require the existing `Authorization: Bearer <session>` for a CITIZEN account. All private reads are filtered by backend-authenticated account ownership; `X-Citizen-Token` is no longer sufficient. JSON errors remain consistent: `422` invalid report, `401` missing/expired session, `403` wrong role, `404` unavailable report, `413` oversized payload, `429` rate limit, and `503` unavailable database. Photo contents are omitted from list/submission responses and included only in an authorized detail response. Public fictional reports remain available outside production through explicit demo mode.

Errors use the spec's format:

```json
{
  "success": false,
  "message": "The requested endpoint does not exist.",
  "code": "NOT_FOUND",
  "details": {}
}
```

Health additionally includes `data.service`, `data.status`, `data.database`, `data.uptimeSeconds`, and `data.timestamp`. It exposes no connection strings, credentials, or stack traces.

## Architecture and scope

```text
React / React Router
        | /api through Vite dev/preview proxy
Express routes -> health controller -> Mongoose -> MongoDB ping
               -> report controller -> validation/photo processing -> Report collection
        | centralized error middleware
```

Backend configuration, routes, controllers, and middleware are separate modules. Frontend pages, layout, API client, and status hook are separated. There are no TypeScript application files or shared-types package.

The Report collection stores citizen-provided household evidence, sanitized photo, server-assigned citizen ownerId, an internal reporter hash for duplicate detection, submission ID, timestamps, verification status and a demo flag. Legacy ownerless and demo records are retained without assigning them to real users. JavaScript report options are shared in `packages/shared/reportOptions.js`.

Phase 6 adds persisted fleet/allocation APIs and private operator assignments. Phase 6.5 ties report history to accounts. Phase 7 adds trusted delivery records, operator trip controls, protected OTP verification, recorded actual litres, standalone-MongoDB completion recovery and citizen area-response updates. Scoring, fairness, agents and allocation evidence remain authoritative backend logic. Phase 8 now adds bounded report-activity forecasting independently of Gemini; insufficient history stays unknown.

## Agent architecture and remaining phases

The API pins `@strands-agents/sdk@1.20.0` and `@google/genai@2.6.0`. Node 22.21.1 was verified; no TypeScript service is required. `Agent` uses the explicit `GoogleModel` provider, Zod structured output and one read-only evidence tool. Configuration, prompts, input construction, output validation, demo simulation and provider invocation live in separate backend modules. [Official SDK](https://github.com/strands-agents/sdk-typescript), [Google provider](https://strandsagents.com/docs/user-guide/sdk/model-providers/google/)

Crisis Detection explains evidence/verification; Resource Allocation explains backend priority/fairness limitations; Logistics identifies missing operational inputs; Early Warning explains current/trend evidence without inventing a risk score. Backend numeric facts are authoritative. Model prose remains subject to human review, and recommendation confidence stays null rather than an invented percentage.

| Phase | Status / scope                                                                                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5     | Implemented: four agent roles, protected APIs, dashboard panel, validated real-provider path and key-free demo mode. Complete live Gemini assessment remains unverified after provider unavailability. |
| 6     | Implemented: deterministic fair allocation, fleet management, approval/rejection, atomic assignment and operator visibility. |
| 7     | Implemented locally: route estimates, owned trips, private citizen-portal OTP handoff, demo OTP, recorded delivery and operational analytics. |
| 8     | Planned: full hardening and actual AWS deployment after compatibility/account checks.                                                                                      |
| 9     | Planned: final demo, documentation and verified deployment evidence.                                                                                                       |

Later phases require explicit authorization. Bedrock remains optional. The complete Phase 5 file inventory, API contract, limitations and test results are in [docs/phase5.md](docs/phase5.md).

## AWS deployment strategy — planned, not deployed

The AWS requirement is real application hosting with tested public frontend/backend URLs and database persistence, demonstrated in the final video. Prefer **AWS Amplify Hosting** for the existing static React/Vite frontend and **AWS App Runner** for the Express backend, with **MongoDB Atlas** allowed as the external database. Final service/configuration selection remains subject to account eligibility, runtime, build, routing, secrets and network compatibility checks; no cloud resources are provisioned in this task.

App Runner's eligibility is a required check: AWS stopped accepting new customers on April 30, 2026. Check the target account before selecting it; document a compatible AWS backend alternative if needed. [AWS service notice](https://aws.amazon.com/apprunner/)

Verify the existing npm-workspace/root-lockfile build, `apps/web/dist`, Node.js 22.13+, Sharp dependencies, backend start/port/readiness, Atlas connectivity and restricted access. Static hosting must use a tested hosted API base URL or explicit reverse proxy rather than assume Vite's local proxy exists. Preserve exact hosted-origin CORS, admin/citizen-token authorization, production demo restrictions and current tests. Assess in-process rate limits/detection before scaling across backend instances. Section 47–48 of the [specification](AQUASHIELD_SPEC.md) contains service documentation and the deployment acceptance checklist.

Do not claim AWS deployment from configuration placeholders, mock output or local-only screenshots. Publish actual service names, tested URLs and results only after successful public health/auth/report/dashboard/persistence checks. Bedrock calls and AWS model credentials are not required. Local Gemini integration does not prove AWS hosting; later hosting must also verify any agent-service build, protected internal boundary, Gemini outbound connectivity and backend-only secret injection. Local AWS CLI authentication is currently unavailable; verify deployment account access separately in that later phase.

Phase 9 prepares deployment configuration, health/readiness checks, safe runtime logs,
container definitions and a clean locked build. See [deployment readiness, exact
commands, file inventory and blockers](docs/phase9-deployment-readiness.md).
Actual deployment and dynamic simulation remain deferred. Implementation stops after Phase 9.

## Phase 7 API and verification

Authenticated ADMIN/OPERATOR: `GET /api/deliveries?demo=true|false` and
`GET /api/deliveries/:id`. Owning OPERATOR: `POST /api/deliveries/:id/start`,
`/arrive`, `/otp`, `/demo-otp`, `/verify` and `/complete`. ADMIN-only:
`POST /api/deliveries/:id/recover`. Inputs, limits, recovery policy and the exact
fictional UI walkthrough are documented in [docs/phase7.md](docs/phase7.md).
`POST /api/reports/:id/delivery-otp` supplies a private code only to the designated
authenticated citizen after arrival. Code retrieval is separate from ordinary
report/staff responses. Operator-triggered messaging still fails closed without
an external handoff adapter. Normal tests use isolated databases, mocked routing,
citizen portal handoff and controlled recipient adapters, not paid
services, live Gemini, production SMS or live GPS.
