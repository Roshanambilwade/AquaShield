# AquaShield

An intelligence and decision layer for emergency water management, by **AquaSentinels** for Environmental Hacks — Heat & Water Track.

**Phases 1–4 are implemented.** The overrides at the top of [AQUASHIELD_SPEC.md](AQUASHIELD_SPEC.md) and the requested phase scope take precedence over the full MVP requirements. Implementation stops after the Phase 4 admin dashboard and map. See [Phase 4 setup and verification](docs/phase4.md) and [Phase 3 calculations](docs/phase3.md).

**Strategy:** AWS will host the functioning application; it is not a mandatory AI/LLM provider. The next authorized phase builds explainable deterministic decision support. Strands Agents SDK, Amazon Bedrock and real LLM agents are optional future enhancements. No Phase 5 development or AWS deployment has been performed by this documentation update. See the [honest demo guide](docs/demo.md).

## Completed

- JavaScript npm workspaces: React + Vite in `apps/web`; Node.js + Express in `apps/api`.
- Responsive base layout, client-side routing, and a system status page.
- MongoDB connection through Mongoose, bounded timeouts, initial connection retries, and graceful shutdown.
- Root environment configuration, validation, and `.env.example` without real credentials.
- Explicit CORS origins, JSON size limits, consistent API errors, frontend error boundary, and status errors with retry.
- API/configuration tests, a read-only real MongoDB integration test, and desktop/mobile browser tests.
- Citizen reporting with device location capture, manual coordinates, or an explicitly approximate locality center.
- Household problem type, supply time, approximate shortage duration, water level, household size, and optional description/photo.
- MongoDB Report model, Zod validation, anonymous browser-owned history, and report confirmation/status pages.
- Size-limited JPEG/PNG photos, validated and re-encoded by Sharp with metadata removed; submission rate limiting.
- Repeatable simulated report seeding and real persistence tests, including reconnects and safe submission retries.
- Geographic/time clustering, duplicate/suspicious evidence handling, persisted shortage events and independently counted verified reports.
- Configurable deterministic confidence/severity, approximate affected-population estimates, elapsed shortage duration and explicit unknown inputs.
- Municipal shortage overview with an offline geographic zone map, LOW/MEDIUM/HIGH/CRITICAL badges, emerging evidence and inspectable calculation tables.
- Administrator provisioning, password hashing, expiring MongoDB sessions, role authorization and server-side logout.
- Protected command center with eight KPI cards, OpenStreetMap/Leaflet plus offline map fallback, private report layers, event filters/details, activity and evidence analytics.
- Explicit unknown operational values and an inactive AI-labeled placeholder in the current UI; no LLM execution, fleet, allocation, dispatch, delivery or forecasting workflow. The next phase will implement deterministic recommendations when explicitly authorized.

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
npm run build
npm run test:e2e
npm run test:dev-origins
npm run seed:demo
npm run admin:create
```

`test:mongo` requires a reachable MongoDB. The Phase 1 health test is read-only; Phase 2 persistence tests use a uniquely named temporary database and remove only that database afterward. Override their server URI with `MONGODB_TEST_URI` if needed. Browser tests use the configured application database, ensure the simulated demo reports exist, and delete only the exact non-demo report IDs they create. The labeled demo records remain available afterward.

Provision an administrator with `npm run admin:create`. Development generates a random password in the ignored `.local/admin-access.json` when `ADMIN_PASSWORD` is unset. Open `/admin` and sign in using that file. Existing accounts are never overwritten. Production provisioning requires explicit `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters). No public registration or shared default password exists. See [Phase 4](docs/phase4.md) for session/security details and map fallback.

## Citizen report workflow

1. Open `/` and choose **Report water shortage**.
2. Capture device location, enter coordinates, or select the approximate Panchavati locality center. Enter the actual area/locality separately if necessary. Location permission denial has a manual fallback; no map or geocoding service is required.
3. Choose the problem, household water level, and household size (1–100). Supply time and approximate duration may remain unknown; unknown values are stored as `null`, not made up.
4. Optionally add a description (up to 2000 characters) and a JPEG/PNG photo (up to 2 MB and 16 million input pixels). The server verifies the image, resizes it to at most 1280 × 1280, re-encodes as JPEG, and strips metadata.
5. Submit. The API saves a MongoDB report and the confirmation shows its ID and **Pending verification** status. Open the status page or `/my-reports` to retrieve the saved report. Refreshes read MongoDB, not a frontend mock.

A cryptographically random key is saved in browser local storage and sent in `X-Citizen-Token`. MongoDB stores only its SHA-256 hash. Private reports can be listed/read only with that key; knowing a report ID is insufficient. Clearing browser storage or using another browser loses access. This is anonymous access for this phase, not account authentication or cross-device history. Keep this limitation in mind before collecting real personal information.

The client sends a unique `submissionId`. Retrying an unchanged submission returns the existing report instead of creating another, including concurrent retries. POST submissions are limited to 30 per connection/IP per 15 minutes with an in-process limiter; production deployments will need appropriate proxy configuration and a shared limiter.

Household size is citizen-provided. Phase 3 derives approximate population, shortage confidence and severity in separate shortage events. Citizen reports remain pending field verification; no verification or edit endpoint is enabled. Public aggregate APIs never expose private report IDs, anonymous keys, descriptions, household coordinates or photos. Zone centers are averages of report coordinates, including explicitly approximate locality centers.

## Demo report data

Run `npm run seed:demo`, then open `/admin?demo=true` or `/my-reports?demo=true`. This inserts 66 deterministic fictional reports across Panchavati, Satpur, Indira Nagar, Nashik Road and Adgaon, plus simulated area/environment/incident context and derived shortage events. Panchavati is the critical hero scenario; the other zones demonstrate HIGH, MEDIUM, LOW and emerging evidence. Two repeat submissions and one conflicting-duration submission demonstrate exclusion from scoring. Re-running does not duplicate them or delete citizen submissions; it removes only the obsolete Phase 2 seed with its known fictional reporter key. Demo events use a fixed observation clock and never corroborate real citizen reports. Every displayed score is calculated from evidence. Demo seeding and demo shortage APIs are disabled in production.

The current default seed derives Panchavati's 89.5/100 CRITICAL severity, 97.6% shortage confidence and approximately 588 affected people from 37 eligible household submissions (40 total reports, including exclusions). Its 31 verified reports are simulated field checks. These are a computed snapshot, not fixed values to force into the database. No tanker assignment, future-risk forecast, agent run or AWS-hosted URL is supplied by seeding. Follow [docs/demo.md](docs/demo.md) and show only implemented capabilities.

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
| `MONGODB_TEST_URI`                            | Optional read-only MongoDB test target             | `MONGODB_URI`                                                                                      |
| `ADMIN_SESSION_HOURS`                         | Admin session lifetime, 0.1–24 hours               | `8`                                                                                                |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Provisioning command only; password ≥12 characters | Development can generate credentials; production requires email/password                           |

Only variables prefixed with `VITE_` are exposed to the browser. Never use that prefix for secrets. `.env` files, build output, dependencies, and local test artifacts are ignored by Git.

### CORS and local origins

Use `CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173` in the root `.env` for the default development server. These are distinct browser origins, even though both refer to this computer. Explicit environment values replace the defaults; add any different frontend port or host to that list. Restart the API after changing it. Production requires an explicit list such as `CORS_ORIGIN=https://your-frontend.example`; local origins are never added automatically in production.

Keep `VITE_API_BASE_URL=/api` for the Vite proxy. The proxy preserves the browser's Origin on report POST requests, so its backend target is not the frontend origin to allow. CORS runs before the report routes and handles preflights for JSON and `X-Citizen-Token`. The application uses that header for anonymous access and does not enable credentialed cross-origin cookies; no wildcard origin or credentials setting is needed.

`npm run test:dev-origins` runs real browser submissions from both local origins on port 5173 using the normal development command and root `.env`, without overriding `CORS_ORIGIN`. Locally it reuses an existing development server; otherwise ports 5000/5173 must be free so it can start one. CI requires a fresh server. It checks HTTP 201, MongoDB persistence, confirmation/history, and removes only its own test reports. This supplements the isolated preview-server browser suite.

Current admin authentication uses opaque MongoDB sessions, not `JWT_SECRET`. Redis and Mapbox placeholders are optional. Legacy `AI_PROVIDER=bedrock`, `BEDROCK_MODEL_ID`, `STRANDS_MODE` and `DEMO_AI_MODE` entries in the unchanged `.env.example` are inactive optional-future configuration; they neither load an SDK nor execute an agent. Report seeding and deterministic logic work without provider credentials or `DEMO_AI_MODE`. Future AWS deployment configuration is separate from optional AI-provider access.

## Routes

| Frontend route               | Behavior                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `/`                          | Citizen landing page and base layout                                           |
| `/report`                    | Water problem reporting form                                                   |
| `/report/success?id=<id>`    | Persisted report confirmation                                                  |
| `/my-reports`                | Anonymous browser-owned report history                                         |
| `/my-reports?demo=true`      | Clearly labeled simulated report history                                       |
| `/report/:id`                | Owner-only report details, verification status and aggregate shortage evidence |
| `/status`                    | API/database health, loading/error states, retry                               |
| `/login`                     | Administrator sign-in                                                          |
| `/admin`, `/admin/shortages` | Protected command center and shortage map/table                                |
| `/alerts`                    | Public aggregate shortage evidence; no private report/fleet layers             |
| `/alerts/:id`                | Public aggregate detail without private assessment context                     |
| `/admin?demo=true`           | Labeled deterministic multi-area demo                                          |
| `/admin/shortages/:id`       | Shortage evidence and numeric calculation details                              |
| `/admin/analytics`           | Protected evidence analytics                                                   |
| `/operator`                  | Operator workspace placeholder                                                 |
| Other paths                  | Friendly 404                                                                   |

| Method     | Backend route                                                              | Behavior                                                                           |
| ---------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| GET        | `/`                                                                        | Backend identity and API link                                                      |
| GET        | `/api`                                                                     | Phase/version and endpoint metadata                                                |
| GET        | `/api/health`                                                              | `200` when MongoDB responds to ping; `503` otherwise                               |
| POST       | `/api/reports`                                                             | Validate/save report; `201` new, `200` idempotent retry                            |
| GET        | `/api/reports`                                                             | This browser's history; `page` and `limit` pagination                              |
| GET        | `/api/reports?demo=true`                                                   | Public simulated reports only                                                      |
| GET        | `/api/reports/:id`                                                         | Owner-only details/photo, or a public demo report                                  |
| GET        | `/api/shortages`, `/api/shortages/:id`                                     | Refresh and return public aggregates; `?demo=true` selects only simulated evidence |
| POST       | `/api/shortages/detect`                                                    | Admin-only aggregate refresh; rate limited                                         |
| GET / POST | `/api/shortages/:id/severity`, `/api/shortages/:id/calculate-severity`     | Public inspect / admin-only refresh of deterministic severity                      |
| POST       | `/api/auth/login`, `/api/auth/logout`                                      | Rate-limited admin login / authenticated session revocation                        |
| GET        | `/api/auth/me`                                                             | Validate admin session and role                                                    |
| GET        | `/api/dashboard/summary`, `/api/dashboard/map`, `/api/dashboard/analytics` | Protected metrics/activity, map layers and analytics                               |
| GET        | `/api/dashboard/shortages/:id`                                             | Protected assessment context and recorded delivery history if available            |

Report POST/list require `X-Citizen-Token` (64 lowercase hexadecimal characters). All private reads are filtered by the hashed key. JSON errors remain consistent: `422` invalid report, `400` missing key, `404` unavailable report, `413` oversized payload, `429` rate limit, and `503` unavailable database. Photo contents are omitted from list/submission responses and included only in an authorized detail response.

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

The Report collection stores citizen-provided location/locality, supply details, household size, description, sanitized optional photo, anonymous owner hash, submission ID, timestamps, pending status, and a demo flag. JavaScript report options are shared between frontend and backend in `packages/shared/reportOptions.js`; there is no TypeScript shared-types package.

Citizen accounts, recommendations, forecasts, allocation, dispatch and delivery workflows are deferred. Phase 4 adds User/AdminSession collections and protected read-only dashboard services that reuse Phase 3 aggregates. The operator page retains the Phase 1 placeholder. Phase 3 adds Area and ShortageEvent collections and separate deterministic clustering, confidence, population, severity and fairness helper modules. Fairness helpers require supplied delivery evidence, leave unknown history unknown, and expose no allocation workflow. The transparent early-warning model is retained in the specification for a later phase; no prediction engine runs in the current application.

## Planned decision support and later phases

| Phase    | Planned work — not implemented yet                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 (next) | Read-only deterministic recommendations using existing evidence, severity/confidence and fairness helpers, with ranking rules, explanations, provenance and missing inputs; no LLM required |
| 6        | Tanker feasibility/selection, human-approved allocation, logistics/operator status, delivery OTP/QR verification and audit records                                                          |
| 7        | Deterministic early-warning risk and operational/fairness analytics                                                                                                                         |
| 8        | Full regression verification, hardening and actual AWS deployment after compatibility checks                                                                                                |
| 9        | Reproducible verified demo, final documentation/screenshots and deployment evidence in the video                                                                                            |

Each phase requires an explicit instruction and stops after its verification. Optional future Strands/Bedrock/LLM adapters may provide supplemental summaries; they never replace authoritative numeric calculations or human approval and are not MVP acceptance requirements.

## AWS deployment strategy — planned, not deployed

The AWS requirement is real application hosting with tested public frontend/backend URLs and database persistence, demonstrated in the final video. Prefer **AWS Amplify Hosting** for the existing static React/Vite frontend and **AWS App Runner** for the Express backend, with **MongoDB Atlas** allowed as the external database. Final service/configuration selection remains subject to account eligibility, runtime, build, routing, secrets and network compatibility checks; no cloud resources are provisioned in this task.

App Runner's eligibility is a required check: AWS stopped accepting new customers on April 30, 2026. Check the target account before selecting it; document a compatible AWS backend alternative if needed. [AWS service notice](https://aws.amazon.com/apprunner/)

Verify the existing npm-workspace/root-lockfile build, `apps/web/dist`, Node.js 22.13+, Sharp dependencies, backend start/port/readiness, Atlas connectivity and restricted access. Static hosting must use a tested hosted API base URL or explicit reverse proxy rather than assume Vite's local proxy exists. Preserve exact hosted-origin CORS, admin/citizen-token authorization, production demo restrictions and current tests. Assess in-process rate limits/detection before scaling across backend instances. Section 47–48 of the [specification](AQUASHIELD_SPEC.md) contains service documentation and the deployment acceptance checklist.

Do not claim AWS deployment from configuration placeholders, mock output or local-only screenshots. Publish actual service names, tested URLs and results only after successful public health/auth/report/dashboard/persistence checks. No AWS AI credentials, Strands SDK or Bedrock calls are required for that deployment.

Implementation stops after Phase 4. Later phases require a new instruction.
