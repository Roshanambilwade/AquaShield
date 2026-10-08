# AquaShield

An intelligence and decision layer for emergency water management, by **AquaSentinels** for Environmental Hacks — Heat & Water Track.

**Phase 1 only is implemented.** The overrides at the top of [AQUASHIELD_SPEC.md](AQUASHIELD_SPEC.md) and the requested phase scope take precedence over the full MVP requirements.

## Completed

- JavaScript npm workspaces: React + Vite in `apps/web`; Node.js + Express in `apps/api`.
- Responsive base layout, client-side routing, and a system status page.
- MongoDB connection through Mongoose, bounded timeouts, initial connection retries, and graceful shutdown.
- Root environment configuration, validation, and `.env.example` without real credentials.
- Explicit CORS origins, JSON size limits, consistent API errors, frontend error boundary, and status errors with retry.
- API/configuration tests, a read-only real MongoDB integration test, and desktop/mobile browser tests.

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
```

`test:mongo` requires a reachable MongoDB and only connects, pings, disconnects, and checks HTTP readiness. It does not create collections or write test records. Override its URI with `MONGODB_TEST_URI` if needed.

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
| `CORS_ORIGIN` | Comma-separated exact origins; no trailing slash | `http://localhost:5173` |
| `VITE_API_BASE_URL` | Public relative or absolute API base URL | `/api` |
| `API_PROXY_TARGET` | Vite dev/preview proxy target | `http://127.0.0.1:<PORT>` |
| `MONGODB_TEST_URI` | Optional read-only MongoDB test target | `MONGODB_URI` |

Only variables prefixed with `VITE_` are exposed to the browser. Never use that prefix for secrets. `.env` files, build output, dependencies, and local test artifacts are ignored by Git.

JWT, Redis, AWS, Bedrock, Strands, demo mode, and map placeholders in `.env.example` are reserved for later phases. They do not enable integrations in Phase 1.

## Routes

| Frontend route | Phase 1 behavior |
| --- | --- |
| `/` | Overview and base layout |
| `/status` | API/database health, loading/error states, retry |
| `/admin` | Municipal workspace placeholder |
| `/operator` | Operator workspace placeholder |
| Other paths | Friendly 404 |

| Method | Backend route | Behavior |
| --- | --- | --- |
| GET | `/` | Backend identity and API link |
| GET | `/api` | Phase/version and endpoint metadata |
| GET | `/api/health` | `200` when MongoDB responds to ping; `503` otherwise |

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
        | centralized error middleware
```

Backend configuration, routes, controllers, and middleware are separate modules. Frontend pages, layout, API client, and status hook are separated. There are no TypeScript application files or shared-types package.

Domain models, accounts, reporting, seeded data, maps, scoring, AI, AWS execution, allocation, dispatch, and delivery are deferred. Workspace pages are public placeholders with no private data. AWS remains mandatory for the eventual MVP; Strands + Bedrock integration is deferred to its requested phase and is not claimed as working here.

Implementation stops after Phase 1. Later phases require a new instruction.
