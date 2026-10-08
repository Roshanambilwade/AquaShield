# Phase 4 — administrator command center and map

This phase adds administrator access and read-only municipal evidence tools. It reuses Phase 3 shortage events, confidence, severity and population logic. No deterministic scoring module, report submission service or seed inputs were rewritten. Phase 5 AI agents, AWS calls, forecasting, tanker allocation, dispatch and delivery workflows are not enabled.

## Run and sign in

1. Keep MongoDB running and configure the repository root `.env` using `.env.example`.
2. Run `npm run admin:create`. Development generates a random password when `ADMIN_PASSWORD` is unset and saves credentials in the Git-ignored `.local/admin-access.json`. There is no shared default password. An existing account is never overwritten or promoted.
3. Run `npm run seed:demo` and `npm run dev`.
4. Open `http://127.0.0.1:5173/admin?demo=true`, sign in using the provisioned credentials, and inspect Panchavati. Switch to citizen evidence for live submissions. `/admin/analytics` and `/admin/shortages/:id` preserve the selected demo context.

For explicit provisioning, set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12–256 characters), and optionally `ADMIN_NAME` in the shell or root `.env`. Production requires an explicit email and password. Generated credentials stay in this repository; they must never be committed. `.env.example` contains no credentials. `ADMIN_SESSION_HOURS` defaults to 8 and accepts 0.1–24 hours. Restart the API after changing configuration.

## Authentication and authorization

Passwords use salted scrypt (`N=32768`, `r=8`, `p=1`, 64-byte output). Login performs the expensive comparison for unknown accounts too, and returns the same error for invalid credentials, disabled accounts and non-admin users. Sign-in is limited to 10 requests per connection/IP per 15 minutes using the existing limiter.

Sessions use random 256-bit bearer tokens. MongoDB stores only SHA-256 hashes, the user reference and expiry. Every protected request checks expiry and the current account role/disabled state. A TTL index removes expired session records; authorization does not wait for TTL deletion. Logout deletes the server session. Browser session storage retains the token for the current tab; refreshing validates it through `/api/auth/me`. There is no cookie authentication or credentialed CORS. Existing explicit-origin CORS remains intact, including both local development origins and production's explicit allowlist. Authentication/dashboard responses use `Cache-Control: no-store`.

Admin UI routes redirect to sign-in. Protected backend routes enforce authorization independently of UI visibility. There is no registration, password-reset or citizen account endpoint. Administrative recalculation endpoints now also require an admin session. Citizen submissions still trigger deterministic detection automatically, and public aggregate reads remain available.

## Dashboard and map

Eight KPI cards cover active shortages, critical areas, approximate affected population, available tankers, en-route tankers, recorded water delivered, average response time and high-risk forecasts. Counts and estimates come from existing Phase 3 aggregates. Missing operational values show **Unknown**, not zero. Demo records and simulated verification/weather are labeled throughout.

The main map uses React Leaflet 5 and Leaflet 1.9.4 with OpenStreetMap tiles, attribution, pan/zoom, fit, colored severity markers and evidence popups. Citizen reports are opt-in and available only through protected map APIs. Tanker locations appear only if valid records exist. Emerging evidence is a separate layer, not a future-risk prediction. Markers indicate report-derived centers, not verified outage boundaries. Area names are inserted as text, not interpolated HTML.

The existing offline coordinate map is preserved. Administrators can switch views, and a tile failure automatically switches to the offline map. Its zoom, drag/keyboard pan, selection and layer controls work without an external service. Public `/alerts` and `/alerts/:id` keep aggregate evidence accessible without revealing household report layers or operational assessment context. No emergency routes are invented.

The event table supports area search and severity filters. Selecting a zone/table row shows the existing confidence/severity calculations, duration, approximate population, report/verified counts and available environmental evidence. Protected assessment context adds citizen-reported water categories, previous verified delivery when area-linked records exist, and deterministic assessment guidance explicitly labeled as neither AI nor allocation. The AI panel is a Phase 5 extension point with no generated recommendation or dispatch button.

Recent activity reflects report-received timestamps and recorded verification states. Analytics derive severity distribution, latest 24 reporting-hour buckets and eligible/verified/duplicate/suspicious evidence counts. Hourly buckets include duplicate submissions; household sums may overlap across time windows. Panchavati remains the critical hero, with Satpur, Indira Nagar, Nashik Road and emerging Adgaon computed from unchanged seed evidence.

## API additions

| Method | Endpoint                                        | Access / response                                                                            |
| ------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`                               | Email/password; expiring token and public admin profile                                      |
| GET    | `/api/auth/me`                                  | Admin session; current profile                                                               |
| POST   | `/api/auth/logout`                              | Admin session; server-side revocation                                                        |
| GET    | `/api/dashboard/summary?demo=true\|false`       | Admin; eight metrics, activity, emerging count, AI configuration state                       |
| GET    | `/api/dashboard/map?demo=true\|false`           | Admin; zones, sanitized report locations, optional tanker locations and availability flags   |
| GET    | `/api/dashboard/analytics?demo=true\|false`     | Admin; distributions and evidence counts                                                     |
| GET    | `/api/dashboard/shortages/:id?demo=true\|false` | Admin; existing event, household water categories, previous delivery and assessment guidance |

The query is strict, identifiers are validated, and production rejects demo dashboard access. Private map records omit anonymous owner hashes, descriptions and photos. Public shortage APIs retain their Phase 3 serialization. `POST /api/shortages/detect` and `POST /api/shortages/:id/calculate-severity` require an admin bearer token while preserving their existing validation and rate limits.

## Read-only operational integration

No tanker/delivery collection or demo fleet is created by the application. If these collections already exist, the dashboard reads records matching the selected `isDemo` context and validates them. Invalid/incomplete batches or absent collections yield unknown metrics rather than misleading partial totals. The read limit is 1,000 operational records; larger batches remain unknown pending pagination.

Optional tanker records require `status` (`AVAILABLE`, `ASSIGNED`, `EN_ROUTE`, `ARRIVED`, `OFFLINE`) and may provide `currentLocation: {lat,lng}` and positive `capacityLitres`. Optional verified delivery records require `areaId`, `status: DELIVERED`, `otpVerified: true`, nonnegative `litresDelivered`, and BSON date `deliveredAt`; `requestedAt` enables derived response time. Unverified deliveries are excluded. Previous delivery requires a known matching area ID; no history is inferred for an unmapped area. Demo and real records never mix.

No forecast feed exists yet, so high-risk forecasts remain unknown and the map returns no predicted high-risk zones. Emerging current evidence is shown separately. These extension points make unavailable data explicit without creating later-phase workflows.

## Verification

- `npm test`: 77 API/configuration/validation/detection/authentication tests.
- `npm run test:mongo`: 23 integration tests against real MongoDB, including report/session persistence after reconnect, authorization, expiry/role changes, protected map retrieval, derived analytics and read-only operational records.
- `npm run test:e2e`: 56 desktop/mobile Edge browser tests across Phases 1–4, including actual login/logout, report submission with photo, persisted events, confidence/severity display, map controls/popups, offline fallback, filters, private/public routing and error recovery.
- `npm run test:dev-origins`: citizen submissions from both `localhost:5173` and `127.0.0.1:5173`, with HTTP 201 and MongoDB persistence.
- `npm run lint` and `npm run build`: required clean checks.

New MongoDB tests use an isolated random database and delete only that database. Browser tests provision temporary random administrators and delete only those accounts/sessions and their own report IDs. Simulated report data remains available. Browser map tests use controlled tile responses/failures so external tile connectivity does not determine test results. Screenshots are stored under `.local/qa`.

## Known limits and preserved scope

Street tiles need internet; coordinate mode remains available offline. Map report layers are capped at the latest 500 records with an explicit truncation flag. No live fleet or forecast feed is configured. Analytics are aggregate evidence summaries, not calibrated forecasts or operational performance claims. Authentication has no recovery/MFA/user-management workflow; the existing limiter remains in-process and sessions are tab-local. Production requires TLS and suitable deployment proxy/shared-rate-limit configuration. Phase 3's synchronous detection limits and anonymous reporting limitations remain as documented in `phase3.md`.

Phase 1 health/routing, Phase 2 private reporting/photo/history/persistence/CORS and Phase 3 clustering/confidence/severity remain covered by their existing assertions. Admin-only recalculation is the intentional Phase 4 authorization change. No Phase 5 implementation was started.

## Exact changed files

The following paths are relative to the repository root. The Phase 3 numeric business-logic and seed files are unchanged.

**Configuration/documentation:** `.env.example`, `README.md`, `docs/phase4.md`, `package.json`, `package-lock.json`, `apps/api/package.json`, `apps/web/package.json`.

**Backend integration:** `apps/api/src/app.js`, `apps/api/src/config/env.js`, `apps/api/src/routes/index.js`, `apps/api/src/routes/shortages.js`.

**New backend modules:** `apps/api/src/middleware/admin.js`, `apps/api/src/models/User.js`, `apps/api/src/models/AdminSession.js`, `apps/api/src/routes/auth.js`, `apps/api/src/routes/dashboard.js`, `apps/api/src/services/authService.js`, `apps/api/src/services/dashboardService.js`, `apps/api/src/scripts/createAdmin.js`.

**Frontend integration:** `apps/web/src/App.jsx`, `apps/web/src/main.jsx`, `apps/web/src/lib/shortages.js`, `apps/web/src/components/ShortageMap.jsx`, `apps/web/src/pages/HomePage.jsx`, `apps/web/src/pages/ShortagesPage.jsx`, `apps/web/src/pages/ShortageStatusPage.jsx`.

**New frontend modules:** `apps/web/src/admin.css`, `apps/web/src/components/AuthProvider.jsx`, `apps/web/src/components/AdminLayout.jsx`, `apps/web/src/components/AdminDashboardPanels.jsx`, `apps/web/src/components/ShortageTable.jsx`, `apps/web/src/components/StreetShortageMap.jsx`, `apps/web/src/hooks/useAdminData.js`, `apps/web/src/lib/adminApi.js`, `apps/web/src/lib/authContext.js`, `apps/web/src/pages/LoginPage.jsx`, `apps/web/src/pages/AnalyticsPage.jsx`.

**Tests:** `apps/api/test/app.test.js`, `apps/api/test/shortages.mongo.test.js`, `apps/api/test/auth.test.js`, `apps/api/test/dashboard.mongo.test.js`, `tests/e2e/phase1.spec.js`, `tests/e2e/phase3.spec.js`, `tests/e2e/phase4.spec.js`, `tests/helpers/admin.js`.

The only local runtime credential artifact is ignored `.local/admin-access.json`. No files outside this repository were modified by the implementation.
