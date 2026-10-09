# Phase 6.5 — citizen authentication and report ownership

Citizen accounts now use the existing User and hashed, expiring MongoDB session architecture. React/Vite and Express remain JavaScript. Admin/operator provisioning, roles, scoring, Strands/Gemini, allocation and tanker assignment remain intact. Phase 7 and deployment are not started.

The subsequent [portal navigation fix](portal-access.md) centralizes role guards and login destinations, hides other-role links while authenticated, keeps logout available across public/protected pages, and preserves a valid session after wrong-role API denial. It supersedes the earlier layout/navigation behavior without changing backend roles or report ownership.

## Local workflow

1. Start MongoDB and `npm run dev` using the existing root `.env`.
2. Open `/register`. Enter full name, email and a password of 12–256 characters, then confirm the password. No phone, address, government ID, role or verification claim is collected. The API assigns CITIZEN and normalizes email; the existing unique email index covers all roles.
3. After registration, open `/citizen/login` and sign in. The API returns the existing opaque bearer session, whose hash is stored in MongoDB. The existing frontend sessionStorage key is retained for compatibility with admin/operator accounts; only one account is active in a tab. Refresh preserves authentication. A new tab/browser requires sign-in and then retrieves the same account-owned history.
4. Open `/report`, choose/capture a location and submit household details. Existing validation, photo processing, idempotency, rate limits and shortage detection remain active. New live reports require an active CITIZEN session; admins/operators use their own workspaces and must sign out before using a citizen account.
5. Open `/my-reports`, inspect the report and refresh. Sign out and back in to verify durable history. Another citizen's account cannot open the report by ID. The account email remains explicitly unverified.
6. Sign in as an administrator through the existing `/login`. Open **Citizen reports** (`/admin/reports`) and **Review report evidence**. Name/email, contact verification state, locality, coordinates, household fields, status, timestamp, description and photo where provided are available only to authorized administrators. Identity/residency are explicitly unverified. Demo and legacy/imported records have no invented reporter contact.
7. An owned report's status page shows recorded APPROVED/ASSIGNED area response status when present. It exposes no tanker/operator identifiers, allocation audit/AI payload or other citizens' information. Area assignment is not proof of delivery to the household. Existing report field verification and shortage confidence remain distinct from account/contact verification.

## APIs

| Method | Route | Access / behavior |
| --- | --- | --- |
| POST | `/api/auth/register` | Public, strict name/email/password only; server-assigned CITIZEN; 201 |
| POST | `/api/auth/login` | Shared login for CITIZEN, ADMIN, OPERATOR; generic invalid-credentials errors |
| GET | `/api/auth/me` | Verified existing session; safe current-user fields and emailVerified |
| POST | `/api/auth/logout` | Revokes that session in MongoDB |
| POST | `/api/reports` | CITIZEN only; identity comes from backend authentication |
| GET | `/api/reports` | Only authenticated citizen's live reports; existing pagination |
| GET | `/api/reports/:id` | Only that citizen's live report; existing public simulated detail outside production |
| GET | `/api/reports?demo=true` | Public fictional reports outside production, no real owners/contact |
| GET | `/api/dashboard/reports` | ADMIN only; paginated report/source review; strict page/limit/demo query |
| GET | `/api/dashboard/reports/:id` | ADMIN only; source and full report evidence including sanitized photo |

The original protected admin/operator/AI/operations endpoints retain role checks. Registration cannot accept role, ownerId, passwordHash or emailVerifiedAt. Report bodies cannot accept ownerId/userId/reporterKeyHash/verification flags. Unauthorized access returns 401, wrong role 403, and another citizen's report returns the same safe 404 as a nonexistent ID. `X-Citizen-Token` alone cannot submit or access live reports.

## Ownership and compatibility

Report adds immutable nullable `ownerId` referencing User and an owner/history index. The server requires a valid citizen identity for new citizen submissions. It also derives the existing internal reporter key hash from the account ID, preserving the existing clustering/confidence/population code. Repeated reports by the same account across renewed sessions remain duplicate evidence; accounts are not verified people or households. Seed/legacy reporter keys continue to work in deterministic analysis. No scoring formula or severity weight was changed.

Existing records without an account owner are retained without reassignment or migration. Officers see them as legacy/imported; they do not appear in a random citizen's account history. Existing browser keys no longer grant live-report access, and no automatic claim/import endpoint is provided. Existing demo records remain fictional, unowned and separate from real users. No application records are deleted or reset by this feature.

Sessions continue to use random opaque tokens, SHA-256 token hashes, server-side expiry and TTL cleanup, current-role/disabled-account checks, explicit logout and scrypt password hashes with random salts and existing cost settings. Frontend requests use Authorization, not credentialed cookies; current explicit localhost/127.0.0.1 CORS rules remain in force. Read responses use no-store. Session expiration clears frontend private data and requires sign-in again.

## Configuration and limitations

No new secrets, paid services or mandatory environment variables are needed. The existing `ADMIN_SESSION_HOURS` (default 8, bounded 0.1–24) controls all roles; its historical name is retained to preserve existing `.env` files. `MONGODB_URI`, explicit `CORS_ORIGIN` and `VITE_API_BASE_URL` retain their behavior. Registration and login each allow 10 requests per IP per 15 minutes using the existing bounded in-process limiter; report submission keeps its existing limit.

Email verification has a nullable `emailVerifiedAt` extension point but no public setter, fake OTP, email/SMS provider or identity verification mechanism. Current registrations remain unverified. There is no password recovery, contact update or account deletion workflow. Do not interpret account creation as identity, address/residency or household verification. Production hardening still needs TLS, suitable proxy/shared limits and the previously documented sessionStorage/XSS considerations. A sessionStorage token is not an HttpOnly cookie; this phase preserves the existing design.

## Tests and files

Run `npm test`, `npm run test:mongo`, `npm run lint`, `npm run build`, `npm run test:e2e`, and `npm run test:dev-origins`. Default tests do not call Gemini. New MongoDB tests and Phase 6.5 browser tests use randomly named disposable databases. Existing browser fixtures now provision citizen sessions and clean up only test-owned accounts/reports. Existing persistence, photos, validation, CORS, clustering, confidence, severity, dashboard, agent and assignment checks remain in the suite; expectations changed only for the newly required authentication behavior.

Verified on 9 October 2026:

| Check | Actual result |
| --- | --- |
| `npm test` | 104 passed |
| `npm run test:mongo` | 46 passed against real local MongoDB |
| `npm run test:e2e` | 70 passed across desktop/mobile, including 4 new Phase 6.5 cases |
| `npm run test:dev-origins` | 2 passed; authenticated HTTP 201, persistence and history from localhost:5173 and 127.0.0.1:5173 |
| `npm run lint` | Passed |
| `npm run build` | Passed production Vite build |

Browser verification covers registration, renewed login, report ownership/persistence, account-private history, another account's denied detail access, expiration/logout and ADMIN-only source review. Desktop/mobile screenshots were inspected under ignored `.local/qa/phase65-*`. The existing administrator expiry test retains its access/expiry assertions and now checks citizen sign-in for reporting plus public aggregate alerts. All Phase 1–6 regression cases pass. No paid/live Gemini test was needed or run for this account feature; previous live-provider limitations are unchanged.

New files:

- `apps/api/src/validation/auth.js`
- `apps/api/test/citizen.mongo.test.js`, `apps/api/test/helpers/citizen.js`
- `apps/web/src/components/CitizenAccess.jsx`
- `apps/web/src/pages/RegisterPage.jsx`, `apps/web/src/pages/ReportReviewPage.jsx`
- `tests/helpers/citizen.js`, `tests/e2e/phase65.spec.js`
- `docs/phase65.md`

Extended existing files:

- `.env.example`, `AQUASHIELD_SPEC.md`, `README.md`, `docs/demo.md`, `docs/phase3.md`, `docs/phase4.md`, `docs/phase6.md`
- `apps/api/package.json`
- `apps/api/src/models/{User,Report}.js`
- `apps/api/src/services/{authService,reportService,dashboardService}.js`
- `apps/api/src/services/{reportClusteringService,confidenceEngine,populationEngine}.js` (terminology/comments only; numeric logic unchanged)
- `apps/api/src/controllers/reportController.js`, `apps/api/src/validation/report.js`
- `apps/api/src/routes/{auth,reports,dashboard,index}.js`
- `apps/api/test/{app,auth,reports.mongo,shortages.mongo,dashboard.mongo}.test.js`
- `apps/web/src/App.jsx`, `apps/web/src/{admin,reporting,styles}.css`
- `apps/web/src/components/{AuthProvider,Layout,AdminLayout,ReportDetails,ReportFeedback,ShortageDetails}.jsx`
- `apps/web/src/pages/{LoginPage,ReportPage,ReportHistoryPage}.jsx`
- `apps/web/src/lib/{api,adminApi}.js`, `apps/web/src/hooks/useReportData.js`
- `tests/e2e/{phase2,phase3,phase4}.spec.js`, `tests/development/origins.spec.js`

Earlier uncommitted work is preserved. No automatic commits, Git resets, AWS resources or AI provider changes were performed.

## Pre-Phase-7 remediation update

See [the remediation report](remediation.md) for current public aggregation, bounded detection refresh, authoritative allocation advice, recovery policy, fleet eligibility, citizen response history, test isolation and agent verification. Earlier test counts in this document are historical phase snapshots. No live Gemini inference was run during remediation; demo and mocked-provider tests are not proof of live execution. Phase 7 and deployment remain outside this task.
