# AQUASHIELD SPECIFICATION OVERRIDES

These rules override any conflicting instruction later in this document.

1. Use JavaScript for the main frontend and backend.

2. Frontend: React + JavaScript + Vite.

3. Backend: Node.js + Express + JavaScript.

4. Use `.js` and `.jsx` files for the main application.

5. Do not create `.ts` or `.tsx` files for the main frontend or backend.

6. Do not add a TypeScript shared-types package unless it is technically required by a dependency.

7. AWS is a mandatory core requirement for this hackathon project.
8. **AWS requirement:** Satisfy the hackathon's AWS requirement by deploying the functioning AquaShield application on AWS. The deployment must be real and demonstrated in the final video. Do not make Strands Agents SDK or Amazon Bedrock mandatory for the MVP.

9. **AI implementation:** Strands Agents SDK and Amazon Bedrock are optional future enhancements. For the current MVP, use explainable, deterministic backend logic for crisis prioritization, allocation recommendations, and risk scoring. Do not label deterministic outputs as LLM-generated or claim real AI-agent execution.

10. **Deployment strategy:** Prefer AWS Amplify Hosting for the React/Vite frontend and AWS App Runner for the Node.js/Express backend, provided these fit the existing repository. MongoDB Atlas may remain the external database. Verify compatibility before selecting the final configuration.

11. **Implementation order:** Follow the latest phase-specific Codex prompts. Preserve all working functionality, use JavaScript for the main application, and test after each phase.

12. **Phase control:** Implement only the explicitly requested phase. Stop afterward, report changes and test results, and wait for the next instruction. Never claim AWS deployment is complete until the public frontend and backend have been successfully tested.



# AQUASHIELD — COMPLETE HACKATHON BUILD SPECIFICATION

## 1. ROLE

You are a senior full-stack engineer, product designer, and hackathon engineering lead.

Build a working, explainable AquaShield MVP with frontend, backend APIs, MongoDB, citizen reporting, geographic/time shortage detection, confidence, deterministic severity, decision support, fairness-aware allocation, tanker operations, delivery verification, deterministic early warning, an admin dashboard, realistic labeled demo evidence, tests and documentation.

The AWS requirement is actual application deployment, demonstrated through tested public frontend/backend URLs in the final video. AWS is not a required AI/LLM provider. Strands Agents SDK, Amazon Bedrock and real LLM agents are optional future enhancements, outside MVP acceptance.

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

Describe implemented modules as deterministic decision support. AI/LLM integration may be offered later but is not claimed as running in the current application.

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

The recommendation layer supplies evidence, rules, assumptions and missing inputs. An authorized administrator approves operational actions. The system records the decision. No LLM is required for this workflow; allocation, delivery and prediction remain later-phase work.

---

# 5. IMPORTANT PRODUCT POSITIONING

Position AquaShield as an intelligence and decision layer for emergency water management.

Its value is report-based detection, spatial/time clustering, evidence-based shortage confidence, transparent deterministic severity, explainable prioritization, fairness-aware allocation, early warning, delivery verification and auditability.

Do not claim to be the first tanker booking system, to know exact remaining water, or to know exact affected population without verified evidence. Label estimates and simulated inputs. Do not market deterministic modules as LLM agents or describe the current application as running Strands/Bedrock. These integrations are optional future enhancements.

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
- Request an explainable deterministic priority recommendation in Phase 5.
- Review event verification/merging and approve/reject resource allocations when those workflows are implemented.
- Monitor available fleet records, delivery, predictions, analytics and audit history in later phases.
- Optional future LLM summaries are supplementary and never authorize dispatch.

## 6.3 Tanker Operator
- In the later operational phase, view assignments and estimated route/ETA, start a trip, record arrival, verify delivery with OTP/QR and record delivered litres.

Phase 4's tanker-operator page is a placeholder, not a working trip or authentication workflow.

---

# 7. CORE FEATURE SET

Implement the MVP in the phase order in section 74 and the latest authorized Codex prompt. Deterministic decision support is required; real LLM agents are optional future enhancements and not a prerequisite for any MVP phase.

## MUST HAVE — Citizen Water Shortage Reporting
A citizen submits location, area/locality, problem type, last supply time, approximate shortage duration, household water category, household size and timestamp, with optional description/photo. Identity/contact fields may be optional when a later account workflow is implemented; preserve the existing anonymous browser-owned reporting.

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

# 13. DETERMINISTIC DECISION SUPPORT AND OPTIONAL FUTURE AGENTS

The MVP uses small, modular JavaScript services for crisis evidence, priority recommendations, logistics and risk. These are deterministic business services, not LLM agents. Reuse severityEngine, confidenceEngine, reportClusteringService and fairnessEngine rather than recreating their calculations.

Strands Agents SDK, Amazon Bedrock and real LLM-based crisis/allocation/logistics/prediction agents are optional future enhancements. They are not startup dependencies, default providers, required phase deliverables or acceptance criteria. A future adapter may summarize validated evidence but must leave deterministic scores, factual inputs and authorization authoritative.

Do not create a separate agent service or require an AI credential just to run the MVP. Missing information stays unknown, and output provenance must identify the method actually executed.

---

# 14. CRISIS EVIDENCE SERVICE

Reuse the existing geographic/time clustering, duplicate/suspicious handling, shortage event creation and confidence calculations.

Inputs: structured reports, locations, timestamps, problem types, verified infrastructure incidents and environmental data where available.

Outputs: event summary, shortage confidence, evidence, affected zone, severity inputs, report exclusions and recommended verification action. Summaries and verification guidance are generated from backend rules/templates, not an LLM. Automated corroboration does not become field verification.

Return structured data with source references, observation time, method and unknown inputs. Confidence always means confidence that a genuine shortage exists. An optional future crisis-summary agent may explain these authoritative results without recalculating them or inventing evidence.

---

# 15. EXPLAINABLE PRIORITY AND RECOMMENDATION SERVICE

Phase 5 builds an explainable decision-support layer without requiring an LLM, AWS AI credentials or a provider SDK.

Inputs: existing shortage events, deterministic severity/confidence, approximate population, duration, known environmental/vulnerability data and verified delivery history when available. Fleet/capacity/location information may be read where records exist; actual tanker selection/assignment belongs to the later allocation phase.

Use configurable deterministic rules and the existing fairnessEngine. Document ranking and stable tie-breakers. Unknown delivery history is not zero deliveries; retain null/partial priority where required by the existing fairness helpers and explain any evidence-only ordering. Do not invent a fairness benefit from missing records.

Return structured recommendations containing method DETERMINISTIC, rule version, source event references, ranked attention areas, evidence-based reasons, known score components, assumptions, excluded/unknown inputs and recommended assessment actions. Reuse the event's shortage confidence; do not invent a separate numeric recommendation confidence or label it as water remaining.

Recommendations are read-only. No allocation, dispatch or delivery state changes occur in Phase 5. Human approval becomes actionable in the later operations phase. A future optional LLM allocation agent can summarize the validated recommendation but cannot replace numeric ranking or authorization.

---

# 16. DETERMINISTIC LOGISTICS SUPPORT — LATER OPERATIONS PHASE

When tanker operations are authorized, select feasible tankers using stored locations, capacities, availability, existing assignments and deterministic distance/ETA calculations. Do not invent coordinates, fleet availability, traffic or exact arrival times.

Return the candidate tanker/area references, calculated or approximate distance, estimated ETA, capacity checks, selection rules and explanatory reasons. Label assumptions such as straight-line routing or average speed. Missing fleet/location data means no defensible tanker recommendation, not a fabricated assignment.

The optional future Logistics Agent may provide supplementary prose from this structured result. Neither Strands nor Bedrock is required for logistics or human-approved assignment.

---

# 17. DETERMINISTIC EARLY-WARNING SUPPORT — LATER PREDICTION PHASE

Preserve the transparent predictionEngine model in section 58. Use increasing report frequency, supply delay, infrastructure incidents, environmental stress, available rainfall and historical patterns to derive a configurable risk score, level, approximate horizon, reasons and preparation guidance.

No LLM or trained ML model is required. Risk is different from current shortage severity and shortage confidence. In Phase 4, an EMERGING report cluster is limited current evidence, not a forecast. Prediction is not implemented merely because this model is specified.

Risk examples such as 87/100 or 12–24 hours are illustrative. Derive displayed values from actual inputs and label uncertainty/unknown signals. An optional future prediction-summary agent can explain the deterministic model, not substitute invented risk values or certainty.

---

# 18. DETERMINISTIC SERVICE ORCHESTRATION

Input reports
→ Existing clustering and confidence services
→ Backend deterministic severity
→ Explainable priority/recommendation service
→ Administrator review
→ Later-phase deterministic fleet/logistics checks
→ Explicit human approval
→ Recorded tanker assignment.

In the later prediction phase: periodic structured signals → predictionEngine → labeled early-warning risk alerts.

Keep orchestration simple and modular. The MVP does not require an agent runtime or a distributed agent architecture. Optional future Strands/Bedrock adapters must be isolated extensions whose absence does not disable deterministic core services.

---

# 19. HUMAN-IN-THE-LOOP

The deterministic recommendation layer proposes assessment/priority actions. Administrators review evidence, assumptions and missing inputs. Only the later allocation workflow may create an assignment after an authorized approval and fresh availability checks.

Planned operational actions: Approve Allocation, Reject and Recalculate. Record the actor, recommendation provenance, rule version, evidence and outcome. Phase 5 recommendations alone must not dispatch resources.

Any optional future LLM recommendation has the same human-approval and audit requirements, with its supplementary provenance clearly identified.

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

# 22. EXPLAINABLE RECOMMENDATION PANEL

In Phase 5, build a visible AquaShield Recommendation / Decision Support panel using deterministic backend output. Show recommended assessment or priority action, existing severity and shortage confidence, approximate affected population, evidence, fairness context where verified, missing inputs and rule version.

Use language such as "Deterministic recommendation — human review required." A tanker proposal may appear only when real or clearly labeled simulated fleet data and a tested logistics/selection rule exist in the later operations phase. Unknown delivery history must be shown as unknown, not "no recent delivery."

Approve Allocation is available only once the later authorization/allocation workflow exists. No recommendation may be labeled LLM-generated unless an optional future provider actually executed.

The working Phase 4 application currently contains an inactive AI-labeled placeholder. Keep its current code untouched during this documentation task; its text/functionality can be aligned when Phase 5 is explicitly authorized.

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

{
  "_id": "...",
  "userId": "...",
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

Do not default aiRecommendation to true. Optional future LLM involvement must have explicit execution provenance; human approval and backend scores remain authoritative.

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

# 39. AUDIT LOG — IMPLEMENT IN THE AUTHORIZED PHASE

Record decisions with actor, action, entity, entityId, timestamp and metadata.

Events: REPORT_CREATED, REPORT_VERIFIED, SHORTAGE_DETECTED, RECOMMENDATION_GENERATED, ALLOCATION_APPROVED, TANKER_ASSIGNED, TANKER_ARRIVED, DELIVERY_VERIFIED and PREDICTION_GENERATED.

Recommendation metadata includes method DETERMINISTIC, rule version, source evidence, assumptions and missing inputs. A future optional provider may record actual LLM execution separately; never emit an agent-executed event for deterministic code or a mock.

---

# 40. API DESIGN

Preserve existing REST routes and authorization. Routes below are phase-scoped targets, not claims that all endpoints already exist. README must identify the actually implemented API subset.

## Authentication
POST /api/auth/login
GET /api/auth/me
POST /api/auth/logout
Public registration is not implemented in Phase 4 and is not needed for decision support.

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

## Deterministic Decision Support — planned Phase 5
POST /api/recommendations/prioritize
GET /api/recommendations/:id
Use structured evidence, deterministic rules, source/method metadata and admin authorization. These planned routes require no LLM provider and must not allocate or dispatch resources.

## Optional Future AI Adapters
/api/ai/detect, /api/ai/allocate, /api/ai/logistics, /api/ai/predict and /api/ai/recommend-allocation are optional future integration proposals. They are not mandatory MVP endpoints, are not currently implemented and are not aliases that disguise deterministic services as agents.

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

## Deterministic Predictions — later prediction phase
GET /api/predictions
POST /api/predictions/generate

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

Optional future AI UI must disclose actual execution and remain supplemental to deterministic evidence.

---

# 43. DASHBOARD INFORMATION HIERARCHY

AquaShield command-center heading
→ Honest KPIs
→ Map and active shortage evidence
→ Explainable deterministic recommendation, when Phase 5 is implemented
→ Current emerging evidence / separately labeled predictive risks
→ Recorded tanker operations, when implemented
→ Recent activity and evidence analytics.

Unavailable data stays unknown. Inactive extension points are visibly identified; no fake tanker, delivery, prediction or AI output fills them.

---

# 44. DEMO DATA

Use deterministic seed inputs and fictional data with explicit simulation labels. Current Phase 3/4 data contains five areas and 66 reports, plus simulated environmental/incident context and derived shortage events. Do not expand or change these working seeds in this documentation task.

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

## Currently working Phase 1–4 walkthrough
1. Citizen submits a household report; the API stores it in MongoDB.
2. Existing clustering, exclusion handling and confidence calculations update a shortage event.
3. Backend calculates deterministic severity and approximate population from evidence.
4. Administrator signs in, inspects map/table, confidence, severity breakdown, report counts, unknown inputs, activity and analytics.
5. Show labeled seeded scenarios separately from live citizen evidence. The current recommendation placeholder, fleet/delivery values and forecast values must be described as inactive/unknown where applicable.

## Planned later-phase complete flow
6. Phase 5 generates a deterministic, explained priority recommendation with assumptions and source evidence. No LLM is required and no dispatch occurs here.
7. The later operations phase checks actual or explicitly simulated fleet feasibility, administrator approval and audit records before assigning a tanker.
8. Operator progresses ASSIGNED → EN_ROUTE → ARRIVED, with calculated distance and clearly estimated ETA.
9. OTP/QR verification and recorded delivered litres update delivery/operational metrics. People served is approximate unless separately verified; do not infer exact people served from tanker capacity.
10. The later prediction phase calculates early-warning risk, uncertainty and preparation guidance from trend/environment inputs. Do not substitute current emerging evidence for a forecast.
11. The deployment phase demonstrates tested public AWS frontend/backend URLs and MongoDB persistence in the final video.

Only show steps whose phases have actually been implemented and tested. Future allocation/prediction/AWS screenshots or simulated provider responses are not proof of execution. Do not manually force demonstration scores into MongoDB.

---

# 47. AWS REQUIREMENT — ACTUAL APPLICATION DEPLOYMENT

Satisfy the AWS requirement through real hosting of the functioning application, with public frontend/backend tests and evidence in the final video. Merely naming an AWS product, setting AWS environment variables or using a mock does not satisfy it. Deployment is not completed by this documentation task.

Preferred frontend: AWS Amplify Hosting for the existing React/JavaScript/Vite static build. Preferred backend: AWS App Runner for Node.js/Express, conditional on target-account eligibility and compatibility. MongoDB Atlas may remain external; a database migration is not required.

**Availability gate (checked 9 October 2026):** App Runner stopped accepting new customers on 30 April 2026. Existing services continue; verify the target account can provision the needed service before selecting it. If unavailable, assess an AWS container-hosting alternative such as ECS Express Mode in the authorized deployment phase. This does not make AWS AI mandatory. [AWS service notice](https://aws.amazon.com/apprunner/)

Compatibility checks before a final deployment configuration:
- Amplify: verify npm-workspace/root-lockfile install, Node.js 22.13+ support, root build command, apps/web/dist artifacts, apps/web monorepo app root and SPA refresh/fallback without masking asset/API failures. [Monorepo settings](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html), [SPA rewrites](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html)
- Backend: verify a supported Node.js runtime, root workspace install/start command, Sharp's native dependencies, bind address, service port and readiness/startup timing. App Runner supports Node.js 22 but runtime/package compatibility still needs a real build. [Node.js runtime](https://docs.aws.amazon.com/apprunner/latest/dg/service-source-code-nodejs.html)
- App Runner reserves PORT: configure the service's port and verify the existing API receives it; do not add a conflicting user-defined PORT variable. Store database credentials in server-side secret references with appropriate roles, never VITE_* variables. [Environment/secrets](https://docs.aws.amazon.com/apprunner/latest/dg/env-variable.html)
- Atlas: verify DNS/TLS connectivity, credentials, region/latency and restricted network access/egress. Do not default to an unrestricted database allowlist.
- Browser/API integration: static hosting does not run Vite's local proxy. Configure a tested hosted API base URL or explicitly verified reverse proxy; preserve the exact frontend CORS allowlist and check bearer/citizen-token preflights, auth and report/photo persistence.
- Assess in-process rate limits and serialized detection before enabling multiple backend instances. Preserve production demo restrictions; resolve any isolated demo environment explicitly rather than silently enabling fictional production data.

Strands Agents SDK, Amazon Bedrock, AI_PROVIDER, BEDROCK_MODEL_ID and agent credentials are optional future enhancements, not hosting requirements. Deterministic decision support must run without them. README must report chosen services, compatibility outcomes, actual deployment status, public URLs, verification results and limitations; never claim deployment before public tests pass.

---

# 48. AWS DEPLOYMENT PLAN AND VERIFICATION — LATER PHASE

Prefer one compatible architecture: Amplify Hosting → tested Express API on eligible App Runner → MongoDB Atlas. Service eligibility, runtime/build compatibility and networking must be checked as described in section 47; document any justified AWS-hosting alternative. No cloud resources are created by this specification update.

The authorized deployment phase will configure build/start commands, HTTPS endpoints, exact CORS, SPA/API routing, server-side secrets, database connectivity, health checks and deployment logs. Use Secrets Manager or Parameter Store where needed; use roles instead of committed access keys. Docker/image deployment is an option if managed-source builds do not fit, not a requirement to introduce an AI service.

Before declaring AWS deployment complete, test public frontend direct navigation/refresh, public API health with MongoDB connected, admin login/authorization/logout, citizen report submission and persistence after reload/reconnect, derived shortage data and dashboard retrieval. Verify unavailable integrations remain honestly unknown. Record service names, URLs, region, commit/configuration, test outcomes and any limits in docs/aws.md and the final video.

Planning notes or local tests are not deployment proof. Keep public live-app evidence and labeled local/isolated seed demonstrations distinguishable. Optional future Bedrock/Strands execution is not needed for deployment acceptance.

---

# 49. DOCKER — WHERE PRACTICAL

Keep local npm commands working. In the authorized deployment phase, create a backend container if required by the selected AWS hosting approach; a frontend container is optional because Amplify can host static build artifacts.

Optional local docker-compose services: web, api, mongodb and redis only if useful. A separate AI container/service is an optional future enhancement and never a prerequisite for the deterministic MVP or AWS deployment.

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

# 54. DECISION-SUPPORT SAFETY / RELIABILITY

Deterministic recommendations must not invent coordinates, population, tanker availability, water quantities, delivery history or evidence, and must never silently approve allocations.

Operate on validated structured backend facts. Preserve exact verified values, approximate/estimated values and unknown values distinctly. Return structured output with method, rule version, source evidence, reasons, assumptions and missing inputs.

These same constraints apply to an optional future LLM integration. Supplemental prose must not alter authoritative severity/confidence/fairness/risk scores or claim agent execution when no provider ran.

---

# 55. STRUCTURED DECISION INPUTS AND OPTIONAL FUTURE PROMPTING

For deterministic decision support, preprocess existing event evidence rather than duplicating calculations. Supply event/area references, authoritative severity, shortage confidence, approximate population, duration, environmental inputs, verified previous-delivery records when available and valid fleet records only when the relevant phase is implemented.

For example, unknown previousDeliveryLitres must be null, not zero. A missing fleet feed is unknown, not a list of invented tankers. Preserve observation timestamps and simulation labels. Generate reasons from tested rules/templates and return structured output.

Only if a future LLM enhancement is explicitly authorized: do not send raw unstructured database dumps or private report data unnecessarily. Give a bounded validated evidence object, request supplemental explanation/summary, validate the result and disclose the actual provider execution. Prompts and provider responses are not required for the MVP.

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

Create:

predictionEngine

Use explainable signals.

Example:

riskScore =
reportTrend
+ supplyDelay
+ temperature
+ infrastructureRisk
+ historicalPattern

Return:

risk score
risk level
horizon
reasons
recommended action

This does not need to be a trained ML model for the hackathon.

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

Admin analytics page:

- reports per hour
- active shortages
- average response time
- water delivered
- tanker utilization
- critical events
- resolved events
- estimated people served
- allocation fairness
- prediction accuracy if enough data exists

Charts:

Reports over time

Severity distribution

Water delivered

Tanker utilization

---

# 61. FAIRNESS ANALYTICS

Display:

Emergency allocations by area

Water received per area

Average response time

Unserved high-priority areas

This demonstrates that AquaShield is trying to distribute scarce resources fairly rather than simply dispatching whoever requested first.

---

# 62. TECH STACK

Main application: React + JavaScript + Vite + React Router on the frontend; Node.js + Express + JavaScript + Mongoose + Zod on the backend; MongoDB/MongoDB Atlas; existing secure session authentication and CSS components. Keep .js/.jsx files and shared JavaScript constants; no TypeScript application migration or shared-types package.

Map: React Leaflet/OpenStreetMap with the existing offline coordinate fallback. Add chart/state/style libraries only when needed; do not replace working components unnecessarily.

Decision support: existing deterministic severity, confidence, clustering and fairness modules; explainable recommendation services next; deterministic predictionEngine in its later authorized phase.

Deployment: prefer AWS Amplify Hosting and eligible AWS App Runner after section 47's compatibility checks, with Atlas allowed. Docker/Redis are optional where justified.

Optional future AI/LLM enhancements: Strands Agents SDK, Amazon Bedrock or another explicitly selected provider. None is required for local use, recommendations, risk scoring, deployment or MVP acceptance.

---

# 63. REPOSITORY STRUCTURE

Preserve the existing JavaScript npm workspaces and module separation. Proposed future documentation/modules do not imply they already exist:

aquashield/
├── apps/
│   ├── web/                 # React/Vite .jsx/.js
│   └── api/                 # Express .js routes/services/models
├── packages/
│   └── shared/              # JavaScript constants/options
├── scripts/                 # .js scripts if needed; existing API scripts may remain in place
├── docs/
│   ├── phase3.md
│   ├── phase4.md
│   ├── demo.md
│   ├── decision-support.md  # planned with the authorized recommendation phase
│   └── aws.md               # planned with actual deployment
├── README.md
├── .env.example
└── package.json

Do not require apps/agents, packages/types, .ts/.tsx scripts or a standalone agent service. Optional future provider adapters can be isolated inside backend modules without changing the main application's language or core services.

---

# 64. ENVIRONMENT VARIABLES

Keep the existing working .env.example and active validation until a configuration change is explicitly authorized. Main settings include NODE_ENV, PORT, MONGODB_URI, connection timeouts, CORS_ORIGIN, VITE_API_BASE_URL, ADMIN_SESSION_HOURS and the existing configurable clustering/confidence/severity weights and thresholds. Provisioning uses ADMIN_EMAIL/ADMIN_PASSWORD; current sessions do not require JWT_SECRET.

Only VITE_* values are public build-time frontend settings. Database credentials and any deployment secrets stay server-side. Hosted API URLs and frontend-origin allowlists must be set to the actual deployed endpoints; App Runner's service port uses its reserved PORT as covered in section 47.

Legacy AI_PROVIDER=bedrock, BEDROCK_MODEL_ID, STRANDS_MODE and DEMO_AI_MODE placeholders are inactive optional future configuration. Their presence in the current file does not enable AI, establish an AWS dependency for local startup, or make deterministic outputs mocks. They must not become required settings for Phase 5. AWS deployment identity/roles are separate from optional AI-provider access.

REDIS_URL and MAPBOX_TOKEN remain optional. Never include real credentials in examples or commit .env files. This documentation task does not edit environment/configuration code.

---

# 65. DEMO MODE

The working npm run seed:demo inserts deterministic fictional reports/areas/context and derived shortage events for the current Phase 3/4 walkthrough. It does not create a fleet, allocations, deliveries, predictions, citizen accounts or agent responses. It works without AWS/LLM credentials or DEMO_AI_MODE, and production demo restrictions remain in force.

Later authorized phases may extend clearly labeled seeds for tanker operations, delivery and trend-based risk, plus a safe reset:demo equivalent scoped to fictional records. Do not document an unimplemented reset command as currently working. Never delete live reports/accounts or seed final computed scores/recommendations as fake outputs.

See docs/demo.md for current capabilities, future checkpoints and the evidence required before filming an AWS-hosted final demonstration.

---

# 66. TESTING

Preserve all existing Phase 1–4 tests. Add tests only as the corresponding phase is implemented: severity/confidence/clustering, fairness adjustments and unknown history, recommendation ranking/tie-breakers/reasons/provenance, authorization, feasible tanker selection and human approvals, OTP/delivery persistence, deterministic risk and uncertainty, public AWS frontend/backend integration.

Phase 5's full tests must pass with no AI provider credentials/SDK or network model calls. Changing unknown inputs must not cause fabricated exact values, scores or deliveries. Deterministic score/risk tests check the configured rule calculations, not a canned LLM response.

Strands/Bedrock adapter tests are optional future work and not MVP gates. Run relevant regressions, lint/build and browser flows after each authorized implementation phase. For documentation-only edits, verify section consistency, override preservation, links and an application-code-unchanged diff; do not claim newly run application tests that were not executed.

---

# 67. README AND DEMO DOCUMENTATION

Document the problem, solution, implemented features, architecture, actual JavaScript stack, data models, local setup, authentication, current demo commands, environment configuration, implemented APIs, screenshots, demo flow, tests, limitations, future scope and team.

Use a Decision Support section describing the deterministic method. Put Strands, Bedrock and real LLM agents under Optional Future Enhancements. State clearly that the recommendation layer, operational workflows and risk model are planned until their phases are completed. Do not imply that the current Phase 4 AI placeholder executes a provider.

The AWS section must distinguish preferred deployment targets, compatibility/account-eligibility checks, resources actually deployed, tested public URLs and verification status. Cite current service documentation where availability affects the plan. Do not claim completed deployment or AWS AI usage merely from environment placeholders.

Future demo documentation/video must reflect the currently tested implementation, derive scores from evidence, label simulations/estimates/unknowns and show real AWS deployment when complete. Preserve historical test reports with their phase/date context instead of inventing new verification results.

---

# 68. OPTIONAL FUTURE ENHANCEMENTS

Not required for MVP:
- Strands Agents SDK orchestration and real LLM-based crisis/allocation/logistics/prediction-summary agents.
- Amazon Bedrock or other explicitly selected LLM providers.
- Municipal APIs, IoT water-level sensors, groundwater/satellite monitoring and real-time weather feeds.
- SMS/WhatsApp reporting, multilingual support and advanced ML forecasting.
- Satellite drought analysis, predictive tanker positioning, automated infrastructure fault detection and statewide expansion.

The deterministic recommendation layer, fairness rules and transparent early-warning model remain core planned MVP capabilities, not optional LLM substitutes. AWS application deployment remains mandatory for the final hackathon demonstration, subject to compatible service selection. Optional enhancements require a separate explicit instruction and must not delay the functioning deterministic MVP.

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

1:15–1:45: After Phase 5 is implemented, show deterministic recommendation reasons, fairness assumptions and human review. Before then, explicitly show the inactive placeholder.

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

Use "AI/LLM-assisted" only for an optional future feature whose real provider execution is verified and clearly distinguished from deterministic rules. Do not use that label for the current placeholder, recommendations, ranking, fairness penalties or risk calculations.

Avoid unsupported claims of exact affected population, exact remaining water, perfect prediction, autonomous water distribution, real agent execution or completed AWS deployment. Identify the actual method and current phase honestly.

---

# 74. IMPLEMENTATION ORDER

The latest phase-specific Codex prompts are authoritative. Phase 1–4 are complete; preserve their working functionality. This task only aligns documentation and starts no development phase.

## PHASE 1 — Foundation (complete)
React/JavaScript/Vite, Node.js/Express/JavaScript, MongoDB/Mongoose, environment configuration, base routing/layout, health and errors.

## PHASE 2 — Citizen reporting and database (complete)
Location/locality and household reporting, validated report API, private report history/status, photo support, MongoDB persistence, labeled seeds and local-origin CORS.

## PHASE 3 — Shortage detection, confidence and severity (complete)
Geographic/time clustering, duplicate/suspicious handling, persisted events, verification counts, confidence, approximate population, duration, deterministic configurable severity and fairness helpers. Preserve these modules.

## PHASE 4 — Admin dashboard and map (complete)
Admin authentication/authorization, KPIs, map/table/details, evidence analytics/activity, responsive/error states and inactive recommendation extension point.

## PHASE 5 — Explainable deterministic decision support (NEXT, not started)
Modular recommendation service using existing severity/confidence/fairness evidence; configurable priority rules and stable tie-breakers; reasons, provenance, uncertainty/unknown inputs and read-only admin recommendations. No LLM, Strands or Bedrock requirement; no tanker assignment, dispatch, delivery or new prediction workflow. Preserve existing tests and test this phase before stopping.

## PHASE 6 — Tanker allocation and verified delivery (later)
Fleet management/feasibility, deterministic tanker/logistics selection, human-approved allocation, audit trail, operator UI, estimated route/ETA, trip status, OTP/QR verification and recorded litres. Do not silently dispatch from recommendations.

## PHASE 7 — Deterministic early warning and operational analytics (later)
Implement the retained predictionEngine risk model with configurable trend/supply/environment/incident/history inputs, uncertainty and preparation guidance. Add fairness/delivery/prediction analytics based on real or clearly labeled simulated records. No LLM required.

## PHASE 8 — Full verification, hardening and AWS deployment (later)
Full unit/integration/browser regressions, security/error/empty/loading states, compatibility/account-eligibility checks, Amplify frontend plus eligible App Runner backend (or justified AWS alternative), Atlas connectivity, public auth/report/persistence tests and honest AWS documentation. No mandatory Bedrock adapter or Strands configuration.

## PHASE 9 — Verified demo and final documentation (later)
Reproducible labeled scenario/reset where implemented, README/screenshots, final video demonstrating the real AWS deployment and completed end-to-end features, with explicit remaining limitations.

## Optional future enhancement — outside the required MVP phases
Strands Agents SDK / Amazon Bedrock / real LLM agents may be added only when explicitly requested. They remain supplemental to deterministic calculations and human authorization, and are not a condition for phase completion or AWS deployment.

---

# 75. IMPORTANT CODING RULE

Use reusable JavaScript modules, services, controllers, routes, validation schemas, hooks, components and utilities. Keep business logic separate from HTTP handlers and models separate from controllers. Preserve working components and tests.

Keep recommendation explanations separate from numeric calculations while consuming their authoritative results. Optional future LLM adapters remain isolated extensions. Do not require a TypeScript conversion or shared-types package. Implement only the currently authorized phase.

---

# 76. AUTHORITATIVE BACKEND FACTS AND EXPLANATIONS

Backend deterministic logic calculates distance, duration, severity, shortage confidence, recorded capacity/delivery context, approximate population, fairness adjustments and later early-warning risk.

Recommendation reasons and summaries come from explicit tested rules/templates using those values, source evidence, observation times and known missing inputs. Document rule versions and stable priority ordering. Unknown delivery history remains unknown; estimates do not become verified measurements.

Optional future LLMs may supplement summaries/explanations only. They must not invent facts, calculate authoritative numeric scores, override deterministic ranking or approve resources. The required MVP executes and remains explainable without an LLM provider.

---

# 77. IMPORTANT DEMO RELIABILITY RULE

Implemented demo operations must work without manual MongoDB edits. Preserve current citizen submission, seed:demo, detection, severity inspection, admin map/detail and history workflows.

As later phases are authorized, add tested UI actions for generating deterministic recommendations, approving feasible allocations, assigning tankers, progressing trips, verifying/completing delivery and generating deterministic risk. A safe fictional-data reset belongs to a later implemented demo workflow, not a falsely documented current command.

The final complete demo should run from the UI against tested backend/database services. Show the actual method and label fictional/approximate/unknown inputs. No agent call, provider credential or canned LLM response is needed to demonstrate deterministic decisions.

---

# 78. MVP ACCEPTANCE CRITERIA

These are final MVP goals, checked only after their authorized phase is implemented and tested. They do not authorize starting a new phase or claim the current Phase 4 app already meets future goals.

[ ] Citizen can submit a report and retrieve its persisted MongoDB history/status.
[ ] Location, geographic/time grouping and duplicate/suspicious handling work.
[ ] Shortage confidence and verified report counts are explained correctly.
[ ] Approximate affected population remains visibly estimated; unknowns remain unknown.
[ ] Backend severity is deterministic/configurable with LOW/MEDIUM/HIGH/CRITICAL display.
[ ] Admin authorization, dashboard/map/data retrieval and public/private boundaries work.
[ ] Deterministic priority/recommendation service works without LLM credentials or SDKs.
[ ] Recommendation reasons, fairness assumptions, rule version and source evidence are inspectable.
[ ] Feasible tanker selection/logistics and human approval work in the operations phase.
[ ] Assignment, estimated route/ETA and operator trip status are recorded.
[ ] Delivery OTP/QR verification and recorded litres update dashboard metrics.
[ ] Deterministic early-warning risk includes reasons, uncertainty and labeled horizon.
[ ] Audit records, repeatable fictional seeds and a safely implemented reset are available.
[ ] Real AWS frontend/backend deployment is verified through public URLs and MongoDB persistence, shown in the final video.
[ ] README/demo/AWS documentation accurately distinguishes implemented, simulated and future capabilities.
[ ] Environment examples contain no secrets; the application runs locally and core tests/lint/build pass.

Optional future acceptance, not required for MVP: actual Strands orchestration, Amazon Bedrock calls, LLM agents and provider-specific UI/tests. No check above depends on them.

---

# 79. WHAT TO DO FIRST

Inspect the repository and current authorized phase. Phase 1–4 code already exists and must not be rewritten for this strategy change. Do not execute an old whole-project initialization plan.

For a genuinely empty repository, initialize JavaScript workspaces, React/Vite, Express, MongoDB, shared JavaScript constants, environment validation and a basic citizen → report → dashboard flow before later modules. Never require shared TypeScript types or a mandatory agents service.

For subsequent explicitly authorized implementation: reuse working services, build only that phase, run relevant application/tests, fix regressions, report actual results and stop. This documentation update does not authorize Phase 5 implementation or deployment.

---

# 80. FINAL ENGINEERING PRINCIPLE

Build a working, explainable, visually strong hackathon MVP around real need, a clear user story, functioning execution, transparent deterministic decisions, human oversight, actual AWS application deployment and a truthful demonstration.

The judge should see where a crisis is reported, how evidence supports severity/confidence, which action deserves attention, why a resource decision was approved and whether delivery was verified. Optional LLM enhancements may improve presentation later; they are not prerequisites or claimed core execution.

Implement only the requested phase, preserve JavaScript and working Phase 1–4 functionality, and never claim deployment or future operations before they are tested.

---
