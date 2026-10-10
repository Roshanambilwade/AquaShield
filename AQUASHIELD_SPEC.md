# AQUASHIELD SPECIFICATION OVERRIDES

These rules override any conflicting instruction later in this document.

1. Use JavaScript for the main frontend and backend.

2. Frontend: React + JavaScript + Vite.

3. Backend: Node.js + Express + JavaScript.

4. Use `.js` and `.jsx` files for the main application.

5. Do not create `.ts` or `.tsx` files for the main frontend or backend.

6. Do not add a TypeScript shared-types package unless technically required by a dependency. If the official supported Strands Node SDK integration requires TypeScript, isolate it to the backend-only agent service; never convert the main application.

7. AWS is a mandatory core requirement for this hackathon project.
8. **AWS requirement:** Deploy the functioning AquaShield application on AWS in a separate later phase and demonstrate tested public frontend/backend URLs in the final video. Local AWS CLI authentication is currently unavailable and must not block Gemini agent development. Amazon Bedrock is optional, not required for the MVP.

9. **AI implementation:** Use Strands Agents SDK with Google Gemini for Crisis Detection, Resource Allocation, Logistics and Early Warning roles. Keep severity, confidence, population estimates, fairness/priority, distance, ETA and risk scores deterministic in the JavaScript backend. Keep GEMINI_API_KEY only in a backend environment variable, never hardcoded or committed. Provide explicit DEMO_AI_MODE for key-free testing, clearly labeled as simulation rather than actual Gemini execution. Claim real execution only after a successful provider call.

10. **Deployment strategy:** Prefer AWS Amplify Hosting for the React/Vite frontend and AWS App Runner for the Node.js/Express backend, provided these fit the existing repository. MongoDB Atlas may remain the external database. Verify compatibility before selecting the final configuration.

11. **Implementation order:** Follow the latest phase-specific Codex prompts. Preserve all working functionality, use JavaScript for the main application, and test after each phase.

12. **Phase control:** Implement only the explicitly requested phase. Stop afterward, report changes and test results, and wait for the next instruction. Never claim AWS deployment is complete until the public frontend and backend have been successfully tested.



# AQUASHIELD — COMPLETE HACKATHON BUILD SPECIFICATION

**Implementation status (10 October 2026):** Phases 1–11, including citizen authentication/report ownership, are implemented locally. Phase 11 strengthens offline regression testing, isolated cleanup, restart persistence and deployment smoke verification; see docs/phase11.md. It does not change application workflows or numerical engines. Phase 9 prepares deployment without deploying. Phase 10 adds bounded municipal analytics and secure searchable atomic audit history; see docs/phase10.md. Phase 8 adds deterministic, Gemini-independent report-activity forecasts, quality/uncertainty, secure numerical APIs and persisted audited alerts; see docs/phase8.md. Phase 7 includes private citizen-portal OTP handoff, persisted trip/delivery workflows, logistics route evidence and recorded fairness/response analytics. Account participation does not independently verify identity or household receipt. Authorized live Crisis Detection, Logistics and Early Warning tests passed validation; Resource Allocation returned Google HTTP 503 and remains unverified. Existing deterministic calculations and allocation recovery are preserved. See [through-Phase-7 audit](docs/through-phase7-audit.md) and [Phase 7 behavior](docs/phase7.md). Physical water prediction and AWS deployment remain unsupported/deferred; no all-role live acceptance is claimed.

## 1. ROLE

You are a senior full-stack engineer, product designer, and hackathon engineering lead.

Build a working, explainable AquaShield MVP with frontend, backend APIs, MongoDB, citizen reporting, geographic/time shortage detection, confidence, deterministic severity, decision support, fairness-aware allocation, tanker operations, delivery verification, deterministic early warning, an admin dashboard, realistic labeled demo evidence, tests and documentation.

The AWS requirement is actual application deployment, demonstrated through tested public frontend/backend URLs in the final video. AWS is not a required AI/LLM provider. Strands Agents SDK with Google Gemini and four focused roles is the planned MVP agent architecture. Bedrock is optional; local AWS CLI authentication is not needed for Gemini. Numeric calculations remain deterministic backend facts.

Implement one authorized phase at a time. Phase 1–4 application code is already working; this specification describes the completed foundation and planned later phases. Do not infer that later features or AWS deployment are already implemented. Keep the local application runnable with one clear setup process. Reuse working JavaScript modules and do not ask unnecessary clarification questions.

Numeric examples elsewhere are illustrative unless identified as a measured implementation snapshot. Never hardcode example scores or present fictional inputs, simulated verification, approximate population or future forecasts as verified facts.

---

# 2. PROJECT IDENTITY

## Product Name
AquaShield

## Team Name
AquaSentinels

## Hackathon
Environmental Hacks — Heat & Water Track

## One-line description
AquaShield is an explainable emergency water-management platform that detects neighborhood shortages, assesses evidence and severity, and supports fair, human-approved water response decisions. Deterministic early warning and operational response are built in later authorized phases.

## Core pitch
Citizen reports + available infrastructure/environment signals
→ shortage detection
→ verification/confidence
→ deterministic severity
→ explainable priority recommendation
→ human-approved fair allocation
→ tanker dispatch
→ verified delivery
→ deterministic early warning.

Describe current Phase 1–4 modules as deterministic decision support. Phase 5 implements Strands/Gemini roles and demo simulation; real calls require configured credentials and verified execution. Distinguish real Gemini advice from backend facts and key-free DEMO_AI_MODE simulations.

---

# 3. THE REAL-WORLD PROBLEM

During water shortages, pipeline failures, tanker shortages, droughts, or extreme heat:

- residents may not know where to report the problem
- authorities may receive reports through fragmented channels
- a pipeline incident does not always tell authorities how severely people are affected
- some areas may report repeatedly while other affected communities are invisible
- emergency tankers are limited
- deciding which neighborhood gets water first can become subjective
- authorities need evidence before acting
- authorities also need to know whether a situation is getting worse
- after delivering water, it can be difficult to verify that the resource actually reached the affected community

The key problem is:

“How can we detect a genuine local water shortage, understand its severity, predict where the situation may worsen, and fairly allocate limited emergency water resources?”

---

# 4. WHAT AQUASHIELD SOLVES

Citizen Report
→ Location
→ Geographic/time report clustering
→ Verification/confidence
→ Approximate affected population
→ Deterministic severity
→ Explainable priority recommendation
→ Administrator review
→ Fair tanker allocation
→ Estimated route/ETA
→ Delivery verification
→ Recorded response outcome
→ Monitoring and deterministic early-warning risk.

The recommendation layer supplies evidence, rules, assumptions and missing inputs. An authorized administrator approves operational actions. The system records the decision. Strands/Gemini agents will explain backend facts and recommend actions in authorized later phases; allocation, delivery and prediction operations remain phase-scoped. The current deterministic core continues working without model access.

---

# 5. IMPORTANT PRODUCT POSITIONING

Position AquaShield as an intelligence and decision layer for emergency water management.

Its value is report-based detection, spatial/time clustering, evidence-based shortage confidence, transparent deterministic severity, explainable prioritization, fairness-aware allocation, early warning, delivery verification and auditability.

Do not claim to be the first tanker booking system, to know exact remaining water, or to know exact affected population without verified evidence. Label estimates and simulated inputs. Do not market deterministic modules as LLM agents or describe the current application as running Strands/Bedrock. Phase 5 implements Strands/Gemini integration; a complete live assessment remains unverified after Google provider unavailability. Bedrock remains optional.

Current emerging report evidence and future predictive risk are different concepts. Explain what has been implemented, what remains a placeholder, and which later capabilities are planned.

---

# 6. USERS

These are target capabilities, delivered only in their authorized phases.

## 6.1 Citizen
- Report a water problem, location, household size, last supply time and approximate household water level.
- View their own report and recorded verification/response status.
- Never provide total neighborhood population or client-supplied severity/confidence.

## 6.2 Administrator / Municipal Operator
- Sign in, inspect reports and shortage evidence, severity, confidence and approximate affected population.
- Request Strands/Gemini explanations of deterministic priority recommendations in Phase 5, with clear real/demo provenance.
- Review event verification/merging and approve/reject resource allocations when those workflows are implemented.
- Monitor available fleet records, delivery, predictions, analytics and audit history in later phases.
- Gemini explanations supplement backend facts and never authorize dispatch; explicit demo output is labeled as simulation.

## 6.3 Tanker Operator
- In the later operational phase, view assignments and estimated route/ETA, start a trip, record arrival, verify delivery with OTP/QR and record delivered litres.

Phase 4's tanker-operator page is a placeholder, not a working trip or authentication workflow.

---

# 7. CORE FEATURE SET

Implement the MVP in the phase order in section 74 and the latest authorized Codex prompt. Required planned capabilities include deterministic decision support and four Strands/Gemini agent roles. Bedrock is optional; real execution and key-free demo testing are distinct. Implement only the authorized phase.

## MUST HAVE — Citizen Water Shortage Reporting
A signed-in CITIZEN submits location, area/locality, problem type, last supply time, approximate shortage duration, household water category and household size, with optional description/photo. The backend records timestamp and immutable account ownership from its verified session; client-supplied ownership is rejected. Public registration collects name, email and password, assigns CITIZEN on the server and reuses the existing secure sessions. Private history/detail are account-owned. Existing anonymous/imported and demo reports remain ownerless without deletion or reassignment; old browser keys no longer authorize live report access.

Only authorized administrators can review reporter name/email and supporting private evidence. Account/contact/locality information is user-provided; email ownership, identity and residency remain explicitly unverified until a real provider/check is integrated. No fake verification, government ID or paid verification service is required. Public shortage/agent evidence must exclude citizen PII. Own report pages may show recorded area approval/assignment without exposing operator/allocation internals or claiming household delivery.

Problem types: NO_WATER, LOW_PRESSURE, PIPELINE_FAILURE, TANK_EMPTY, WATER_QUALITY, OTHER.

Water categories: EMPTY, LESS_THAN_25, BETWEEN_25_50, ABOVE_50, UNKNOWN.

Do not force citizens to provide neighborhood-wide population, exact water quantity or information they cannot know. Unknown times/durations remain unknown. All subsequent evidence and severity come from backend business logic.

---

# 8. AFFECTED POPULATION LOGIC

Citizens normally cannot know how many people in the entire neighborhood are affected.

Therefore:

DO NOT ask:

“How many total people are affected?”

Instead ask:

“How many people are affected in your household?”

Example:

Household size:
5

Then AquaShield estimates wider impact using aggregated evidence.

For example:

37 reports from one local zone

31 verified

Average household size:
4.2

Historical/local population estimate:
450–700

Estimated affected population:
~620

Display:

Estimated affected population: ~620

Do NOT display:

Affected population: 620

unless the number is genuinely verified.

Always label derived values as:

Estimated

or

Approximate

---

# 9. SHORTAGE DETECTION

Reports should be clustered by geographic proximity and time.

Example:

15 reports within 1 km

during a similar time window

with:

NO_WATER

Then create an aggregated shortage event.

Example:

Shortage Event:

Area:
Panchavati

Reports:
37

Verified:
31

Confidence:
94%

Duration:
18 hours

Status:
CRITICAL

The detection system should calculate:

- report count
- verified report count
- geographic concentration
- time concentration
- infrastructure incident correlation
- consistency of reported problem
- optional environmental signals

---

# 10. CONFIDENCE SCORE

Confidence is NOT “percentage of water remaining.”

Confidence means:

“How confident is AquaShield that a genuine shortage event is occurring in this area?”

Example:

Confidence: 94%

Potential calculation:

- 35% report consistency
- 25% geographic clustering
- 20% independent users
- 10% infrastructure correlation
- 10% time consistency

Make weights configurable.

Show evidence in the dashboard.

Example:

Confidence 94%

Why?

- 31 verified reports
- 37 total reports
- reports concentrated within 0.8 km
- common issue: NO_WATER
- nearby pipeline incident
- reports occurred within 2 hours

---

# 11. SEVERITY SCORE

Create a transparent deterministic severity score.

Do NOT ask an LLM to invent a numeric score.

The backend should calculate the score.

Default weights:

- shortage duration = 25%
- affected population = 20%
- current water level = 20%
- temperature/environmental stress = 15%
- vulnerable population = 10%
- shortage confidence = 10%

Normalize all inputs to 0–100.

Example:

Panchavati:

Duration = 24h → 96
Population = 620 → 82
Water level = <25% → 90
Temperature = 43°C → 95
Vulnerable population = 70
Confidence = 94

Final:

91/100

Classification:

0–29:
LOW

30–59:
MEDIUM

60–79:
HIGH

80–100:
CRITICAL

Make weights and thresholds configurable.

---

# 12. FAIRNESS-AWARE ALLOCATION

The goal is not:

“First person to request gets water first.”

The goal is:

“Highest justified need gets priority while considering previous emergency deliveries.”

Allocation should consider:

- severity
- duration
- affected population
- heat/environmental stress
- shortage confidence
- vulnerable population
- previous emergency deliveries
- tanker availability
- tanker capacity
- distance/ETA

Fairness adjustment is important.

Example:

Area A:
Severity 90
Received 30,000 L yesterday

Area B:
Severity 85
Received 0 L

Area B should potentially be prioritized.

The system should explain this.

Example:

“Area B is recommended first because it has high severity, prolonged shortage, 540 estimated affected people, and has received no emergency allocation in the last 24 hours.”

---

# 13. STRANDS AGENT FRAMEWORK WITH GOOGLE GEMINI

The planned MVP agent framework is the Strands Agents SDK, with Google Gemini as the real language-model provider. Amazon Bedrock is an optional provider enhancement and must not be a startup, local authentication, testing or MVP dependency. Local AWS CLI authentication is currently unavailable; this does not block Gemini agent development. AWS deployment remains a separate later phase.

Implement four roles: Crisis Detection, Resource Allocation, Logistics and Early Warning. These agents interpret validated evidence and provide explanations/recommendations. They do not calculate authoritative numbers, establish field verification, invent missing inputs, approve resources or write operational state. Reuse backend severityEngine, confidenceEngine, populationEngine, reportClusteringService, fairnessEngine and later routing/prediction services.

The official Node SDK supports TypeScript/JavaScript and documents a Google provider. Prefer JavaScript integration where the selected supported SDK permits it. If its supported integration requires TypeScript, isolate source, tsconfig, dependencies, build and compiled output to a server-side apps/agents service. Never convert apps/web, apps/api or shared application modules, or introduce a TypeScript shared-types package for convenience.

Verify and pin the supported SDK/provider version during implementation, including runtime, tool calling and structured-output capabilities. Current official documentation uses @strands-agents/sdk, @google/genai and GoogleModel from @strands-agents/sdk/models/google. Explicitly select the Gemini provider; do not instantiate an agent with an implicit Bedrock default. Package/import names can change and must be checked against the pinned version. Phase 5 pins @strands-agents/sdk 1.20.0 and @google/genai 2.6.0 and uses their JavaScript exports; live model execution still needs verification with credentials. [Official Node SDK](https://github.com/strands-agents/sdk-typescript), [Google provider](https://strandsagents.com/docs/user-guide/sdk/model-providers/google/)

Use backend-only GEMINI_API_KEY and a configurable GEMINI_MODEL_ID. Provide explicit DEMO_AI_MODE for key-free testing. Demo responses are simulations, not actual Gemini or Strands execution. The preserved Phase 1–4 foundation now has the Phase 5 agent integration; live execution is not claimed without a successful provider request.

---

# 14. CRISIS DETECTION AGENT

The Crisis Detection role uses Strands with Gemini to explain the existing shortage evidence: geographic/time clustering, duplicate/suspicious exclusions, verified report counts, infrastructure/environment context and uncertainty. Backend tools supply computed severity, shortage confidence and approximate population with source references and observation times.

Return an evidence summary, missing inputs, limitations and recommended verification actions. Never create an event, mark a report verified or recompute a numeric score from model text. Existing report submission/detection continues deterministically without waiting for an agent. Automated corroboration is not field verification. Confidence means evidence that a genuine shortage exists, not water remaining.

Phase 5 enables read-only assessment; real output records actual Gemini execution. Explicit demo mode returns the same validated contract with simulation labels and no provider call.

---

# 15. RESOURCE ALLOCATION AGENT AND DETERMINISTIC PRIORITY SERVICE

Phase 5 adds a Strands/Gemini Resource Allocation role around an explainable deterministic priority service. Inputs are existing events, severity/confidence, approximate population, duration, available environmental/vulnerability evidence and verified delivery history when present.

Backend rules and fairnessEngine calculate ranking, fairness adjustments and stable tie-breakers. Unknown delivery history is not zero deliveries; preserve null/partial priority and explain evidence-only ordering. The agent explains the backend ordering, identifies limitations and proposes assessment actions; it cannot alter scores, numeric priority or approved state. Reuse shortage confidence rather than inventing a numeric recommendation confidence.

Output separates authoritative deterministicFacts (rule version, ranked event references, scores/estimates, source evidence, assumptions and unknowns) from agentAdvice (role, validated narrative/action, provider and execution metadata). Gemini must be explicitly selected for real calls. DEMO_AI_MODE uses labeled deterministic simulations, never a fake provider-executed flag.

Recommendations remain read-only in Phase 5. Tanker feasibility/selection and human-approved assignments belong to Phase 6. A missing fleet is unavailable evidence, not permission to invent a tanker. The backend revalidates constraints before any later human-approved operation.

---

# 16. LOGISTICS AGENT AND BACKEND ROUTING — LATER OPERATIONS

Define the Logistics Strands/Gemini role in Phase 5. Until the operational phases supply recorded fleet/trip/routing facts, it explicitly reports unavailable inputs rather than inventing an assignment, distance or ETA. Phase 7 now supplies persisted selected-trip route evidence to this read-only role.

In Phase 6 the backend checks stored tanker locations, capacities, availability and assignments and selects feasible candidates deterministically. Phase 7 adds distance and estimated ETA using a configured routing source or labeled straight-line/average-speed fallback. All numeric distance/ETA/feasibility calculations stay in the JavaScript backend.

The agent explains the backend result, constraints, assumptions and recommended operational steps. It cannot invent coordinates, traffic, exact arrival times, fleet availability or capacity, and cannot dispatch. Administrator approval plus fresh backend feasibility checks authorize assignment. Clearly label estimates and simulated records. Bedrock and AWS CLI credentials are not required for Gemini execution.

---

# 17. EARLY WARNING AGENT AND DETERMINISTIC RISK — LATER PREDICTION

Define the Early Warning Strands/Gemini role in Phase 5 with an explicit unavailable-data response until a separately authorized later phase implements prediction tools. Phase 7 implements trips/delivery only. Do not call current EMERGING clusters forecasts.

Phase 8 implements predictionEngine for eligible report activity using non-overlapping historical windows, bounded EWMA and normalized activity risk. All extraction, calculation, uncertainty and alerts run in JavaScript backend services independently of Gemini/Strands. Supply delay, environmental/infrastructure effects or physical water forecasts require separately validated historical measurements; do not manufacture these inputs. See section 58 and docs/phase8.md.

The agent explains these results and recommends preparation actions. It cannot generate authoritative risk numbers or turn illustrative 87/100 or 12–24-hour examples into facts. Backend reasons remain inspectable separately from Gemini advice. Demo mode uses labeled simulated inputs and backend-derived numbers with no model call. The separately authorized Phase 8 provides numerical prediction and persisted alerts; Gemini explanation remains optional and cannot block access.

---

# 18. AGENT ORCHESTRATION AND BACKEND BOUNDARIES

Citizen report → existing JavaScript clustering/confidence/population/severity services → persisted event → authorized read-only assessment → backend deterministic priority/fairness facts → Strands/Gemini role explanations → administrator review.

Phase 6 adds backend fleet tools and human-approved assignment; Phase 7 adds deterministic route estimates, owned trips and delivery verification. Deterministic prediction remains a separately authorized later phase. Four focused roles share the existing backend service; no new agent tools or provider changes are required for Phase 7.

Express authenticates/authorizes requests before invoking agents. If isolated apps/agents is required, use a validated internal contract and protected server-to-server boundary; no public unauthenticated agent endpoint or direct browser key access. Agents get bounded, read-only backend tools and cannot mutate MongoDB/allocations. Do not pass arbitrary citizen text as instructions.

Track request/role, source event and evidence version, framework/provider/model, timestamps, execution status, demo flag and validated output. Use bounded timeouts, retries and tool-call budgets. Agent failure must not prevent report persistence, deterministic detection, scores or existing dashboards. Never silently switch a failed real call into a successful demo or Bedrock call.

---

# 19. HUMAN-IN-THE-LOOP

Agents propose assessment/actions and explain deterministic evidence. Administrators review facts, assumptions, unknowns and actual execution provenance. Only Phase 6's allocation workflow may create an assignment after explicit authorized approval and fresh backend feasibility checks.

Planned operational actions: Approve Allocation, Reject and Recalculate. Record actor, deterministic rule version, source evidence, agent role/provider/execution metadata and outcome. Phase 5 agent responses alone must never dispatch resources. Demo recommendations have the same approval constraints and cannot masquerade as real Gemini execution.

---

# 20. DELIVERY VERIFICATION

After a tanker is assigned:

Status:

ASSIGNED

Then:

EN_ROUTE

Then:

ARRIVED

Then:

DELIVERED

At delivery:

Generate OTP.

Example:

4721

Tanker operator enters OTP.

If correct:

Delivery verified.

Record:

- tanker
- area
- timestamp
- litres delivered
- operator
- verification method
- OTP success
- coordinates if available

Then update:

Total water delivered

People served

Area status

---

# 21. ADMIN DASHBOARD

Create a modern professional command-center dashboard.

Main KPI cards:

- Active Shortages
- Critical Areas
- Estimated People Affected
- Available Tankers
- Tankers En Route
- Water Delivered
- Average Response Time
- High-Risk Areas

Main map:

Display shortage areas.

Marker severity:

LOW
MEDIUM
HIGH
CRITICAL

Clicking an area opens:

Area Name
Severity
Confidence
Duration
Estimated population
Reports
Temperature
Current water level
Previous delivery
Recommended action

---

# 22. EXPLAINABLE AGENT RECOMMENDATION PANEL

In Phase 5, build a visible recommendation panel showing backend severity, shortage confidence, approximate population, deterministic priority, source evidence, fairness context, missing inputs and rule version alongside validated Strands/Gemini explanations.

Clearly distinguish execution states: Gemini-generated advice (actual successful call), Demo AI simulation (no model execution), deterministic evidence only, unavailable/pending and failed provider call. Show agent role and real provider/model when applicable. Never label backend scores as Gemini-calculated or simulate an execution badge.

A tanker proposal appears only when real or clearly labeled simulated records and tested backend selection/routing exist in Phase 6. Unknown delivery history is unknown, not "no recent delivery." Approve Allocation requires the later workflow and authorization.

Phase 5 replaces the historical Phase 4 placeholder with the implemented role selector, recommendation, evidence, missing-input and human-review panel.

---

# 23. EARLY WARNING PANEL

Show:

## Emerging Risks

Area C
Risk:
87/100

Expected:
12–24 hours

Reasons:
- report count increasing
- water supply delayed
- extreme heat

Recommended:

“Prepare emergency tanker capacity.”

---

# 24. CITIZEN FRONTEND

Create a clean mobile-first citizen experience.

Phase 6.5 adds `/register` and `/citizen/login`, requires a citizen session for report submission and provides account-owned `/my-reports`. Public landing/aggregate alerts and explicit non-production fictional report views remain accessible. Registration collects name/email/password only; contact and identity are unverified.

Home:

AquaShield

“Report water problems in your area.”

Buttons:

Report Water Shortage

Track My Report

View Active Local Alerts

---

# 25. CITIZEN REPORT FORM

Fields:

Location
Use current location

Area/locality

Problem

Last water supply

How long without water?

Current household water level

Household size

Optional description

Optional photo

Submit Report

After submission:

“Your report has been received.”

Show:

Report ID

Current verification status

---

# 26. CITIZEN REPORT STATUS

Timeline:

Report submitted
↓
Reports being verified
↓
Shortage confirmed
↓
Emergency response planned
↓
Tanker assigned
↓
Tanker en route
↓
Water delivered

Example:

Status:
SHORTAGE VERIFIED

Confidence:
94%

Estimated area impact:
High

Emergency response:
Tanker assigned

---

# 27. TANKER OPERATOR UI

Simple mobile-friendly interface.

Current Assignment:

Tanker:
T04

Capacity:
10,000 L

Destination:
Panchavati

Estimated distance:
6.8 km

ETA:
18 minutes

Buttons:

Start Trip

Mark Arrived

Verify Delivery

Complete Delivery

---

# 28. MAP

Prefer:

React Leaflet + OpenStreetMap

or

Mapbox if a valid environment key exists.

Do not make the entire application dependent on a paid API.

Fallback behavior must exist.

Map layers:

- shortage zones
- reports
- tankers
- emergency routes
- high-risk areas

Use markers and popups.

---

# 29. ROUTING

For hackathon demo:

Provide real route calculation if a routing API is configured.

Otherwise:

- calculate straight-line distance using coordinates
- estimate ETA using configurable average speed
- clearly label as estimated

Example:

Distance:
6.8 km

Estimated ETA:
18 min

Never fabricate exact traffic conditions.

---

# 30. DATA MODEL

Use MongoDB.

Collections:

users
reports
shortageEvents
areas
tankers
allocations
deliveries
incidents
waterSupply
predictions
auditLogs

---

# 31. USER MODEL

The current User model stores name, unique normalized email, server-assigned role, private scrypt passwordHash, disabled state and nullable emailVerifiedAt. Public responses omit passwordHash and expose emailVerified. Phone is an optional future field, not collected by Phase 6.5. The illustrative shape below is not a registration request; public registration rejects role and verification fields.

{
  "_id": "...",
  "name": "Demo Citizen",
  "email": "citizen@example.com",
  "phone": "...",
  "role": "CITIZEN",
  "createdAt": "..."
}

Roles:

CITIZEN

ADMIN

OPERATOR

---

# 32. REPORT MODEL

Current ownership uses immutable `ownerId` from authenticated backend identity. It is nullable only for preserved ownerless legacy/imported/demo records. Internal reporterKeyHash and submissionId support existing duplicate/idempotency logic and are never public ownership credentials.

{
  "_id": "...",
  "ownerId": "...",
  "location": {
    "lat": 19.9975,
    "lng": 73.7898
  },
  "areaId": "AREA_01",
  "problem": "NO_WATER",
  "lastSupplyTime": "...",
  "reportedDurationHours": 18,
  "waterLevel": "LESS_THAN_25",
  "householdSize": 5,
  "description": "...",
  "verificationStatus": "PENDING",
  "createdAt": "..."
}

---

# 33. SHORTAGE EVENT MODEL

{
  "_id": "...",
  "areaId": "AREA_01",
  "reportIds": [],
  "reportCount": 37,
  "verifiedReportCount": 31,
  "confidenceScore": 94,
  "estimatedAffectedPopulation": 620,
  "durationHours": 24,
  "severityScore": 91,
  "severityLevel": "CRITICAL",
  "status": "ACTIVE",
  "createdAt": "..."
}

---

# 34. AREA MODEL

{
  "_id": "AREA_01",
  "name": "Panchavati",
  "center": {
    "lat": 20.011,
    "lng": 73.790
  },
  "populationEstimate": 12000,
  "averageHouseholdSize": 4.2,
  "vulnerablePopulationEstimate": 1100
}

---

# 35. TANKER MODEL

{
  "_id": "TANKER_04",
  "registrationNumber": "MH-15-AB-1234",
  "capacityLitres": 10000,
  "currentLocation": {
    "lat": 19.995,
    "lng": 73.780
  },
  "status": "AVAILABLE",
  "operatorName": "Demo Operator"
}

Statuses:

AVAILABLE
ASSIGNED
EN_ROUTE
ARRIVED
OFFLINE

---

# 36. ALLOCATION MODEL — LATER OPERATIONS PHASE

Illustrative future record; this is not the current database implementation:

{
  "_id": "...",
  "areaId": "AREA_01",
  "tankerId": "TANKER_04",
  "severityScore": 91,
  "recommendationMethod": "DETERMINISTIC",
  "recommendationRuleVersion": "...",
  "sourceRecommendationId": "...",
  "reasoning": [],
  "unknownInputs": [],
  "approvedBy": "...",
  "status": "APPROVED",
  "createdAt": "..."
}

Do not default aiRecommendation to true. Gemini advice must carry explicit real/demo execution provenance separate from deterministic recommendationMethod; human approval and backend scores remain authoritative.

---

# 37. DELIVERY MODEL

{
  "_id": "...",
  "allocationId": "...",
  "tankerId": "TANKER_04",
  "areaId": "AREA_01",
  "litresDelivered": 10000,
  "otpVerified": true,
  "status": "DELIVERED",
  "deliveredAt": "...",
  "operatorId": "..."
}

---

# 38. PREDICTION MODEL

{
  "_id": "...",
  "areaId": "AREA_03",
  "riskScore": 87,
  "riskLevel": "HIGH",
  "horizonHours": 24,
  "reasons": [],
  "recommendation": "...",
  "createdAt": "..."
}

---

# 39. AUDIT LOG — PHASE 10 COVERAGE

Phase 10 projects existing atomic embedded journals into ADMIN-only searchable history, with event/target references, timestamp, authenticated actor role, server correlation UUID, safe previous/resulting state, outcome and demo/operational provenance. New report creation and existing allocation, reservation, trip, OTP, completion/recovery, balance and alert lifecycle writes retain their conditional integrity protections. Legacy missing metadata remains unknown. There is no new report-verification/review workflow; REPORT_VERIFIED, SHORTAGE_DETECTED and PREDICTION_GENERATED are not claimed as journal event types merely because they appeared in a planned list. Existing prediction records retain their original evidence separately. See docs/phase10.md for the implemented action catalog and restrictions.

Recommendation metadata separates deterministic rule version/source evidence/assumptions from agent role/framework/provider/model/execution status. Record DEMO_SIMULATION, REAL_GEMINI, DETERMINISTIC_ONLY and failures distinctly, with request/evidence versions and validated outcome. Never emit a successful provider/agent-executed event for a mock, missing key or failed call. Never log API keys, auth tokens or unnecessary private citizen data.

GET /api/audit supports validated UTC window, event type, actor ID, target type/ID, outcome, correlation ID and bounded server pagination; GET /api/audit/:id returns one safe event. No audit mutation API. Operational model guards protect journal edits/deletion; direct database privileges and retention/archival require separate controls. Existing restricted fictional reset remains prohibited in persistent demonstration mode. Authentication/authorization events use safe operational logging, not a newly persisted authentication ledger.

---

# 40. API DESIGN

Preserve existing REST routes and authorization. Routes below are phase-scoped targets, not claims that all endpoints already exist. README must identify the actually implemented API subset.

## Authentication
POST /api/auth/register — public strict citizen registration; server-assigned CITIZEN
POST /api/auth/login
GET /api/auth/me
POST /api/auth/logout
Phase 6.5 reuses existing sessions across CITIZEN, ADMIN and OPERATOR without public administrative/operator registration. New reports require a CITIZEN session; private list/detail use backend-derived ownership. ADMIN-only GET /api/dashboard/reports and GET /api/dashboard/reports/:id provide private source/contact/evidence review with explicit verification uncertainty.

## Reports
POST /api/reports
GET /api/reports
GET /api/reports/:id
PATCH /api/reports/:id is a future authorized feature, not a current endpoint.

## Shortage Events and Severity
GET /api/shortages
GET /api/shortages/:id
POST /api/shortages/detect — admin only
GET /api/shortages/:id/severity
POST /api/shortages/:id/calculate-severity — admin only
POST /api/shortages/:id/verify — later verification workflow

## Agent-Assisted Decision Support
Phase 5 uses the /api/ai/* routes below; there is no persisted recommendation-history API. Future POST /api/recommendations/prioritize or GET /api/recommendations/:id routes require separate authorization and must not duplicate business logic.

## Four-role agent invocation — implemented Phase 5
POST /api/ai/detect, POST /api/ai/allocate, POST /api/ai/logistics and POST /api/ai/predict invoke the corresponding read-only assessment roles through protected Express APIs. Route names do not authorize resource allocation, dispatch or prediction generation. Use validated inputs, admin authorization, rate limits and explicit mode/provenance. Later backend tools remain unavailable until their operational/prediction phase. POST /api/ai/recommend-allocation aliases the Resource Allocation implementation. Requests accept optional eventId and demo only; callers cannot supply numeric facts or prompts.

## Tankers — later operations phase
GET /api/tankers
GET /api/tankers/:id
POST /api/tankers/:id/assign
PATCH /api/tankers/:id/status

## Allocations — later operations phase
GET /api/allocations
POST /api/allocations/recommend
POST /api/allocations/:id/approve
POST /api/allocations/:id/reject

## Deliveries — later operations phase
POST /api/deliveries/:id/start
POST /api/deliveries/:id/arrive
POST /api/deliveries/:id/verify
POST /api/deliveries/:id/complete

## Deterministic Predictions — Phase 8
GET /api/predictions
POST /api/predictions/evaluate

## Dashboard — existing Phase 4
GET /api/dashboard/summary
GET /api/dashboard/map
GET /api/dashboard/analytics
GET /api/dashboard/shortages/:id

---

# 41. FRONTEND ROUTES

Create:

/

Citizen landing page

/report

Report water shortage

/report/success

Submission confirmation

/my-reports

Citizen report history

/report/:id

Track individual report

/login

Login

/admin

Admin dashboard

/admin/shortages

Shortage management

/admin/allocations

Allocation management

/admin/tankers

Tanker management

/admin/predictions

Early warnings

/admin/analytics

Analytics

/operator

Tanker operator dashboard

/operator/assignment/:id

Current assignment

---

# 42. FRONTEND DESIGN

Preserve the working React + JavaScript + Vite application and existing CSS/component system. Do not convert to TypeScript or introduce a styling/state library solely to satisfy an outdated stack example.

Keep a clean environmental dashboard with high readability, reusable components, mobile-first citizen reporting and a desktop-first responsive admin command center.

Components include MetricCard, SeverityBadge, ConfidenceBadge, ShortageCard, ReportCard, MapView, TankerCard, DecisionSupportPanel, PredictionCard, Timeline, AllocationModal, DeliveryVerificationModal, LoadingState, EmptyState, ErrorState and Toast, implemented only when needed in their authorized phase.

The planned Strands/Gemini UI must distinguish real provider execution, demo simulation, deterministic evidence and unavailable/error states. Numeric fields come from the backend.

---

# 43. DASHBOARD INFORMATION HIERARCHY

AquaShield command-center heading
→ Honest KPIs
→ Map and active shortage evidence
→ Backend-calculated recommendation with separate Strands/Gemini explanation and real/demo execution label, when Phase 5 is implemented
→ Current emerging evidence / separately labeled predictive risks
→ Recorded tanker operations, when implemented
→ Recent activity and evidence analytics.

Unavailable data stays unknown. Inactive extension points are visibly identified; no fake tanker, delivery, prediction or AI output fills them.

---

# 44. DEMO DATA

Use deterministic seed inputs and fictional data with explicit simulation labels. Current Phase 3/4 data contains five areas and 66 reports, plus simulated environmental/incident context and derived shortage events. Phase 5 preserves these working seed inputs.

Later authorized operations/prediction phases may add more areas, simulated tankers, supply history, allocations, deliveries and historical trend inputs. Their outputs must be calculated by the implemented business rules, not seeded as final severity/confidence/risk/recommendation values.

Do not use private citizen data in demos. Publicly known locality names do not make their fictional reports, verification or weather real. Document which seed collections exist, which commands actually work and which future datasets remain planned.

---

# 45. HERO DEMO SCENARIO

Keep Panchavati as the primary simulated scenario, alongside Satpur, Indira Nagar, Nashik Road and emerging Adgaon. Preserve the current seed inputs and existing calculation logic.

At the current default configuration and fixed seed observation clock, Panchavati has 40 submitted reports, 37 eligible households, 31 simulated verified reports, approximately 588 affected people, 97.6% shortage confidence and 89.5/100 CRITICAL severity. Heat/incident inputs are simulated. These are a calculated implementation snapshot, not hardcoded expected outputs; recompute if evidence/configuration changes.

Other seeded zones derive HIGH, MEDIUM and LOW classifications. Adgaon has limited current report evidence (EMERGING), not a validated forecast. The future prediction demo must use time-series inputs and the deterministic risk model.

Available tankers, assignment, route/ETA, previous delivery and predicted risk remain unknown or unimplemented in Phase 4. Do not claim T04 is available or recommended until the later workflow and labeled records genuinely support it. Earlier examples such as 91/100, 94% and ~620 are illustrative, not requirements to force this seed to a fake output.

---

# 46. END-TO-END DEMO FLOW

## Currently working Phase 1–5 walkthrough
1. Citizen submits a household report; the API stores it in MongoDB.
2. Existing clustering, exclusion handling and confidence calculations update a shortage event.
3. Backend calculates deterministic severity and approximate population from evidence.
4. Administrator signs in, inspects map/table, confidence, severity breakdown, report counts, unknown inputs, activity and analytics.
5. Show labeled seeded scenarios separately from live citizen evidence. Phase 5 recommendations identify demo simulation versus actual Gemini execution independently of the evidence source. Fleet/delivery and forecast values remain unknown where unavailable.

6. Phase 5 generates backend deterministic priority facts plus Strands/Gemini explanations or explicitly labeled demo simulation, with source evidence and assumptions. Real Gemini execution requires a server-side key, not AWS CLI credentials. No dispatch occurs here.

## Planned later-phase complete flow
7. The later operations phase checks actual or explicitly simulated fleet feasibility, administrator approval and audit records before assigning a tanker.
8. Operator progresses ASSIGNED → EN_ROUTE → ARRIVED, with calculated distance and clearly estimated ETA.
9. OTP/QR verification and recorded delivered litres update delivery/operational metrics. People served is approximate unless separately verified; do not infer exact people served from tanker capacity.
10. The later prediction phase calculates early-warning risk/uncertainty in the backend and uses the Early Warning agent to explain preparation guidance from those facts. Do not substitute current emerging evidence for a forecast.
11. The deployment phase demonstrates tested public AWS frontend/backend URLs and MongoDB persistence in the final video.

Only show steps whose phases have actually been implemented and tested. Future allocation/prediction/AWS screenshots or simulated provider responses are not proof of execution. Do not manually force demonstration scores into MongoDB.

---

# 47. AWS REQUIREMENT — ACTUAL APPLICATION DEPLOYMENT

Satisfy the AWS requirement through real hosting of the functioning application, with public frontend/backend tests and evidence in the final video. Merely naming an AWS product, setting AWS environment variables or using a mock does not satisfy it. Phase 5 does not deploy the application.

Preferred frontend: AWS Amplify Hosting for the existing React/JavaScript/Vite static build. Preferred backend: AWS App Runner for Node.js/Express, conditional on target-account eligibility and compatibility. MongoDB Atlas may remain external; a database migration is not required.

**Availability gate (checked 9 October 2026):** App Runner stopped accepting new customers on 30 April 2026. Existing services continue; verify the target account can provision the needed service before selecting it. If unavailable, assess an AWS container-hosting alternative such as ECS Express Mode in the authorized deployment phase. This does not make AWS AI mandatory. [AWS service notice](https://aws.amazon.com/apprunner/)

Compatibility checks before a final deployment configuration:
- Amplify: verify npm-workspace/root-lockfile install, Node.js 22.13+ support, root build command, apps/web/dist artifacts, apps/web monorepo app root and SPA refresh/fallback without masking asset/API failures. [Monorepo settings](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html), [SPA rewrites](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html)
- Backend: verify a supported Node.js runtime, root workspace install/start command, Sharp's native dependencies, bind address, service port and readiness/startup timing. App Runner supports Node.js 22 but runtime/package compatibility still needs a real build. [Node.js runtime](https://docs.aws.amazon.com/apprunner/latest/dg/service-source-code-nodejs.html)
- App Runner reserves PORT: configure the service's port and verify the existing API receives it; do not add a conflicting user-defined PORT variable. Store database credentials in server-side secret references with appropriate roles, never VITE_* variables. [Environment/secrets](https://docs.aws.amazon.com/apprunner/latest/dg/env-variable.html)
- Atlas: verify DNS/TLS connectivity, credentials, region/latency and restricted network access/egress. Do not default to an unrestricted database allowlist.
- Browser/API integration: static hosting does not run Vite's local proxy. Configure a tested hosted API base URL or explicitly verified reverse proxy; preserve the exact frontend CORS allowlist and check bearer/citizen-token preflights, auth and report/photo persistence.
- Assess in-process rate limits and serialized detection before enabling multiple backend instances. Preserve production demo restrictions; resolve any isolated demo environment explicitly rather than silently enabling fictional production data.

Strands/Gemini agent integration and AWS deployment are separate deliverables. Later hosting must accommodate the agent runtime/build if present, Gemini outbound HTTPS and secure backend environment injection. No Bedrock/model IAM access is required. The deterministic application remains usable without model access. README must report chosen services, compatibility outcomes, actual deployment status, public URLs, verification results and limitations; never claim deployment before public tests pass.

---

# 48. AWS DEPLOYMENT PLAN AND VERIFICATION — LATER PHASE

Prefer one compatible architecture: Amplify Hosting → tested Express API on eligible App Runner → MongoDB Atlas. Service eligibility, runtime/build compatibility and networking must be checked as described in section 47; document any justified AWS-hosting alternative. No cloud resources are created by this specification update.

The authorized deployment phase will configure build/start commands, HTTPS endpoints, exact CORS, SPA/API routing, server-side secrets, database connectivity, health checks and deployment logs. Use Secrets Manager or Parameter Store where needed; use roles instead of committed access keys. Docker/image deployment is an option if managed-source builds do not fit. Include an isolated agent service build/internal endpoint only if that integration requires one; no Bedrock/AgentCore hosting mandate.

Before declaring AWS deployment complete, test public frontend direct navigation/refresh, public API health with MongoDB connected, admin login/authorization/logout, citizen report submission and persistence after reload/reconnect, derived shortage data and dashboard retrieval. Verify unavailable integrations remain honestly unknown. Record service names, URLs, region, commit/configuration, test outcomes and any limits in docs/aws.md and the final video.

Planning notes or local tests are not deployment proof. Keep public live-app evidence and labeled local/isolated seed demonstrations distinguishable. Real Gemini verification is a separate AI acceptance item; neither Bedrock execution nor local AWS CLI model authentication is required. AWS hosting itself still requires verified account access in that later phase.

---

# 49. DOCKER — WHERE PRACTICAL

Keep local npm commands working. Phase 9 prepares backend and static frontend container definitions plus a local-only Compose configuration without deployment, seeding or new database services. Container execution remains unverified until a Docker engine is available. Amplify can host static build artifacts without a frontend container. Pin and scan approved base-image digests before actual deployment; see docs/phase9-deployment-readiness.md.

Optional local docker-compose services: web, api, mongodb and redis only if useful. If SDK compatibility requires an isolated agent service, package its build and protected internal connection during later deployment. A separate container is a deployment choice, not a requirement to convert the JavaScript app or use Bedrock.

---

# 50. REDIS

Redis is optional. Consider it only for measured needs such as dashboard/recommendation caching, duplicate-processing coordination, short-lived OTP storage or shared rate limiting. The core application and deterministic recommendation layer must work without Redis.

Do not introduce Redis merely because it is available. A cache of deterministic recommendations is not an AI provider or proof of LLM execution.

---

# 51. SECURITY

Implement reasonable hackathon security.

Requirements:

- password hashing
- JWT or secure session authentication
- role-based authorization
- input validation
- environment variables for secrets
- no hardcoded API keys
- CORS configured
- rate limiting on sensitive endpoints
- basic error handling
- sanitize uploaded data

Never commit:

AWS credentials

API keys

MongoDB credentials

JWT secrets

Map keys

---

# 52. VALIDATION

Use a validation library such as Zod.

Validate:

- report payload
- coordinates
- household size
- timestamps
- tanker IDs
- allocation requests
- OTP
- role permissions

Backend must never trust frontend data.

---

# 53. ERROR HANDLING

Provide consistent API error format:

{
  "success": false,
  "message": "...",
  "code": "...",
  "details": {}
}

Frontend should show user-friendly errors.

Do not expose stack traces to users.

---

# 54. AGENT SAFETY AND DECISION-SUPPORT RELIABILITY

Use validated, bounded structured backend facts and read-only allowlisted tools. Agents must not invent coordinates, population, tanker availability, quantities, delivery history, field verification or numeric scores, and must never approve allocations. Treat citizen descriptions as untrusted data, not instructions.

Preserve verified, approximate and unknown values separately. Validate output schemas, evidence references, suggested actions and any echoed values against backend facts; reject unsupported/contradictory output rather than trusting model prose. Limit retries, tokens, calls and timeouts; handle provider/rate-limit/safety errors with sanitized API errors and an honest UI state.

Agent failures leave existing report/detection/dashboard functionality operational. Keep keys server-side and redact secrets/private data from prompts, logs, responses and screenshots. Explicit demo mode is a separate labeled execution path, never an automatic real-call fallback.

---

# 55. STRUCTURED AGENT INPUTS AND PROMPTS

Prepare backend-calculated facts rather than duplicating numerical logic: event/area IDs, source/evidence version, observation time, severity, shortage confidence, approximate population, duration, known environmental/vulnerability data, verified delivery context and feasible fleet/routing/risk outputs only when their phase exists.

Unknown previousDeliveryLitres stays null, not zero; missing fleet/history remains unknown. Preserve simulation flags. Send only minimal authorized aggregate evidence to Gemini, not raw database dumps, household photos/coordinates, contact details, citizen/session tokens or API keys.

Define role-specific prompts for Crisis Detection, Resource Allocation, Logistics and Early Warning: explain supplied facts, cite evidence references, identify missing inputs, follow deterministic ordering and recommend allowed human-reviewed actions. Require validated structured responses, never authoritative model-calculated severity/confidence/population/distance/ETA/risk. Version prompts and contracts. Verify tool/structured-output compatibility against the pinned official SDK/Gemini version; validate locally regardless of provider support.

---

# 56. BACKEND SCORE ENGINE

Create a dedicated module:

severityEngine

Functions:

calculateDurationScore()

calculatePopulationScore()

calculateWaterLevelScore()

calculateEnvironmentalScore()

calculateVulnerabilityScore()

calculateConfidenceScore()

calculateSeverityScore()

calculateSeverityLevel()

Also create:

fairnessEngine

Functions:

calculatePreviousDeliveryPenalty()

calculateNeedAdjustment()

calculateAllocationPriority()

---

# 57. REPORT CLUSTERING ENGINE

Create:

reportClusteringService

Responsibilities:

- spatial grouping
- time grouping
- duplicate detection
- shortage event creation
- event updates

For MVP, geographic distance calculations are sufficient.

Example:

Reports within:

1 km

and within:

6 hours

can be considered candidates for the same event.

Make thresholds configurable.

---

# 58. PREDICTION ENGINE

Use the Gemini-independent JavaScript predictionEngine and predictionService. The supported target is approximate eligible report activity, not physical water shortage, depletion or calibrated probability.

Default: twelve complete six-hour UTC windows; minimum eighteen eligible reports and six reporter keys; positive sampled evidence in every window; explicit freshness/invalid/exclusion checks. Missing observations stay unknown and return INSUFFICIENT_DATA. Reuse Phase 3 duplicate/suspicious rules and isolate demo provenance.

Calculation: cap counts at four times their median; baseline is the first N−4 windows; EWMA of recent four windows uses alpha 0.5; normalize relative change against the area baseline. Risk index = 100 × (0.50 bounded positive trend + 0.35 elevated recent-window persistence + 0.15 elevated baseline-window recurrence). Estimate = bounded EWMA, maximum twice baseline. Default LOW/MODERATE/HIGH/CRITICAL thresholds are 25/50/75, configurable. Horizon equals configured window (3, 6 or 12 hours); never invent longer water-supply horizons.

Return target, horizon, observation window, generation/model/config version, provenance, quality, uncertainty, factors, risk and recommended investigation action. Persist supported urgent alerts with idempotent keys, audited acknowledgement/resolution and concurrency protection. ADMIN APIs/dashboard work without an AI key or provider. Backtesting uses past-only observations; insufficient validation data yields null accuracy metrics. Supply/weather/incident signals require separately validated historical inputs. See docs/phase8.md for exact formulas, configuration, APIs, evidence and limitations.

---

# 59. NOTIFICATIONS

Optional.

Implement basic in-app alerts first.

Possible future notification adapters:

Email

SMS

WhatsApp

Push

Do not spend major time on external notification integrations.

---

# 60. ANALYTICS

Phase 10 extends the existing ADMIN analytics page/API with selectable UTC windows (from inclusive, to exclusive, at most 90 days), area filters, persisted report activity/verification cohorts, allocation action timestamps, accepted recorded delivery counts/litres, valid response-time distributions, explicit pending elapsed time, current fleet eligibility/utilization and alert activity/status/risk/area summaries. Existing evidence/hourly/severity panels remain. Every metric's denominator, exclusions, missing values and scope are documented in docs/phase10.md and exposed through UI explanations.

Current severity/fleet snapshots are independent of the historical window. Report milestone means use the earliest valid stored event-linked action per report and do not establish household receipt. DELIVERED records count once, with verified OTP, positive integer litres and valid delivery timestamp; allocations and audit events are not summed as deliveries. Snapshot tanker utilization is busy/reserved records divided by all fleet records, not time utilization. Missing review/physical resolution timestamps and people-served quantities remain unknown.

Observed statistics remain separate from saved Phase 8 approximate report-activity forecasts and optional AI explanations. NOT_EVALUATED, INSUFFICIENT_DATA and stale/unavailable forecasts remain distinguishable. GET analytics/audit never refreshes detection, evaluates predictions, writes records or calls Gemini. No new prediction-accuracy claim, formula, threshold or horizon change.

---

# 61. FAIRNESS ANALYTICS

Display:

Emergency allocations by area

Water received per area

Average response time

Unserved high-priority areas

This demonstrates that AquaShield is trying to distribute scarce resources fairly rather than simply dispatching whoever requested first.

Phase 10 windowed area comparisons use recorded assignments and accepted delivered litres, with valid completed-response denominators. Current high-priority areas without a recorded delivery in that window require review; missing records are not proof of no water supply or measured unfairness. Existing deterministic priority/fairness rules are unchanged.

---

# 62. TECH STACK

Main application: React + JavaScript + Vite + React Router; Node.js + Express + JavaScript + Mongoose + Zod; MongoDB/Atlas; existing sessions and CSS components. Preserve .js/.jsx and shared JavaScript constants; do not migrate the main app to TypeScript.

Map: React Leaflet/OpenStreetMap with the existing offline fallback. Preserve working components. Deterministic backend: severity, confidence, population, clustering, fairness, routing/ETA and later predictionEngine.

Agent framework: official Strands Agents SDK for Node, real model provider: Google Gemini. Configure the Google provider explicitly and verify/pin its supported version. Prefer JavaScript where supported; TypeScript is permitted only inside isolated apps/agents if technically required by the supported integration. No main-app or shared-types conversion.

Provide DEMO_AI_MODE for labeled key-free agent simulation. Bedrock is optional, with no AWS authentication required for local Gemini use. AWS Amplify Hosting plus eligible compatible App Runner, Atlas and any agent-service build/network configuration are verified in the separate later deployment phase. Docker/Redis are optional where justified.

---

# 63. REPOSITORY STRUCTURE

Preserve current JavaScript npm workspaces. Planned modules below do not already exist:

aquashield/
├── apps/
│   ├── web/                 # existing React/Vite .jsx/.js
│   ├── api/                 # existing Express .js; owns deterministic facts
│   └── agents/              # planned server-only Strands/Gemini integration if isolation is needed
├── packages/
│   └── shared/              # existing JavaScript constants/options
├── docs/
│   ├── phase3.md
│   ├── phase4.md
│   ├── demo.md
│   ├── ai-architecture.md   # planned architecture/configuration and execution modes
│   └── aws.md               # planned with actual deployment
├── README.md
├── .env.example
└── package.json

If supported SDK integration requires TypeScript, keep all .ts sources, tsconfig, dependencies and compiled JavaScript output confined to apps/agents. The main .js/.jsx applications consume validated JSON contracts; do not add packages/types or convert application scripts. If JavaScript integration is supported, do not add TypeScript unnecessarily. Phase 5 uses the supported JavaScript SDK exports inside apps/api/src/services/ai; no separate service or TypeScript application is needed.

---

# 64. ENVIRONMENT VARIABLES

Phase 5 extends existing configuration and .env.example with backend-only Gemini and demo settings. Preserve NODE_ENV, PORT, MONGODB_URI/timeouts, exact CORS_ORIGIN, public VITE_API_BASE_URL, ADMIN_SESSION_HOURS, provisioning and deterministic weights/thresholds. Current sessions do not use JWT_SECRET.

Phase 5 validates server-only AI_PROVIDER=gemini, GEMINI_API_KEY (blank in examples), configurable GEMINI_MODEL_ID, DEMO_AI_MODE=false by default and in .env.example, and bounded provider/tool timeout/retry settings. Prefer the explicit Google provider; legacy STRANDS_MODE is not a provider selector. Older ignored .env files may still contain AI_PROVIDER=bedrock; update those locally before real execution. No AWS model credentials are required for MVP Gemini use.

Phase 9 rejects production demo/seed/test overrides, non-Gemini provider selection, unauthenticated/non-TLS or demo/test MongoDB targets and non-HTTPS CORS origins. Production requires an explicit authenticated MongoDB URI with a named live database and an exact HTTPS allowlist. Gemini credentials remain optional for numerical operations. Frontend builds accept /api only with a real reverse proxy, or an HTTPS backend /api URL; public secret variables are rejected. Sessions remain opaque MongoDB bearer tokens, with no JWT secret or cookie configuration. See docs/phase9-deployment-readiness.md.

With DEMO_AI_MODE=true, allow a missing Gemini key and make no provider calls. With demo mode false, a missing key, incompatible model or failed provider returns an explicit agent-unavailable/error state; do not silently simulate, default to Bedrock or break the existing deterministic application. Live Gemini verification requires a real backend key, but offline tests must not.

GEMINI_API_KEY must exist only in a backend/agent-process environment variable loaded from ignored local configuration or injected securely by hosting. Never hardcode/commit it, prefix it with VITE_, return it from an API, log it or place it in browser storage/bundles. Secrets examples remain empty. [Google key guidance](https://ai.google.dev/gemini-api/docs/api-key)

AWS deployment identity/roles are separate from Google model authentication. Local AWS CLI authentication is unavailable and not a prerequisite for agent integration; later deployment must verify account access separately. Hosted API/CORS/network/port settings follow section 47. Redis and Mapbox settings remain optional.

---

# 65. DEMO AI MODE AND SEEDED EVIDENCE

Current seed:demo inserts fictional reports/areas/context and derived shortage events; it runs without AI credentials or DEMO_AI_MODE and creates no agent responses, fleet, delivery or forecasts. Production seed/demo protections remain intact.

In the authorized agent phase, DEMO_AI_MODE=true enables repeatable key-free simulations for all four roles using the same validated input/output contract and backend-calculated numeric facts. Clearly label every demo response in API/UI/audit with isDemo=true, executionMode=DEMO_SIMULATION, providerExecuted=false and actual method. Do not claim Strands/Gemini execution when an offline simulator ran. Unknown later-phase inputs remain unknown, not fabricated fleet/risk data.

With DEMO_AI_MODE=false, record REAL_GEMINI and providerExecuted=true only after an actual successful Gemini call through Strands, with actual provider/model/framework/evidence provenance. Failed/missing-key calls are unavailable/errors, not demo successes. Deterministic core remains usable. Keep test/demo records separate from live evidence; no silent production simulation or weakened demo restrictions.

Later phases may extend labeled seeds, trend/fleet inputs and safe fictional-record reset. Never seed final scores as fake model output or delete private live records. See docs/demo.md for current/future scope and separate AWS deployment evidence.

---

# 66. TESTING

Preserve Phase 1–4 tests and deterministic formula/unknown-input/authorization guarantees. Agent-phase unit/integration tests cover four role contracts, correct explicit Gemini selection, backend tool boundaries, unchanged numeric facts/ranking, prompt injection, schema/evidence validation, missing later-phase data, key redaction, no frontend key exposure and unauthorized invocation.

Offline CI uses DEMO_AI_MODE or injected provider doubles without a real key, AWS CLI authentication or network calls. Assert simulation provenance and zero provider calls, stable backend-derived numbers, and no allocations. Test missing-key real mode, timeouts/rate limits/provider failures and no silent demo/Bedrock fallback. Keep fixture tests separate from a real provider smoke test.

Before claiming real AI complete, perform an explicitly enabled live Gemini integration test through Strands using only synthetic/minimal evidence and a server-side key. Verify actual provider/model provenance and validate the response; do not expect exact model prose. Record four-role outcomes, including honest unavailable tools in Phase 5. Simulation does not satisfy real execution acceptance. Bedrock tests are optional.

Later phases test allocation/approval/OTP/delivery, deterministic risk, public AWS routing/auth/persistence and agent-service deployment if present. Run regressions/lint/build/browser flows after implementation. Documentation-only tasks check consistency, all 12 override rules, links and unchanged-code diffs; do not claim newly run application tests.

---

# 67. README AND DEMO DOCUMENTATION

Document implemented versus planned capabilities honestly: current JavaScript app, existing APIs/auth/setup/tests, deterministic calculations and remaining limitations. Phase 5 replaces the Phase 4 placeholder with the four-role panel. Demo and automated integration tests pass; complete live Gemini assessment remains unverified after Google provider unavailability.

Describe the implemented Strands/Gemini four-role architecture, server-only key/model configuration, JavaScript integration, deterministic ownership of every numeric value, human review and real versus demo provenance. Bedrock belongs under Optional Future Enhancements, not the MVP setup prerequisites. DEMO_AI_MODE tests without a key; it does not prove real Gemini execution. AWS CLI authentication is a separate later deployment issue.

Only document installed packages, working commands/routes, tested model/version and live execution supported by evidence. Explain that older ignored .env files may need AI_PROVIDER=gemini; the current .env.example reflects the new strategy. Never show secrets or private citizen data in screenshots/prompts.

AWS documentation records compatibility/account access, chosen services, actual tested URLs and deployment status; local model execution is not AWS deployment proof. Preserve historical test reports and current seed values instead of inventing new verification results.

---

# 68. OPTIONAL FUTURE ENHANCEMENTS

Not required for MVP:
- Amazon Bedrock as an additional model provider, AWS-specific agent hosting frameworks and additional LLM providers.
- Municipal APIs, IoT sensors, groundwater/satellite monitoring and real-time weather feeds.
- SMS/WhatsApp reporting, multilingual support, advanced trained ML forecasting and predictive tanker positioning.
- Automated infrastructure fault detection and statewide expansion.

Strands with Google Gemini and four agent roles are planned MVP requirements, alongside deterministic severity/confidence/population/fairness/logistics/risk calculations and human oversight. Key-free demo mode is required for testing but is not a substitute for verified real Gemini execution. AWS application deployment remains required in a separate later phase. Optional enhancements need explicit authorization.

---

# 69. FEATURES NOT REQUIRED

Do NOT waste time on:

- payment gateway
- cryptocurrency
- blockchain
- nationwide authentication
- complicated microservices
- separate native Android app
- custom trained ML model
- physical IoT hardware
- advanced social network
- chat system
- unnecessary 3D maps
- 10+ agents
- complicated government integrations

Focus on a working product.

---

# 70. UX PRINCIPLE

A judge should understand the application in 10 seconds.

The admin dashboard should immediately answer:

1. Where is the problem?
2. How serious is it?
3. How confident are we?
4. How many people may be affected?
5. What should we do?
6. Which tanker should be assigned?
7. Why?
8. What risk is coming next?

---

# 71. THREE-MINUTE DEMO STORY

Prepare a truthful story for the implementation actually completed at recording time. See docs/demo.md. Do not present the full future flow as current functionality.

0:00–0:20: Show the problem and citizen/report map. Identify any fictional heat/incident scenario.

0:20–0:50: Submit reports and show persistence, clustering, eligible/verified counts and computed shortage confidence. Seed field checks are simulated, not real verification.

0:50–1:15: Inspect Panchavati and other zones, actual backend severity, approximate population and unknown inputs. Use current calculated values rather than requiring 91/100, 94% or ~620.

1:15–1:45: Show backend deterministic facts/ranking and separately labeled Strands/Gemini advice only after a successful real request, or DEMO_AI_MODE simulation, fairness assumptions and human review. State that live execution is unverified when no successful real request has been recorded.

1:45–2:10: After operations are implemented, show administrator approval, feasible assignment, status progression and estimated route/ETA. Otherwise label this as future work.

2:10–2:35: After delivery verification exists, show OTP/QR verification and recorded litres. Estimated people served must not be presented as exact.

2:35–2:50: After prediction is implemented, show derived risk, assumptions and approximate horizon. Emerging report clusters alone are not forecasts.

2:50–3:00: Demonstrate the public AWS-hosted frontend/API and persistence evidence, or allocate this evidence earlier in the final recording. State verified deployment status and explain remaining limitations. Close with AquaShield's evidence-based decision-support value. The final AWS requirement cannot be satisfied by local-only footage or a Strands/Bedrock logo.

---

# 72. VISUAL STORY

The dashboard should communicate:

DETECT

↓

VERIFY

↓

PRIORITIZE

↓

ALLOCATE

↓

DELIVER

↓

PREDICT

This should be reflected in both the UI and README architecture diagram.

---

# 73. IMPORTANT PRODUCT LANGUAGE

Prefer: estimated/approximate affected population, shortage confidence, deterministic severity, explainable recommendation, recommended allocation, human approval, deterministic early-warning risk, simulated evidence and unknown input.

Use "Gemini-generated advice via Strands" only after verified actual provider execution. Label DEMO_AI_MODE output "Demo AI simulation — no Gemini execution." The Phase 5 panel shows its execution mode and waits for an explicit assessment request. Ranking and available numeric calculations remain labeled deterministic backend results; missing fairness/risk inputs remain unknown.

Avoid unsupported claims of exact affected population, exact remaining water, perfect prediction, autonomous water distribution, real agent execution or completed AWS deployment. Identify the actual method and current phase honestly.

---

# 74. IMPLEMENTATION ORDER

Latest phase-specific prompts control scope. Preserve Phases 1–8, including Phase 6.5 and persistent-demo records. The latest Phase 9 request authorizes deployment readiness preparation only: configuration, safe runtime/health checks, container definitions, offline regression/security/build verification and documentation. No live inference, cloud changes, deployment, production migration, database reset, dynamic simulation, later-phase development or automatic commits. Complete live Gemini acceptance remains separately unverified. Stop after Phase 9.

## PHASE 1 — Foundation (complete)
React/JavaScript/Vite, Express/JavaScript, MongoDB/Mongoose, configuration, routing/layout, health and errors.

## PHASE 2 — Citizen reporting and database (complete)
Validated household/location reporting, private history/status, photos, persistence, demo seeds and CORS.

## PHASE 3 — Shortage detection, confidence and severity (complete)
Geographic/time clustering, duplicate/suspicious handling, events, verification counts, confidence, approximate population, duration, configurable deterministic severity and fairness helpers.

## PHASE 4 — Admin dashboard and map (complete)
Authentication/authorization, KPIs/map/table/details, analytics/activity, responsive/error states and inactive AI extension point.

## PHASE 5 — Strands/Gemini agents and explainable recommendations (implemented; live verification pending)
Implement all four role definitions, explicit Google provider, server-only key/configuration, validated read-only tools/contracts, deterministic priority/fairness evidence, agent explanations, provenance, DEMO_AI_MODE and real Gemini smoke verification. Prefer JavaScript; isolate TypeScript to apps/agents only if required by supported SDK integration. Logistics/Early Warning must report unavailable later-phase tools, without inventing outputs. No tanker assignment, dispatch, delivery or new prediction workflow. No AWS CLI/Bedrock prerequisite. Run regressions, test both modes and stop.

## PHASE 6 — Fair allocation and tanker operations (implemented)
Persisted validated tanker management, existing deterministic severity/fairness-based priority, source-attributed demand/previous-day delivery context, eligible-candidate selection, optional existing Resource Allocation Agent explanation, explicit approval/rejection and atomic assignment, actor/evidence audits and private operator assignment visibility. Unknown values remain unknown; demo operations are explicitly simulated. Separate recommendation, approval and assignment actions revalidate current facts. No routing, trip transitions, delivery completion, OTP/QR, forecast or AWS work. See docs/phase6.md for APIs, reproducible scenarios, tests and limitations.

## PHASE 6.5 — Citizen authentication and report ownership (implemented)
Public server-assigned CITIZEN registration, shared login/current-user/logout, account-owned reporting/history/status, strict role/owner authorization and ADMIN-only reporter/evidence review. Preserve ownerless legacy/demo records, account/contact verification uncertainty and existing Phases 1–6. Reuse existing password hashing, sessions, rate limits and CORS. No email/SMS verification, AI provider changes, AWS deployment or Phase 7 work. See docs/phase65.md for APIs, setup, tests and limitations.

## PHASE 7 — Routing, trips and delivery verification (implemented locally)
Database-backed ASSIGNED → EN_ROUTE → ARRIVED → DELIVERED workflow, deterministic straight-line/average-speed estimates with an optional validated road-routing adapter, owned operator controls, secure hashed/expiring/attempt-limited OTP, private designated-citizen handoff, isolated non-production demo reveal, recorded actual litres, conditional completion recovery, tanker/allocation updates, municipal metrics/history/audits, recorded operational fairness analytics and private citizen response tracking. Logistics advice consumes existing backend route facts. No GPS/traffic/SMS or independently verified identity/household delivery is claimed. External messaging remains optional and requires a configured adapter. See docs/phase7.md and docs/through-phase7-audit.md. Numerical prediction remains outside this phase.

## PHASE 8 — Numerical early warning and report-activity prediction
Deterministic JavaScript feature extraction, quality gates, non-overlapping windows, bounded EWMA, uncalibrated activity-risk classification, uncertainty, past-only backtesting, persisted auditable alerts and ADMIN dashboard/APIs. Gemini/Strands may explain completed results only; outages must never prevent numerical calculation, retrieval or persistence. Insufficient history returns INSUFFICIENT_DATA. No live inference without authorization. See docs/phase8.md.

Separate AWS deployment remains later work: verify account/service eligibility, deployed runtime/network/secrets, Amplify plus eligible App Runner or justified AWS alternative, Atlas and public workflows. Phase 9 prepares local configuration/build/health checks without proving cloud compatibility. No AWS AI prerequisite.

## PHASE 9 — Deployment readiness preparation
Validate production configuration and secret exclusions, preserve current authentication and data, separate liveness/readiness/optional AI availability, bound graceful shutdown, prepare compatible reproducible containers and clean builds, run offline regressions/security checks and document pending deployment requirements. Preserve all demo records and numerical Phase 8 independence. No AWS deployment, cloud changes, migrations, resets, live inference or Phase 10. See docs/phase9-deployment-readiness.md for observed verification and blockers.

## PHASE 10 — Analytics and auditability improvements
Extend existing municipal analytics with accurate bounded historical cohorts, action/milestone denominators, current snapshot distinctions and safe source links. Strengthen existing atomic journals with optional authenticated actor/correlation/transition/outcome metadata; provide ADMIN-only bounded indexed audit search/detail. Preserve operational records, all existing security/concurrency/ownership checks and Phase 8 numerical independence/formulas. Document metric semantics, unknown historical fields, actual tests and file inventory in docs/phase10.md. No simulation, deployment, live inference, later-phase implementation or automatic commit. Stop after Phase 10.

Verified final demo, simulation, polish and actual AWS deployment remain separate explicitly authorized later tasks. Preserve labeled data, distinguish real Gemini from demo output, and show actual public URLs/persistence only after deployment is tested.

## Optional future enhancement
Add Bedrock or other provider/hosting adapters only when requested. They do not gate local Gemini work, deterministic calculations or MVP acceptance.

---

# 75. IMPORTANT CODING RULE

Use reusable JavaScript modules, services, controllers, routes, validation schemas, hooks, components and utilities. Keep business logic separate from HTTP handlers and models separate from controllers. Preserve working components and tests.

Keep recommendation explanations separate from numeric calculations while consuming their authoritative results. Strands/Gemini role integration stays server-side with validated contracts. If technically required, TypeScript is isolated to apps/agents; do not convert the main app or add a shared-types package. Implement only the currently authorized phase.

---

# 76. AUTHORITATIVE BACKEND FACTS AND AGENT EXPLANATIONS

JavaScript backend logic calculates distance, ETA, duration, severity, shortage confidence, approximate population, fairness/priority, capacity/feasibility and later risk scores/horizons. These facts retain source references, observation time, rule version, assumptions and uncertainty. Unknown delivery history remains unknown.

Strands/Gemini agents explain those facts, assess missing evidence and propose allowed actions. Their validated narrative is separate from numeric fields and deterministic ranking. Never use model text as a source of authoritative numbers, operational approval or field verification. Demo AI uses labeled simulations with the same boundaries. Only an actual successful provider call may be described as real Gemini execution.

---

# 77. IMPORTANT DEMO RELIABILITY RULE

Implemented demo operations must work without manual MongoDB edits. Preserve current citizen submission, seed:demo, detection, severity inspection, admin map/detail and history workflows.

Phase 6 provides tested recommendations, approval/rejection and assignment. Phase 7 extends the UI through trips, demo OTP, actual fictional delivered litres and recorded completion. The persistent faculty `seed:demo` command now uses a guarded non-production demonstration database, dedicated authenticated accounts, six-area reports, fleet, allocations and legitimately transitioned trips/deliveries. It inserts missing records only, never deletes/resets existing records or renews observations, and does not run live AI. Trusted demonstration mode accumulates new owned citizen submissions in the same dataset; query flags cannot set submission provenance. Reset is disabled in that environment. The legacy isolated fictional reset still refuses active trips/pending completion outside it. Follow docs/demo-guide.md and docs/phase7.md and disclose recipient-handoff, freshness and navigation limitations. Phase 8 numerical risk is available when historical coverage is sufficient. The existing 48-report faculty dataset remains sparse and is not rewritten to manufacture history; inadequate history is explicitly INSUFFICIENT_DATA.

The final complete demo should run from the UI against tested backend/database services. Show the actual method and label fictional/approximate/unknown inputs. Backend numeric facts can be inspected without a key. Show successful actual Gemini calls before claiming real AI; use DEMO_AI_MODE for clearly labeled key-free simulations, not proof of provider execution.

---

# 78. MVP ACCEPTANCE CRITERIA

These goals are checked only after the authorized phase is implemented/tested; they do not claim future work is already completed.

[x] Citizen reporting/history/status persist in MongoDB with private access boundaries.
[x] Geographic/time clustering, duplicate handling, confidence/verified counts and approximate population remain correct.
[x] Backend severity is deterministic/configurable with all four severity levels; estimates and unknowns are explicit.
[x] Admin authorization, dashboard/map and existing public/private APIs continue working.
[x] Strands with explicitly configured Google Gemini implements Crisis Detection, Resource Allocation, Logistics and Early Warning roles.
[ ] Real Gemini calls are verified with actual provider/model/framework provenance, separate from backend numeric facts.
[x] DEMO_AI_MODE provides key-free labeled simulations with no provider calls; missing-key real mode and provider errors never silently simulate or use Bedrock.
[x] Gemini keys remain server-side and never appear in source control, logs, browser bundles/storage or API responses.
[x] Main React/Express/shared app stays JavaScript; any technically required TypeScript is confined to the agent service.
[x] Deterministic priority/fairness/reasons/unknown inputs remain inspectable and agent tools are validated/read-only.
[x] Fleet/logistics calculations and human-approved assignments, estimated route/ETA, operator status and account-participation delivery OTP work; physical household receipt remains unverified.
[x] Phase 8 deterministic report-activity risk/horizon is calculated without Gemini; optional agent explanation consumes completed evidence without invented numbers (offline-tested; no new live-provider verification).
[x] Audit records, repeatable fictional evidence and implemented safe reset preserve private live data.
[ ] Separate actual AWS deployment is verified through public frontend/backend URLs and MongoDB persistence, shown in the final video.
[ ] README/demo distinguish implemented/planned, simulated/real execution and exact/estimated/unknown values; tests/lint/build pass.

Bedrock, local AWS CLI model authentication and optional provider-specific adapters are not required for MVP agent execution. Offline simulation tests do not satisfy the real Gemini acceptance item.

---

# 79. WHAT TO DO FIRST

Inspect the repository and current authorized phase. Phase 1–4 code already exists and must not be rewritten for this strategy change. Do not execute an old whole-project initialization plan.

For a genuinely empty repository, initialize JavaScript workspaces, React/Vite, Express, MongoDB, shared JavaScript constants, environment validation and a basic citizen → report → dashboard flow before later modules. Do not require shared TypeScript types. Any technically required Strands TypeScript integration is isolated to the server-side agent service in its authorized phase.

For subsequent explicitly authorized implementation: reuse working services, build only that phase, run relevant application/tests, fix regressions, report actual results and stop. Phase 6 authorization does not authorize Phase 7 or deployment. Preserve all 12 override rules.

---

# 80. FINAL ENGINEERING PRINCIPLE

Build a working, explainable, visually strong hackathon MVP around real need, a clear user story, functioning execution, transparent deterministic decisions, human oversight, actual AWS application deployment and a truthful demonstration.

The judge should see where a crisis is reported, how evidence supports severity/confidence, which action deserves attention, why a resource decision was approved and whether delivery was verified. The planned four Strands/Gemini roles explain backend decisions, with verified real execution distinguished from demo simulation. Bedrock is optional and AWS deployment is a separate later deliverable.

Implement only the requested phase, preserve JavaScript and working Phase 1–4 functionality, and never claim deployment or future operations before they are tested.

---
