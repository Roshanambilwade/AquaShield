# AquaShield

An intelligence and decision layer for emergency water management, by **AquaSentinels** for Environmental Hacks — Heat & Water Track.

**Phases 1 and 2 are implemented.** The overrides at the top of [AQUASHIELD_SPEC.md](AQUASHIELD_SPEC.md) and the requested phase scope take precedence over the full MVP requirements. Phase 3 has not been started.

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
```

`test:mongo` requires a reachable MongoDB. The Phase 1 health test is read-only; Phase 2 persistence tests use a uniquely named temporary database and remove only that database afterward. Override their server URI with `MONGODB_TEST_URI` if needed. Browser tests use the configured application database, ensure the simulated demo reports exist, and delete only the exact non-demo report IDs they create. The labeled demo records remain available afterward.

## Citizen report workflow

1. Open `/` and choose **Report water shortage**.
2. Capture device location, enter coordinates, or select the approximate Panchavati locality center. Enter the actual area/locality separately if necessary. Location permission denial has a manual fallback; no map or geocoding service is required.
3. Choose the problem, household water level, and household size (1–100). Supply time and approximate duration may remain unknown; unknown values are stored as `null`, not made up.
4. Optionally add a description (up to 2000 characters) and a JPEG/PNG photo (up to 2 MB and 16 million input pixels). The server verifies the image, resizes it to at most 1280 × 1280, re-encodes as JPEG, and strips metadata.
5. Submit. The API saves a MongoDB report and the confirmation shows its ID and **Pending verification** status. Open the status page or `/my-reports` to retrieve the saved report. Refreshes read MongoDB, not a frontend mock.

A cryptographically random key is saved in browser local storage and sent in `X-Citizen-Token`. MongoDB stores only its SHA-256 hash. Private reports can be listed/read only with that key; knowing a report ID is insufficient. Clearing browser storage or using another browser loses access. This is anonymous access for this phase, not account authentication or cross-device history. Keep this limitation in mind before collecting real personal information.

The client sends a unique `submissionId`. Retrying an unchanged submission returns the existing report instead of creating another, including concurrent retries. POST submissions are limited to 30 per connection/IP per 15 minutes with an in-process limiter; production deployments will need appropriate proxy configuration and a shared limiter.

Household size is citizen-provided. No wider affected population, shortage confidence, severity, or emergency response is inferred in Phase 2. Reports remain pending; no verification or edit endpoint is enabled yet.

## Demo report data

Run `npm run seed:demo`, then open `/my-reports?demo=true` using **View simulated demo reports**. This inserts 12 deterministic, fictional reports with fixed sample dates. Re-running the command does not duplicate them or delete citizen submissions. Seeded records and coordinates are clearly labeled simulated. They are publicly readable demo records and kept separate from private history. The seed command is disabled when `NODE_ENV=production`.

Browser tests require an installed Microsoft Edge by default and a built frontend (`npm run build` first). They start isolated API/preview servers on **5100/4174**, so those ports must be free. For Chrome, set `$env:PLAYWRIGHT_CHANNEL='chrome'`. For Playwright Chromium, set `$env:PLAYWRIGHT_BROWSERS_PATH` to a directory inside this repository, run `npx playwright install chromium`, then set `$env:PLAYWRIGHT_CHANNEL='chromium'`.

`npm run dev:api` and `npm run dev:web` run either workspace independently. `npm run start` runs the API without a watcher. `npm run build` creates `apps/web/dist`. `npm run preview` serves that build at `http://localhost:4173` with an API proxy; add that exact origin to `CORS_ORIGIN` when using preview. Vite preview is for local verification. Production hosting needs SPA fallback to `index.html` and an API reverse proxy, or an absolute `VITE_API_BASE_URL`.

## Environment configuration

Both applications use the root `.env`. Shell values take precedence. Backend startup validates active configuration without exposing secrets. Restart the relevant process after changing `.env`; rebuild for changes to browser variables.

The frontend build explicitly sets `NODE_ENV=production`, so the backend's development setting in the shared `.env` does not turn the React build into a development bundle.

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` | `development` |
| `PORT` | API port | `5000` |
| `MONGODB_URI` | MongoDB URI | Local `aquashield` database |
| `MONGODB_CONNECT_TIMEOUT_MS` | Connection/server selection timeout | `5000` |
| `MONGODB_RETRY_INTERVAL_MS` | Initial connection retry delay | `5000` |
| `CORS_ORIGIN` | Comma-separated exact origins; no trailing slash | Development/test: `http://localhost:5173,http://127.0.0.1:5173`; required explicitly in production |
| `VITE_API_BASE_URL` | Public relative or absolute API base URL | `/api` |
| `API_PROXY_TARGET` | Vite dev/preview proxy target | `http://127.0.0.1:<PORT>` |
| `MONGODB_TEST_URI` | Optional read-only MongoDB test target | `MONGODB_URI` |

Only variables prefixed with `VITE_` are exposed to the browser. Never use that prefix for secrets. `.env` files, build output, dependencies, and local test artifacts are ignored by Git.

### CORS and local origins

Use `CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173` in the root `.env` for the default development server. These are distinct browser origins, even though both refer to this computer. Explicit environment values replace the defaults; add any different frontend port or host to that list. Restart the API after changing it. Production requires an explicit list such as `CORS_ORIGIN=https://your-frontend.example`; local origins are never added automatically in production.

Keep `VITE_API_BASE_URL=/api` for the Vite proxy. The proxy preserves the browser's Origin on report POST requests, so its backend target is not the frontend origin to allow. CORS runs before the report routes and handles preflights for JSON and `X-Citizen-Token`. The application uses that header for anonymous access and does not enable credentialed cross-origin cookies; no wildcard origin or credentials setting is needed.

`npm run test:dev-origins` runs real browser submissions from both local origins on port 5173 using the normal development command and root `.env`, without overriding `CORS_ORIGIN`. Locally it reuses an existing development server; otherwise ports 5000/5173 must be free so it can start one. CI requires a fresh server. It checks HTTP 201, MongoDB persistence, confirmation/history, and removes only its own test reports. This supplements the isolated preview-server browser suite.

JWT, Redis, AWS, Bedrock, Strands AI demo mode, and map placeholders in `.env.example` are reserved for later phases. Report seeding works independently of `DEMO_AI_MODE`; no AI integration is enabled.

## Routes

| Frontend route | Behavior |
| --- | --- |
| `/` | Citizen landing page and base layout |
| `/report` | Water problem reporting form |
| `/report/success?id=<id>` | Persisted report confirmation |
| `/my-reports` | Anonymous browser-owned report history |
| `/my-reports?demo=true` | Clearly labeled simulated report history |
| `/report/:id` | Individual report details and pending status |
| `/status` | API/database health, loading/error states, retry |
| `/admin` | Municipal workspace placeholder |
| `/operator` | Operator workspace placeholder |
| Other paths | Friendly 404 |

| Method | Backend route | Behavior |
| --- | --- | --- |
| GET | `/` | Backend identity and API link |
| GET | `/api` | Phase/version and endpoint metadata |
| GET | `/api/health` | `200` when MongoDB responds to ping; `503` otherwise |
| POST | `/api/reports` | Validate/save report; `201` new, `200` idempotent retry |
| GET | `/api/reports` | This browser's history; `page` and `limit` pagination |
| GET | `/api/reports?demo=true` | Public simulated reports only |
| GET | `/api/reports/:id` | Owner-only details/photo, or a public demo report |

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

Accounts, maps, clustering, confidence/severity scores, shortage dashboards, AI, AWS execution, allocation, dispatch, and delivery are deferred. Municipal/operator pages retain the Phase 1 placeholders. AWS remains mandatory for the eventual MVP; Strands + Bedrock integration is deferred to its requested phase and is not claimed as working here.

Implementation stops after Phase 2. Later phases require a new instruction.
