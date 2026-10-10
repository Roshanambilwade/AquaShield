# Phase 12 — hackathon presentation polish

This phase refines the existing React interface and faculty guide. Authentication, authorization, report ownership, deterministic calculations, fairness/eligibility, OTP verification, accounting, AI architecture and database schemas are unchanged. No dependencies were added.

## Issues found and changes

- Navigation spacing and small click targets varied across portals. Shared presentation CSS provides consistent 44-pixel buttons, text fields, selects and navigation links, typography, wrapping, session-button styling, keyboard focus, table overscroll containment and reduced-motion behavior while retaining the AquaShield identity and severity palette.
- Browser tabs used a generic application title. Existing routes now have concise role/page titles, including operator sign-in and individual assignment/report/audit pages. Titles exclude private IDs. Query-only filters update the title without resetting keyboard focus or scroll.
- The municipal overview lacked direct next-step links and carried an obsolete pre-forecast sentence. It now links to evidence review, fair allocation, trips and report-activity forecasts; current severity, genuine-shortage confidence, approximate population and forecasts remain distinct.
- All trip states used the warning style, including completed deliveries. Textual states now have distinct, contrasting styles and guidance for the next permitted action; backend transitions remain authoritative.
- Trip detail failures were conflated with action failures. Route information has its own bounded GET retry; a route failure does not erase the trip or disable the authorized workflow. Action errors explain uncertain outcomes and offer **Refresh saved trip**. It confirms a GET before refreshing the parent view, clears transient codes after that read and never replays a POST.
- Operator empty states did not explain how assignments become available. They now direct the operator to the municipal team. Citizen/shortage empty states no longer expose seed commands as product actions.
- The faculty guide suggested reseeding at every startup. Repeat presentations now start already provisioned data with seeding disabled. First-time provisioning is separate; the citizen → municipal review → allocation → operator → delivery → analytics/audit → predictions → controlled outage → shutdown sequence uses actual routes and preserves data freshness/uncertainty warnings.

## Verification and visual review

Final verification on 2026-10-11: npm run verify exited 0. Browser tests used isolated disposable MongoDB fixtures, not the faculty database. Live Gemini was not part of this workflow.

| Check | Observed result |
| --- | --- |
| Unit/API and reliability | 193 passed; no failures or skips |
| MongoDB integration | 106 passed; no failures or skips |
| Lint | Passed |
| Production frontend build | Passed |
| Secret-exposure and configuration checks | Passed |
| Real desktop/mobile browser suite | 116 passed: 58 per viewport |
| Development origins | 2 passed: localhost and 127.0.0.1; submission/persistence/retrieval |
| Git whitespace check | Passed |

Commands executed: npm run verify (includes npm test, npm run test:mongo, npm run lint, npm run build, npm run security:check, npm run config:check, npm run test:e2e and npm run test:dev-origins); separate npm run lint; separate npm run build; npm run test:e2e -- tests/e2e/phase7.spec.js (6 passed); scoped Prettier formatting; git diff --check; read-only contrast calculation. The final verify uses development port 5175 to preserve the existing local frontend server. Local logs: .local/phase12-verify-final.log, .local/phase12-build.log and .local/phase12-trips.log.

The initial sandbox run hit loopback EACCES and was rerun with access to isolated local test services. Lint caught a synchronous effect-state reset, which was corrected without disabling the rule. An added title assertion initially expected the assignments-list title on the individual assigned-job route; it was corrected to verify the exact route title. The final complete run passes with existing tests preserved. Earlier failing browser output is kept separately in .local/phase12-verify-browser-failure.log.

Phases 1–11 regressions remain passing. Docker/cloud runtime, backup restoration, live Gemini and other browser engines were not reverified in Phase 12.

New/expanded assertions cover route titles, contextual links preserving demo selection, keyboard focus, minimum field height, reduced-motion rendering, viewport overflow, route-information failure/retry, lost acknowledgement after a saved trip start, exactly one start POST, safe saved-state refresh (including a failed GET that retains the uncertain-outcome warning), readable timestamp labels and completed-state guidance/style. Existing report retry, consent/privacy, authorization, fairness, prediction/provider-outage, analytics, audit and operational regression tests remain intact.

The configured browser viewports are desktop 1440×1000 and mobile 390×844 using Edge. Screenshot artifacts are ignored local files under `.local/qa`; they use synthetic accounts and records. Review includes citizen sign-in/focus, municipal overview/navigation/map/table, analytics, predictions and delivery history on both sizes. This is targeted visual/keyboard verification, not a WCAG certification or a full screen-reader/device audit. Changed badge text/background contrast is 6.63–7.44:1; contextual links are 6.96:1. Status is always also expressed in text.

## Files changed

- `apps/web/src/components/Layout.jsx`
- `apps/web/src/components/TripCard.jsx`
- `apps/web/src/main.jsx`
- `apps/web/src/polish.css`
- `apps/web/src/pages/ShortagesPage.jsx`
- `apps/web/src/pages/OperatorPage.jsx`
- `apps/web/src/pages/ReportHistoryPage.jsx`
- `tests/e2e/phase4.spec.js`
- `tests/e2e/phase7.spec.js`
- `tests/e2e/phase12.spec.js`
- `docs/demo-guide.md`
- `docs/phase12.md`
- `README.md`

## Limits and presentation procedure

Read [the presentation run sheet](demo-guide.md#phase-12-concise-presentation-run-sheet). Old observations may be stale and tankers may be ineligible; use honest simulated observations through existing forms, without reseeding/resetting to force success. The persistent scenario intentionally may have insufficient forecast history. Supported forecast tests do not establish real-world accuracy. Long evidence/analytics pages still require scrolling; tables retain horizontal scrolling where needed. Street tiles need network access; stored coordinate/schematic views remain available. No live GPS, traffic or SMS is claimed. Provider-outage tests prove deterministic fallback behavior, not live Gemini availability.

No dynamic simulation, background report generation, virtual clock, AWS deployment, backend rewrite, real `.env` edit, credential change, faculty-data reset, live inference, Git commit or later phase is included.
