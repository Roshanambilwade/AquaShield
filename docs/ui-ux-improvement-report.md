# AquaShield UI/UX improvement report

Date: 11 October 2026. Scope: frontend presentation and usability only.

## Findings and changes

The existing application had oversized headings and metric cards, a horizontal municipal navigation bar, duplicate status navigation, long repeated explanations and inconsistent operational surfaces. The selected shortage expanded its entire calculation evidence on the overview, pushing decision and activity information far down the page.

The existing React components, Leaflet integration and APIs were extended rather than replaced. No framework, paid dependency or backend endpoint was added.

- **Shared layout:** consolidated branding, role navigation, account/logout and the discreet `Demonstration Environment · simulated data` indicator in the header. System status is available in the footer. Route focus uses `preventScroll` so keyboard focus does not inadvertently hide the header. Authentication, route guards and redirect behavior are unchanged.
- **Design system:** navy structure, teal primary actions, neutral surfaces, semantic severity colors, readable typography, spacing, modest borders/radii, control sizes, consistent forms/tables/disclosures, visible focus and reduced-motion support. Desktop municipal navigation is a sidebar; tablet/mobile use a wrapping navigation grid with all actions accessible. Existing CSS is retained; `product.css` supplies presentation overrides.
- **Citizen home and reporting:** replaced decorative artwork with a practical three-step guide, concise workspace descriptions and a citizen My Alerts action. Removed implementation-phase availability text and the report form's obsolete “later phase” explanation. Existing grouped reporting fields, explicit geolocation permission, validation, optional photo, submission and ownership are retained. Shared styling also covers report success/status/history and account forms.
- **Command center:** retained all eight API-owned KPIs in a compact unified summary; metric definitions are expandable. Added links and reporting-window counts for reports awaiting review, recommendations awaiting review and active trips. These counts use the existing analytics response and are explicitly a creation-window cohort, not global queue totals. Missing data remains Unknown. Selected-zone details are compact on the overview; the existing detail route retains full calculation evidence. Attention and recent activity precede optional AI assessment.
- **Evidence review, fleet and allocation:** consistent forms, report-source sections, cards, tables and expanded evidence controls. Existing account-source warnings, review notes, tanker observations/freshness, eligibility reasons, approval/assignment controls and revision checks remain intact. Simulated observation recording stays an explicit authorized action; no timestamps were refreshed automatically.
- **Operator and delivery:** added section navigation for the linked tanker, trip/history and assigned jobs. Current persisted status and next action remain prominent. Removed the delivery database ID from the primary trip display; it remains in authorized audit details. Administrator verification instructions use a disclosure. OTP, actual-litres entry, completion and safe saved-state refresh retain the existing contracts.
- **Alerts:** read/unread state now has a visible border distinction plus the existing text/action. Simulated advisories retain a concise explicit provenance label. Persistence and per-citizen isolation are unchanged.
- **Early warning, analytics and audit:** removed backend implementation wording from the early-warning eyebrow; preserved operational/synthetic source selection, uncertainty, INSUFFICIENT_DATA and activity-versus-water distinctions. Forecast charts now label the observed UTC date range and retain the accessible data table. Timing distributions have labeled native meters alongside recorded bucket counts. No metric, numerical formula or threshold was changed.

This work changes shared presentation across the major routes and selected content/interactions. It does not replace every route's existing component implementation.

## Maps and evidence

The existing shortage and authorized dashboard-map responses remain the data sources. Shortage coordinates, scores, confidence, report counts and status are backend projections. Tanker eligibility filtering uses the backend eligibility flag; it never infers availability from AVAILABLE alone.

Added area search, severity/status filters, reset and clear selection. Marker/list selection updates the associated assessment without a page reload. The event table uses the same filtered zones so it cannot offer a selection absent from the filtered map. Authorized report and recorded-tanker layers remain independent and are labeled accordingly. Map controls include citizen-report, tanker, eligible-tanker-only and emerging-evidence toggles. Street popups now include report/verified counts, event status and calculation timestamp alongside severity, confidence and approximate population.

Existing pan, zoom, fit, keyboard coordinate navigation and map legend remain. External tile errors switch to the interactive coordinate fallback with a Street view retry action; the zone list and event table continue working. Private report locations remain administrator-only. Public projections retain their existing geographic generalization. Zone centers are not verified outage boundaries; recorded tanker positions are not live GPS.

No new forecast-geography, assignment, live-GPS or road-route layer was fabricated. Existing trip maps use genuine configured routing results or clearly labeled straight-line/ETA estimates.

## Verification

The new `tests/e2e/ui-ux.spec.js` uses real Express/MongoDB responses from an isolated UUID test database seeded with the persistent synthetic scenario. Gemini credentials are blank and demo AI is explicit. It exercises:

- Municipal overview, citizen evidence review, tankers, allocations, deliveries, predictions, analytics, audit and advisories at **1440 × 1000**, **768 × 1024** and **390 × 844**.
- Citizen home, reporting, My Reports, My Alerts and an operator with an actual seeded ASSIGNED trip at all three sizes.
- Role-specific navigation, active municipal link, page headings, demonstration provenance, absence of phase labels and no unintended page-wide horizontal overflow.
- Map filters, selection/clear/reset, empty-filter feedback, failed tiles/retry and keyboard focus. Eligible-only markers are checked against the authorized API projection.
- Loaded screenshots and JavaScript error checks on municipal routes.

Existing browser assertions remain. Two deliberate content expectations were updated: product availability now describes municipal review rather than completed phases; the demonstration assertion checks the new truthful environment indicator. Authorization and workflow assertions were not removed.

The initial targeted run passed 35 checks and exposed five failures in new tests: select names included option text, the initially selected operator had completed history rather than an assigned trip, and navigation raced a pending fixture response. Selects now have explicit accessible names; tests look up the persisted assigned operator and wait for fixture requests to settle. The focused rerun passed all six new checks.

After adding the eligible-marker/API comparison, the first full run passed 126 browser checks but failed the two new map cases because the fixture attempted to read a response body from a document replaced by sign-in navigation. The fixture now captures that payload in its API forwarding handler, waits for sign-in navigation and pending responses, and handles expected abandoned-request cancellation while preserving failures for other errors. The final verification run includes this correction and the last spacing refinements.

Further review synchronized the event table with map filters and added a consistency assertion. The eligible-marker assertion was also corrected to inspect the existing square (`rect`) coordinate-map tanker symbols rather than circles. Final acceptance rebuilds and tests the completed application with both corrections; intermediate failures are not reported as successful final verification.

Commands/results:

- `npm run test:e2e -- tests/e2e/ui-ux.spec.js`: **6 passed** in the focused rerun.
- `npm run verify`: **all eight stages passed** in the final acceptance run (`.local/ui-acceptance.log`): 197 unit/API tests, 122 MongoDB integration tests, lint, production build, secret-exposure checks, configuration parsing, 128 desktop/mobile browser tests and 2 development-origin tests (localhost and 127.0.0.1).

Automated verification uses synthetic isolated databases and does not reset or mutate the faculty demonstration database. No live Gemini inference or deployment was performed.

## Visual and accessibility review

Screenshots are saved locally under `.local/qa/ui/`, with full-page and viewport captures. Manually reviewed the desktop dashboard and allocation screens; the final 1440px desktop and 768px tablet dashboard captures; and 390px mobile tanker management, citizen home, report form, My Reports, My Alerts and assigned-operator screens. The resulting spacing/focus refinements are included in the final verified application. Representative captures include `desktop-dashboard-1440-viewport.png`, `desktop-dashboard-768-viewport.png`, `desktop-report-390-viewport.png`, `desktop-history-390-viewport.png`, `desktop-alerts-390-viewport.png` and `desktop-operator-390-viewport.png`. The browser suite records 168 full-page/viewport captures across its two projects; this does not imply that every screenshot received manual review.

Checked explicit labels for new filters, focus/tab order, the existing skip link and route focus, minimum 44px button/input controls, text plus color for severity and read state, responsive wrapping, intentional table scrolling and reduced-motion behavior. Timing/forecast charts retain textual values or accessible data tables. The palette uses dark text on light surfaces and light text on the navy guide/navigation; this is not an accessibility certification or a complete screen-reader audit.

## Preservation and limitations

File fingerprints confirm the backend, specification, `.env` and demo credential file are unchanged. Backend authorization, ownership, privacy projections, tanker eligibility, fairness, administrative approval, numerical prediction, OTP verification and delivery accounting remain authoritative. No new polling, Gemini-on-refresh, credentials, provider, simulation service, AWS service or package was introduced. No commit or push was made.

External OpenStreetMap tile availability is not guaranteed; fallback/retry is tested with aborted tiles, and the existing Leaflet popup test uses controlled tiles. Responsive checks use headless Microsoft Edge emulation, not physical devices or a cross-browser certification. Native charts remain deliberately simple. Geographic risk/assignment/live tracking layers are limited to existing supported data. Long operational history remains available through existing bounded APIs, pagination and details; no advanced marker clustering or streaming telemetry was added. Authorized operational references and audit IDs remain where needed for identifying records.

## Files changed

Frontend:

- `apps/web/src/product.css` (new), `apps/web/src/main.jsx`
- `apps/web/src/components/Layout.jsx`, `AdminLayout.jsx`, `AdminDashboardPanels.jsx`
- `apps/web/src/components/ShortageMap.jsx`, `StreetShortageMap.jsx`
- `apps/web/src/components/MunicipalAnalytics.jsx`, `PredictionChart.jsx`, `TripCard.jsx`
- `apps/web/src/pages/HomePage.jsx`, `WorkspacePage.jsx`, `ShortagesPage.jsx`
- `apps/web/src/pages/ReportPage.jsx`, `CitizenAlertsPage.jsx`, `OperatorPage.jsx`
- `apps/web/src/pages/DeliveriesPage.jsx`, `PredictionsPage.jsx`

Tests/documentation:

- `tests/e2e/ui-ux.spec.js` (new)
- `tests/e2e/phase1.spec.js`, `tests/e2e/persistent-demo.spec.js`
- `docs/ui-ux-improvement-report.md` (new)

Ignored local logs, screenshots and preservation-check artifacts are under `.local/`; they are not application changes.
