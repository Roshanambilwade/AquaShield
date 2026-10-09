# Role-based portal navigation fix

This is an incremental fix after Phase 6.5, not Phase 7. Accounts, existing password/session architecture, citizen report ownership, scoring, allocation, operator assignments, Gemini/Strands and CORS configuration are preserved.

## Root cause

The shared header and landing page offered every portal regardless of the authenticated role. The operator page grouped a signed-in wrong-role account with signed-out visitors and offered another login; login then returned the citizen to My Reports. In addition, `adminRequest` interpreted `403 ADMIN_REQUIRED` as session invalidation, removing a valid bearer token despite a server-authorized session still existing. These were navigation/session handling inconsistencies; backend role checks already rejected unauthorized access.

## Current behavior

| Server-authenticated role | Default login destination | Authenticated portal links |
| --- | --- | --- |
| CITIZEN | `/my-reports` | Report water shortage, My Reports |
| ADMIN | `/admin` | Municipal team; overview, shortages, analytics, allocations, tankers, citizen report evidence |
| OPERATOR | `/operator` | Operator dashboard and own tanker/assignments |

Every role retains public overview, local alerts, system status, account name/role and explicit logout. Citizens see their email verification state. Authenticated navigation/landing actions hide other portals and registration/sign-in controls; no account promotion or role-switch control is provided. Signed-out visitors retain public links, registration and portal sign-in choices. Logout and authentication as another already provisioned account are required to change roles.

`portalAccess.js` supplies the frontend destination policy. Allowed intended destinations retain query/demo context; other-role, external, ambiguous, normalized/encoded traversal and login-loop destinations fall back to the role's home. The policy is for navigation only. Profile roles come from existing `/api/auth/login` and `/api/auth/me`, never a role query parameter or a browser-stored role.

`RoleGuard` handles loading/session errors, signed-out redirects, wrong-role denial and the link **Return to your portal**. ADMIN, OPERATOR and live citizen report/history entry pages share it. Public fictional report details remain explicitly supported outside production; real detail APIs still enforce ownership. `?demo=true` never grants a role or bypasses portal guards. Login waits for session restoration before displaying a form or choosing the destination. Refresh restores the current server account role.

Wrong-role API `403` is a permission denial and does not remove the session. Only existing authentication failures `401 AUTH_REQUIRED` or `401 SESSION_EXPIRED` invalidate it. Operator assignment errors clear previously displayed assignment data. Logout remains the existing MongoDB session revocation API.

## Backend boundaries verified

No backend authorization, user roles, public registration, session protocol, CORS or API URL configuration was weakened or replaced. Existing middleware looks up the session and current trusted User on each protected request. ADMIN-only dashboard/map/evidence/fleet/allocation/AI APIs reject CITIZEN and OPERATOR. OPERATOR assignment retrieval filters by the authenticated operator ID and rejects attempts to supply a different operator ID; there is no public assignment-by-ID endpoint. Private citizen reports filter by backend-derived ownerId. Public registration continues assigning CITIZEN and rejecting privilege/verification inputs.

## Manual checks

1. Start MongoDB and `npm run dev` using the existing root `.env`; no new environment variables are needed.
2. Register/sign in as a citizen. Verify My Reports, report submission, account/logout and no municipal/operator links; refresh. Open `/admin/reports?demo=true` or `/operator` directly: observe denial and return to My Reports without another login.
3. Sign out and sign in with an existing provisioned administrator. Verify `/admin`, management links and private reporter review; refresh. Open `/operator` directly: observe denial and return to the municipal dashboard.
4. Sign out and sign in as a provisioned operator. Verify `/operator` and only that operator's linked tanker/assignments; refresh. Open `/admin/tankers?demo=true`: observe denial and return to assignments.
5. Check signed-out registration/public alerts, expired-session sign-in and logout revocation. Never film passwords, bearer tokens or private citizen contact details.

## Changed files

New:

- `apps/web/src/lib/portalAccess.js`
- `apps/web/src/components/RoleGuard.jsx`
- `apps/api/test/portal.test.js`
- `tests/e2e/portals.spec.js`
- `docs/portal-access.md`

Extended:

- `apps/web/src/components/{Layout,AdminLayout,CitizenAccess,ReportFeedback}.jsx`
- `apps/web/src/pages/{HomePage,LoginPage,RegisterPage,OperatorPage,ReportStatusPage,ShortagesPage}.jsx`
- `apps/web/src/lib/adminApi.js`
- `apps/api/package.json`
- `apps/api/test/{citizen,operations}.mongo.test.js`
- `tests/e2e/phase1.spec.js`
- `README.md`, `docs/phase65.md`

The existing navigation/refresh test now checks that an administrator cannot see or enter operator navigation and returns to the administrator dashboard. Its route/refresh checks remain intact. New policy, MongoDB and desktop/mobile browser cases supplement all prior coverage. Browser tests use a disposable MongoDB database and real Express HTTP, not fabricated API responses; only their own test accounts/database are cleaned up.

## Verification on 9 October 2026

| Command | Actual result |
| --- | --- |
| `npm test` | 108 passed, including 4 new portal-policy cases |
| `npm run test:mongo` | 47 passed, including trusted-role/demo denial and assignment-ownership checks |
| `npm run test:e2e` | 82 passed across desktop/mobile, preserving Phases 1–6.5 and adding 12 portal cases |
| `npm run test:e2e -- tests/e2e/portals.spec.js tests/e2e/phase3.spec.js` | 22 passed against the final build after the empty-dashboard navigation correction |
| `npm run test:dev-origins` | 2 passed: authenticated HTTP 201, MongoDB persistence/history on localhost:5173 and 127.0.0.1:5173 |
| `npm run lint` | Passed |
| `npm run build` | Passed production Vite build |

Desktop/mobile screenshots were inspected under ignored `.local/qa/portal-*`. The initial sandbox unit/build runs encountered local-server/file-resolution restrictions; permitted reruns passed. No real Gemini call or AWS work was needed for this fix. The final focused rerun also checks that an empty administrator dashboard offers authorized citizen-report review rather than submission by an administrator.

## Limitations

One account/role is active per tab. This preserves the existing sessionStorage bearer design; no multi-role account or account switching without authentication was added. Account role changes are checked on every backend request and reflected in frontend navigation on `/auth/me` restoration/refresh; there is no push notification of role changes. Contact, identity and residency remain unverified, and recovery/MFA remain unavailable as previously documented. No Phase 7, AWS, provider changes, application data reset or automatic commit was performed.
