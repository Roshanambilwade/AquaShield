# AquaShield

**Emergency water-management decision support for citizens and municipal teams.**

AquaShield connects household water-shortage reports with municipal assessment, fair tanker allocation, delivery tracking and early warning. It helps a municipal team answer: **Where is the crisis? How serious is it? How confident are we? Approximately how many people are affected? Which areas need attention?**

Built by **AquaSentinels** for **Environmental Hacks — Heat & Water Track**.

## Why AquaShield exists

During water shortages, household complaints, fleet availability and delivery records can become disconnected. A large number of complaints does not automatically establish a verified crisis, and dispatching water without considering previous deliveries can leave some areas underserved.

AquaShield brings those records into one system. Citizens provide household evidence; deterministic backend services assess shortages and resource priorities; municipal staff review the evidence and control operational decisions. The application distinguishes recorded facts, estimates, synthetic demonstration data and unknown information.

## Who uses the project?

| Role              | Responsibilities                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Citizen**       | Register, report a household shortage, track owned reports, view area advisories and participate in an authorized delivery-code handoff.                                                       |
| **Administrator** | Review reports, inspect shortage zones, manage tankers/operators, review fair allocation recommendations, approve and assign resources, publish advisories and inspect delivery/audit history. |
| **Operator**      | View assigned jobs, start a trip, record arrival, perform delivery-code verification and record delivered litres.                                                                              |

Public visitors can view privacy-protected shortage aggregates. Private reports, municipal tools and operator assignments require the appropriate authenticated role. Public registration creates citizens only.

## The complete workflow

1. **Report:** A citizen supplies location, area/locality, problem type, last supply time, shortage duration, household water level and household size. Description and photo are optional; unknown values remain unknown.
2. **Assess:** The backend saves the account-owned report in MongoDB. Geographic/time clustering, duplicate checks and suspicious-evidence handling produce shortage events.
3. **Review:** The command center shows severity, confidence, approximate affected population, evidence coverage and map locations. Administrators verify or reject submitted evidence with a review note.
4. **Recommend:** Deterministic allocation services consider supported demand, previous deliveries and tanker eligibility, including capacity, availability, freshness, reservations and active trips.
5. **Approve and assign:** An administrator explicitly reviews, approves and assigns resources. Recommendation, approval and assignment are separate actions. AI advice and simulation ticks cannot dispatch tankers.
6. **Deliver:** The assigned operator follows `ASSIGNED → EN_ROUTE → ARRIVED → DELIVERED`, including protected code verification and recorded litre accounting.
7. **Track and anticipate:** Saved outcomes update municipal history, tanker balances, citizen area-response views, analytics and audit records. Numerical early warning evaluates supported historical report activity independently of Gemini.

## What AquaShield provides

### Citizen reporting and privacy

Citizens can capture device location, enter coordinates or select an explicitly approximate locality center. Reports collect household evidence, not an invented total neighborhood population. Optional JPEG/PNG photos undergo size checks, server-side re-encoding and metadata removal.

Private report history, status pages and idempotent submission retries use persistent MongoDB records. The backend assigns report ownership from the authenticated session; another citizen cannot read a private report by guessing its ID. My Alerts supports service-area preferences, published municipal advisories and individual read state.

Names, contact details and locality are user-provided. Registration and submitted-evidence review do not independently verify identity, residency or physical conditions. Public aggregates suppress private household evidence.

### Municipal command center and map

The responsive dashboard combines an interactive Leaflet/OpenStreetMap map, an offline geographic fallback, shortage lists, detail views, recommendations and recent activity. Map layers show shortage severity, emerging risk, authorized report evidence and tanker positions where observations exist.

Eight KPI cards cover **Active Shortages, Critical Areas, Estimated People Affected, Available Tankers, Tankers En Route, Water Delivered, Average Response Time and High-Risk Areas**. Unsupported values remain unknown.

Shortage details explain duration, reported water levels, report and verified-report counts, confidence, estimated population, available environmental evidence, previous deliveries and recommended actions.

### Explainable numerical assessment

All numeric calculations run in backend services. An LLM does not calculate severity, confidence, population estimates, fairness, distance, ETA or prediction risk scores.

| Measurement           | Meaning                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Report count          | Recorded reports associated with an event; duplicate and independent evidence are assessed separately.   |
| Verified report count | Evidence explicitly reviewed and verified by authorized staff; not proof of a physical field inspection. |
| Confidence            | Confidence that a genuine shortage event exists, **not water remaining**.                                |
| Affected population   | An approximate estimate with assumptions, not an exact verified neighborhood count.                      |
| Water level           | Household-reported evidence, not a municipal sensor measurement.                                         |
| Severity              | A configurable weighted score classified as **LOW, MEDIUM, HIGH or CRITICAL**.                           |

Default severity weights are shortage duration **25%**, affected population **20%**, current water level **20%**, environmental stress **15%**, vulnerable population **10%** and shortage confidence **10%**. Default classification boundaries are MEDIUM at 30, HIGH at 60 and CRITICAL at 80. Missing inputs remain visible alongside calculation coverage and bounds; environmental or vulnerability evidence is not invented.

### Fair allocation and delivery verification

Operational fairness reuses authoritative backend evidence. Tanker eligibility is rechecked during assignment, with concurrency protections against conflicting allocations.

**Delivery verification belongs to the assigned operator** in **Your assignments**, after starting the trip and marking arrival. The administrator's **Trips and deliveries** screen provides inspection, history and controlled recovery; it does not grant operator delivery actions.

Ordinary mode supports a private, expiring code retrieved by the designated citizen from their own report, or a configured recipient handoff adapter. Codes are hashed, attempt-limited and protected against replay. Explicit demonstration mode supports a clearly fictional demo-code flow. Completion records delivered litres with capacity/balance checks and safeguards against double accounting.

Code participation and recorded litres do not independently prove physical household receipt. Distance and ETA remain estimates with their source and assumptions; tanker observations do not establish live GPS tracking.

### Four AI advisory roles

The **Strands Agents SDK with Google Gemini** provides optional qualitative decision support:

| Agent               | Purpose                                                               |
| ------------------- | --------------------------------------------------------------------- |
| Crisis Detection    | Explain shortage evidence, confidence and verification limitations.   |
| Resource Allocation | Explain backend priority, fairness and tanker eligibility.            |
| Logistics           | Explain supported trip/route evidence and missing operational inputs. |
| Early Warning       | Explain completed numerical results and trend limitations.            |

Agents receive controlled evidence and return strictly validated structured advice. Unsupported facts, invented numerical claims, false verification claims and unauthorized actions are rejected. Recommendations remain subject to human review and cannot approve, assign or complete deliveries.

Real Gemini execution, explicit key-free `DEMO_AI_MODE` output and evidence-supported rule-based fallback are labeled separately. Provider failures use bounded timeouts, retries and circuit handling. Fallback is not represented as successful Gemini execution. Complete four-role live-provider verification is not claimed; see the [AI reliability guide](docs/ai-reliability.md) and [recorded live results](docs/through-phase7-audit.md).

### Independent early warning, analytics and audit

Feature extraction, report-activity prediction, risk classification, uncertainty evaluation and numerical alert persistence execute through deterministic backend services. Supported prediction calculation/retrieval needs no Gemini or Strands call. Insufficient history returns **`INSUFFICIENT_DATA`**.

The risk index is not a calibrated probability, and report-activity forecasting is not physical water-depletion forecasting. Synthetic history is separated from ordinary evidence. Saving a numerical alert does not automatically publish a citizen advisory.

Administrators can inspect persisted activity using bounded area/time filters, recorded litres, response metrics and explicit denominators. Audit history includes supported actors, transitions, outcomes and correlation information. Historical unknowns remain unknown; snapshot fleet utilization is not a historical time series. Application audit records are not claimed to be tamper-proof against direct database administration.

## Demonstration and simulation

**Panchavati is the primary demonstration scenario**, alongside other areas with different household evidence, durations, derived severity/confidence and emerging risk.

- **Persistent faculty demonstration:** Prepared accounts, reports and operational examples for a repeatable walkthrough. Follow the [faculty demo guide](docs/demo-guide.md); guarded preparation preserves existing actions.
- **Dynamic simulation:** An isolated persistent scenario with six areas, fictional accounts and two synthetic tankers. It generates up to 72 reports across 24 ticks through existing submission/assessment services. Follow the [simulation setup guide](docs/dynamic-simulation.md).

Simulation controls support start, pause, resume, step, speed and stop. Fifteen virtual minutes advance per tick; authentication, code expiry and operational freshness retain real timestamps. Allocation, delivery and advisory publication remain explicit human actions. No live Gemini calls, physical deliveries or live GPS are implied.

**Refresh saved simulation** reloads stored evidence and operational results. It does not advance or restart the scenario. A stopped/finished run is terminal. Another independent run requires a new isolated simulation database with matching configuration, preserving the previous run. A same-database New simulation run feature is not implemented. One backend instance is supported per simulation database.

Generated credential files remain ignored in `.local`. Selected synthetic simulation accounts are intentionally published in [Demo access](DEMO_ACCESS.md); their AWS login access is not verified. There is no production simulation mode or automatic startup seeding.

## Architecture

```text
React + Vite frontend
  Citizen portal / Municipal command center / Operator portal
                         |
                 Authenticated HTTP APIs
                         |
Node.js + Express backend
  Validation, authorization and report ownership
  Clustering, confidence, severity and population estimates
  Fairness, allocation, trips and delivery accounting
  Numerical prediction, alerts, analytics and audit
  Validated advisory service -> Strands -> Google Gemini (optional)
                         |
                      Mongoose
                         |
                MongoDB / MongoDB Atlas
```

The main frontend and backend use **JavaScript**. React Router handles navigation, Zod validates contracts and Sharp processes report photos. Shared JavaScript definitions live in `packages/shared`. MongoDB persists application records; there is no in-memory database fallback.

| Directory          | Contents                                                    |
| ------------------ | ----------------------------------------------------------- |
| `apps/web`         | React pages, reusable components, styles and API clients.   |
| `apps/api`         | Express routes, middleware, models and business services.   |
| `packages/shared`  | Shared JavaScript definitions.                              |
| `tests`, `scripts` | Browser/acceptance checks and verification tooling.         |
| `deploy`, `docs`   | Deployment templates, operational guides and audit reports. |

## Run locally

Use **Node.js 22.13+**, npm and an accessible MongoDB server. Local MongoDB and MongoDB Atlas are supported.

From the repository root in PowerShell:

```powershell
npm ci --include=dev --cache .local/npm-cache
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Edit the private root `.env` to configure `MONGODB_URI`. For Atlas, use the intended database, database-user credentials and permitted network access. Keep the connection string out of Git, screenshots and public logs. The command above preserves an existing `.env`.

```powershell
npm run config:check
npm run dev
```

Open `http://localhost:5173` or `http://127.0.0.1:5173`. The API defaults to port **5000**. Development CORS explicitly supports both frontend origins; other origins require configuration.

For an ordinary administrator account, run `npm run admin:create`. Development can generate private credentials in ignored `.local/admin-access.json`; existing accounts are not overwritten. Production provisioning requires explicit administrator credentials. Administrators provision operators through fleet management; citizens use public registration. Demonstration/simulation accounts use their respective preparation guides instead.

| Portal                       | Entry points                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Citizen                      | `/register`, `/citizen/login`, `/report`, `/my-reports`, `/my-alerts`        |
| Municipal                    | `/login`, `/admin`, `/admin/reports`, `/admin/allocations`, `/admin/tankers` |
| Delivery oversight           | `/admin/deliveries`                                                          |
| Prediction, analytics, audit | `/admin/predictions`, `/admin/analytics`, `/admin/audit`                     |
| Operator                     | `/login`, `/operator`, `/operator/assignment/:id`                            |
| Public information           | `/alerts`, `/status`                                                         |
| Enabled simulation           | `/admin/simulation`                                                          |

Login and navigation respect the authenticated role. Sign out before switching accounts.

## Configuration and security

The root [.env.example](.env.example) documents settings without real credentials. Runtime variables take precedence over `.env`. Restart backend processes after configuration changes; rebuild the frontend after changing public build variables.

| Setting                             | Purpose                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `MONGODB_URI`                       | Private backend database connection.                                          |
| `CORS_ORIGIN`                       | Exact comma-separated frontend origins; explicit HTTPS origins in production. |
| `VITE_API_BASE_URL`                 | Public frontend build-time API URL; `/api` uses the local proxy.              |
| `PORT`, `NODE_ENV`                  | Backend port and runtime environment.                                         |
| `GEMINI_API_KEY`, `GEMINI_MODEL_ID` | Backend-only real-provider configuration.                                     |
| `DEMO_AI_MODE`                      | Explicit non-production key-free agent demonstration.                         |
| `AI_TIMEOUT_MS`                     | Bounded overall advisory request deadline.                                    |
| `MONGODB_TEST_URI`                  | Optional dedicated test server.                                               |
| Demonstration/simulation flags      | Guarded non-production preparation and execution; see the guides.             |

Never put credentials in `VITE_*` variables: those values are public browser configuration. `.env`, local access files and generated credentials are ignored by Git. Commit templates, not secrets.

The backend enforces password hashing, expiring/revocable database-backed sessions, role authorization, report ownership, input/image limits, rate limits and sanitized errors. Production rejects demonstration/simulation configuration and insecure database/origin settings.

## Testing

```powershell
npm run verify
```

The offline verification workflow runs lint, production build, security/configuration checks, unit/API tests, MongoDB integration tests, desktop/mobile browser tests and development-origin checks. It makes no live Gemini inference requests.

Individual checks include:

```powershell
npm test
npm run test:mongo
npm run build
npm run test:e2e
npm run test:simulation
npm run test:acceptance-journey
npm run security:check
```

MongoDB tests default to a local test server independently of the private application URI. Mutating suites use uniquely named owned test databases with guarded cleanup. Browser checks require a built frontend and a supported browser; Microsoft Edge is the default. See the [testing guide](docs/phase11.md) for prerequisites and alternatives.

Live Gemini diagnostics are separate opt-in tests that may consume quota or incur charges. Mocked success is not proof of live-provider availability. Measured verification results and remaining infrastructure gates are retained in acceptance reports instead of historical test counts in this overview.

## Deployment status

Hosting preparation targets **AWS Amplify Hosting** for the static frontend and **AWS App Runner** for the backend, subject to account/service compatibility. **MongoDB Atlas** can remain the database. AWS hosting is separate from AI; Bedrock and AWS model credentials are not required.

The repository includes frontend build configuration, backend container configuration, health/readiness handling, production validation and a release checklist. Atlas connection and isolated simulation preparation have been verified in the developer workspace. **Public AWS deployment has not been completed or verified.**

Hosted builds need an actual API URL or a configured reverse proxy; Vite's development proxy is absent on static hosting. Database/Gemini secrets belong in backend runtime configuration. Production requires exact hosted-origin CORS, restricted database access and verified authentication/persistence workflows. Review proxy/rate-limit and multi-instance behavior before scaling.

Follow the [deployment guide](docs/deployment-readiness.md) and [readiness report](docs/deployment-readiness-report.md) for commands, compatibility checks and outstanding gates. Local functionality and deployment files alone do not establish production readiness.

## Documentation

[AQUASHIELD_SPEC.md](AQUASHIELD_SPEC.md) is the authoritative specification, including its overriding rules. This README explains the project; detailed implementation history and acceptance evidence remain in supporting documents.

| Topic                    | Reference                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Shortage calculations    | [Clustering, confidence and severity](docs/phase3.md)                                                                            |
| Authentication/access    | [Citizen ownership](docs/phase65.md), [portal authorization](docs/portal-access.md)                                              |
| Municipal workflows      | [Fair allocation](docs/phase6.md), [trips and verification](docs/phase7.md)                                                      |
| AI contracts/reliability | [Agent architecture](docs/phase5.md), [provider resilience](docs/ai-reliability.md)                                              |
| Numerical predictions    | [Formulas, uncertainty and data limits](docs/phase8.md)                                                                          |
| Analytics/audit          | [Metric definitions and audit coverage](docs/phase10.md)                                                                         |
| Demonstrations           | [Faculty walkthrough](docs/demo-guide.md), [dynamic simulation](docs/dynamic-simulation.md)                                      |
| Acceptance evidence      | [Master report](docs/aquashield-master-acceptance-report.md), [simulation results](docs/dynamic-simulation-acceptance-report.md) |
| Deployment               | [Hosting/Atlas guide](docs/deployment-readiness.md), [readiness results](docs/deployment-readiness-report.md)                    |

## Current boundaries

AquaShield supports evidence-based decisions; it does not independently establish physical shortage conditions, verified household receipt or continuous GPS tracking. Population, distance, ETA and forecast risks retain their uncertainty. Live AI depends on provider availability, while supported numerical services continue independently. External messaging, production scaling and public deployment need separate integration and acceptance checks. Demonstration data and simulations are synthetic and separated from ordinary operations.
