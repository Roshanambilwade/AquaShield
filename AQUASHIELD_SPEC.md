# AQUASHIELD SPECIFICATION OVERRIDES

These rules override any conflicting instruction later in this document.

1. Use JavaScript for the main frontend and backend.

2. Frontend: React + JavaScript + Vite.

3. Backend: Node.js + Express + JavaScript.

4. Use `.js` and `.jsx` files for the main application.

5. Do not create `.ts` or `.tsx` files for the main frontend or backend.

6. Do not add a TypeScript shared-types package unless it is technically required by a dependency.

7. AWS is a mandatory core requirement for this hackathon project.

8. Use the Strands Agents SDK + Amazon Bedrock for the real AI layer when AWS credentials are configured.

9. If the currently supported Strands Node SDK technically requires TypeScript for a dedicated AI service, TypeScript may be isolated to that AI service only. Do not convert the main frontend or backend to TypeScript.

10. The implementation phase order given by the Codex phase prompts is authoritative if it conflicts with the phase order described elsewhere in this specification.

11. Build and test one phase at a time. Do not attempt to implement the entire project in a single step.

12. Do not start the next phase automatically. Stop after completing the requested phase, test it, report the result, and wait for the next instruction.


# AQUASHIELD — COMPLETE HACKATHON BUILD SPECIFICATION

## 1. ROLE

You are a senior full-stack engineer, AI engineer, product designer, and hackathon engineering lead.

Build a complete working hackathon MVP called **AquaShield**.

Do not create only a UI prototype.

Build a functioning end-to-end application with:
- frontend
- backend APIs
- database
- AI agent layer
- shortage detection
- verification/confidence
- severity scoring
- fair resource allocation
- tanker assignment
- route/ETA
- delivery verification
- early-warning prediction
- admin dashboard
- citizen interface
- realistic demo data
- AWS integration
- documentation
- tests
- Docker support where practical

The application must be runnable locally with one clear setup process.

Do not ask unnecessary clarification questions. Make sensible engineering decisions and continue.

---

# 2. PROJECT IDENTITY

## Product Name

AquaShield

## Team Name

AquaSentinels

## Hackathon

Environmental Hacks — Heat & Water Track

## One-line description

AquaShield is an AI-powered emergency water-management platform that detects and verifies neighborhood-level water shortages, assesses their severity, predicts emerging risks, and coordinates fair allocation of limited emergency water resources.

## Core pitch

AquaShield does not merely let people request water.

It acts as a **water-crisis detection and decision platform**.

Citizen reports + infrastructure signals + environmental conditions
→ shortage detection
→ verification
→ severity estimation
→ AI-assisted prioritization
→ fair resource allocation
→ tanker dispatch
→ delivery verification
→ early warning for future shortages.

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

AquaShield creates one workflow:

Citizen Report
→ Location
→ Local report clustering
→ Verification/confidence
→ Estimated affected population
→ Severity score
→ AI priority recommendation
→ Fair tanker allocation
→ Route/ETA
→ Delivery verification
→ Crisis resolved
→ Continuous monitoring
→ Early-warning prediction

The system should be designed around a **human-in-the-loop** model.

AI recommends.

The authorized administrator approves.

The system records the decision.

---

# 5. IMPORTANT PRODUCT POSITIONING

Do NOT market the project as:

“the first tanker booking system”

Do NOT claim that citizens can know the exact amount of water remaining.

Do NOT claim that the system knows the exact number of affected people unless verified data exists.

Do NOT pretend simulated data is real.

Instead position AquaShield as:

“An intelligence and decision layer for emergency water management.”

The unique value is:

1. detecting emerging shortages from fragmented reports
2. spatial clustering of reports
3. evidence-based confidence estimation
4. transparent severity scoring
5. AI-assisted prioritization
6. fairness-aware allocation
7. early-warning prediction
8. delivery verification
9. auditability

Existing tanker/request systems can exist. AquaShield focuses on what happens before and after the request: detection, verification, prioritization, prediction, and transparent allocation.

---

# 6. USERS

## 6.1 Citizen

Can:
- report water shortage
- provide location
- report last time water was available
- report approximate household water availability
- report household size
- view report status
- see whether shortage has been verified
- see emergency response status

## 6.2 Administrator / Municipal Operator

Can:
- view all reports
- see active shortage zones
- inspect evidence
- approve/reject/merge shortage events
- view severity scores
- view estimated affected population
- request AI recommendation
- approve tanker allocation
- view tankers
- monitor delivery
- see predictions
- see analytics
- view audit history

## 6.3 Tanker Operator

Can:
- see assigned tanker job
- see destination
- see route
- start trip
- mark arrival
- verify delivery using OTP/QR
- mark delivery completed
- record litres delivered

---

# 7. CORE FEATURE SET

Implement these features in this order.

## MUST HAVE

### 1. Citizen Water Shortage Reporting

A citizen submits:

- name or optional anonymous identifier
- phone/email optional
- location
- area/locality
- problem type
- last supply time
- approximate household water level
- household size
- optional description
- optional photo
- timestamp

Problem types:

- NO_WATER
- LOW_PRESSURE
- PIPELINE_FAILURE
- TANK_EMPTY
- WATER_QUALITY
- OTHER

Water level options:

- EMPTY
- LESS_THAN_25
- BETWEEN_25_50
- ABOVE_50
- UNKNOWN

Do not force users to provide information they realistically cannot know.

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

# 13. AI AGENTS

Use a small number of meaningful agents.

Do NOT create 10+ meaningless agents.

Use 3 primary agents.

Optional fourth prediction agent may be separate.

---

# 14. AGENT 1 — CRISIS DETECTION AGENT

Name:

Crisis Detection Agent

Responsibility:

Analyze structured reports and available signals and identify meaningful shortage events.

Inputs:

- reports
- locations
- timestamps
- problem types
- infrastructure incidents
- weather/environment data if available

Outputs:

- shortage event summary
- confidence
- evidence
- affected zone
- severity input summary
- suspicious/duplicate report detection
- recommended verification action

Example output:

{
  "eventDetected": true,
  "confidence": 0.94,
  "summary": "High-confidence localized water shortage detected in Panchavati.",
  "evidence": [
    "31 verified reports",
    "37 total reports",
    "reports concentrated within 0.8 km",
    "18-hour shortage duration"
  ],
  "recommendedAction": "Prioritize emergency assessment"
}

The output must be structured JSON.

---

# 15. AGENT 2 — PRIORITY AND ALLOCATION AGENT

Name:

Resource Allocation Agent

Responsibility:

Recommend which areas should receive emergency water first and which tanker should be assigned.

Inputs:

- shortage zones
- deterministic severity scores
- estimated affected population
- duration
- temperature
- vulnerable population
- confidence
- previous delivery history
- tanker availability
- tanker capacity
- tanker locations
- distances/ETA

Important:

The deterministic backend score is authoritative.

The AI agent reasons over the already-calculated structured values.

The AI does NOT replace the scoring engine.

Output:

{
  "recommendedAreaId": "AREA_01",
  "recommendedTankerId": "TANKER_04",
  "reasoning": [
    "Highest severity score",
    "Long shortage duration",
    "High estimated affected population",
    "No recent emergency delivery"
  ],
  "fairnessConsideration": "Area received no emergency tanker allocation in the last 24 hours",
  "confidence": 0.91
}

---

# 16. AGENT 3 — LOGISTICS AGENT

Name:

Logistics Agent

Responsibility:

Help select the practical tanker and route.

Inputs:

- tanker locations
- capacities
- availability
- target area
- estimated travel distance
- ETA
- current assignments

Output:

{
  "tankerId": "TANKER_04",
  "destinationAreaId": "AREA_01",
  "estimatedDistanceKm": 6.8,
  "estimatedMinutes": 18,
  "reason": "Closest available tanker with sufficient capacity"
}

Do NOT let the LLM hallucinate coordinates.

Coordinates come from the database.

Distance should be calculated deterministically.

AI can explain the selection.

---

# 17. OPTIONAL AGENT 4 — EARLY WARNING AGENT

Name:

Water Crisis Prediction Agent

Responsibility:

Identify areas that may become critical soon.

Use:

- increasing report frequency
- recent water-supply delays
- infrastructure incidents
- temperature
- rainfall
- previous shortage patterns
- current water availability

For hackathon MVP, this does not need complex machine learning.

A transparent risk model is acceptable.

Example:

Area C

Reports:

2 → 5 → 11 → 18

Temperature:

39 → 41 → 43°C

Supply delay:

8h

Prediction:

Risk score:
87/100

Warning:

“Area C is at high risk of becoming critical within the next 12–24 hours.”

---

# 18. AGENT ORCHESTRATION

Implement the AI workflow as:

Input reports
↓
Crisis Detection Agent
↓
Backend severity calculation
↓
Resource Allocation Agent
↓
Logistics Agent
↓
Admin approval
↓
Tanker assignment

Optional parallel/periodic:

Early Warning Agent
↓
Risk alerts

Use a simple orchestration layer.

Do not over-engineer a distributed microservices architecture.

The hackathon needs a working system, not enterprise complexity.

---

# 19. HUMAN-IN-THE-LOOP

AI must recommend rather than silently dispatch real-world resources.

Dashboard actions:

AI recommendation generated
↓
Admin reviews reasoning
↓
Approve
↓
Tanker assignment created

Buttons:

Approve Allocation

Reject

Recalculate

This provides responsible human oversight.

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

# 22. AI RECOMMENDATION PANEL

Create a highly visible dashboard panel:

## AquaShield AI Recommendation

Recommended action:

Deploy Tanker T04 → Panchavati

Severity:
91/100

Confidence:
94%

Estimated affected population:
~620

Reason:

- 24-hour water shortage
- high report density
- 43°C temperature
- no recent emergency delivery
- high affected population

Button:

Approve Allocation

Also display:

“AI-assisted recommendation — human approval required.”

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

# 36. ALLOCATION MODEL

{
  "_id": "...",
  "areaId": "AREA_01",
  "tankerId": "TANKER_04",
  "severityScore": 91,
  "aiRecommendation": true,
  "reasoning": [],
  "approvedBy": "...",
  "status": "APPROVED",
  "createdAt": "..."
}

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

# 39. AUDIT LOG

Record important decisions.

Examples:

REPORT_CREATED

REPORT_VERIFIED

SHORTAGE_DETECTED

AI_RECOMMENDATION_GENERATED

ALLOCATION_APPROVED

TANKER_ASSIGNED

TANKER_ARRIVED

DELIVERY_VERIFIED

PREDICTION_GENERATED

Store:

- actor
- action
- entity
- entityId
- timestamp
- metadata

---

# 40. API DESIGN

Create REST APIs.

## Authentication

POST /api/auth/register

POST /api/auth/login

GET /api/auth/me

POST /api/auth/logout

---

## Reports

POST /api/reports

GET /api/reports

GET /api/reports/:id

PATCH /api/reports/:id

---

## Shortage Events

GET /api/shortages

GET /api/shortages/:id

POST /api/shortages/detect

POST /api/shortages/:id/verify

---

## Severity

POST /api/shortages/:id/calculate-severity

GET /api/shortages/:id/severity

---

## AI

POST /api/ai/detect

POST /api/ai/allocate

POST /api/ai/logistics

POST /api/ai/predict

POST /api/ai/recommend-allocation

---

## Tankers

GET /api/tankers

GET /api/tankers/:id

POST /api/tankers/:id/assign

PATCH /api/tankers/:id/status

---

## Allocations

GET /api/allocations

POST /api/allocations/recommend

POST /api/allocations/:id/approve

POST /api/allocations/:id/reject

---

## Deliveries

POST /api/deliveries/:id/start

POST /api/deliveries/:id/arrive

POST /api/deliveries/:id/verify

POST /api/deliveries/:id/complete

---

## Predictions

GET /api/predictions

POST /api/predictions/generate

---

## Dashboard

GET /api/dashboard/summary

GET /api/dashboard/map

GET /api/dashboard/analytics

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

Modern professional dashboard.

Design style:

- clean
- minimal
- environmental
- high readability
- modern SaaS dashboard
- responsive
- mobile-first citizen interface
- desktop-first admin interface

Use:

React
TypeScript
Tailwind CSS

Use reusable components.

Important components:

MetricCard

SeverityBadge

ConfidenceBadge

ShortageCard

ReportCard

MapView

TankerCard

AIPriorityPanel

PredictionCard

Timeline

AllocationModal

DeliveryVerificationModal

LoadingState

EmptyState

ErrorState

Toast

---

# 43. DASHBOARD INFORMATION HIERARCHY

Top:

AquaShield
Live Water Crisis Command Center

Then KPIs.

Then:

Map + active shortages

Then:

AI recommendation

Then:

Emerging risks

Then:

Active tanker operations

Then:

Recent activity

---

# 44. DEMO DATA

Create a deterministic seed script.

Use fictional/demo data.

Create approximately:

10 areas

50–100 citizen reports

10 tankers

several infrastructure incidents

water supply history

predictions

allocations

deliveries

Do NOT use real private citizen data.

Clearly label demo environment.

Areas can be fictional or based on publicly known locality names, but make it clear that the data is simulated.

---

# 45. HERO DEMO SCENARIO

The application must be seeded with one extremely strong demo scenario.

Primary area:

Panchavati

Scenario:

Extreme heat:
43°C

Pipeline disruption:

YES

No water duration:

24 hours

Reports:

37

Verified reports:

31

Estimated affected population:

~620

Water level:

Less than 25%

Confidence:

94%

Severity:

91/100

Severity:

CRITICAL

Available tankers:

3

Recommended:

Tanker T04

Estimated distance:

6.8 km

ETA:

18 minutes

Allocation reason:

- highest severity
- long shortage duration
- high affected population
- extreme heat
- no recent emergency allocation

Second area:

High but non-critical.

Third area:

Emerging risk.

The demo should allow judges to immediately understand the difference between:

CURRENT CRISIS

and

EMERGING CRISIS

---

# 46. END-TO-END DEMO FLOW

The complete demo must work like this:

1. Citizen opens AquaShield.

2. Citizen selects:
   Panchavati

3. Reports:
   No water

4. Enters:
   no water for 18+ hours

5. Household size:
   5

6. Current water:
   <25%

7. Submits.

8. System stores report.

9. Multiple existing seeded reports are already nearby.

10. Dashboard updates.

11. Crisis Detection Agent analyzes them.

12. A shortage event is created.

13. Confidence becomes:

94%

14. Backend calculates:

91/100

15. Dashboard labels:

CRITICAL

16. Estimated affected population:

~620

17. Admin opens AI recommendation.

18. Allocation Agent recommends:

Tanker T04 → Panchavati

19. AI explains why.

20. Admin approves.

21. Tanker status:

ASSIGNED

22. Operator sees assignment.

23. Operator starts trip.

24. Status:

EN_ROUTE

25. Route/ETA appears.

26. Operator reaches destination.

27. Status:

ARRIVED

28. System generates delivery OTP.

29. Operator verifies OTP.

30. Enters:

10,000 litres

31. Delivery:

VERIFIED

32. Dashboard updates:

10,000 L delivered

620 estimated people served

33. Meanwhile, prediction panel shows:

Area C
Risk 87/100
High risk within 12–24 hours

34. Admin gets recommendation:

Prepare emergency capacity.

This entire flow must be stable.

---

# 47. AWS INTEGRATION

The project must meaningfully use AWS technology.

Primary AWS open-source technology:

**Strands Agents SDK**

Use it for the AI agent layer.

Prefer integration with:

Amazon Bedrock

for the model used by the agents when credentials/configuration are available.

The system must make the AI provider configurable.

Example environment:

AI_PROVIDER=bedrock

AWS_REGION=...

BEDROCK_MODEL_ID=...

STRANDS_MODE=true

If the local environment does not have AWS credentials:

support DEMO_AI_MODE=true

In DEMO_AI_MODE:
- preserve the same agent interfaces
- use deterministic/mock responses
- clearly separate demo fallback from real agent execution

The production/default architecture should be prepared for real Strands + Bedrock execution.

Do not fake AWS integration.

The README must explain:

1. Which AWS technology is used
2. Why it is used
3. Where it is used
4. How to run it
5. How AWS credentials are configured
6. How demo mode works
7. Which parts can be deployed to AWS

---

# 48. OPTIONAL AWS DEPLOYMENT

Prepare deployment support but do not allow deployment work to break the local MVP.

Potential architecture:

Frontend:
AWS Amplify or CloudFront/S3

Backend:
ECS/Fargate, App Runner, or Lambda/API Gateway

AI:
Strands + Amazon Bedrock

Secrets:
AWS Secrets Manager

Logs:
CloudWatch

Do not implement all of these unless they are needed.

Prefer one simple deployable architecture.

---

# 49. DOCKER

Create Docker support.

At minimum:

Frontend container if useful

Backend container

Optional AI container

docker-compose.yml

Services:

web

api

mongodb

redis (optional)

ai (only if separated)

Do not make Redis mandatory unless the application actually benefits from it.

---

# 50. REDIS

Redis is optional.

Use it for:

- caching dashboard summary
- caching AI recommendations
- preventing duplicate processing
- short-lived OTPs
- rate limiting

Do not introduce Redis merely because it is available.

The core system must work without Redis.

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

# 54. AI SAFETY / RELIABILITY

AI must not:

- invent coordinates
- invent population data
- invent tanker availability
- invent water quantities
- fabricate evidence
- silently approve allocations

The AI may reason only over structured information supplied by the backend.

Any missing information should be stated as unknown.

The AI should return structured JSON wherever possible.

---

# 55. AI PROMPTING PRINCIPLE

Do not give an LLM raw unstructured database dumps.

Preprocess the data.

Give agents:

{
  "area": {...},
  "severity": 91,
  "confidence": 94,
  "estimatedAffectedPopulation": 620,
  "durationHours": 24,
  "temperature": 43,
  "previousDeliveryLitres": 0,
  "availableTankers": [...]
}

Then ask the agent to:

- reason
- explain
- recommend
- return structured output

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

Preferred:

Frontend:
React
TypeScript
Vite
Tailwind CSS
React Router
React Leaflet
Axios
TanStack Query if useful
Recharts

Backend:
Node.js
TypeScript
Express
Mongoose
Zod
JWT/session authentication

Database:
MongoDB

AI:
Strands Agents SDK
Amazon Bedrock

Optional:
Redis

Infrastructure:
Docker
AWS

---

# 63. REPOSITORY STRUCTURE

Use a clean monorepo:

aquashield/
│
├── apps/
│   ├── web/
│   ├── api/
│   └── agents/
│
├── packages/
│   ├── shared/
│   ├── validation/
│   └── types/
│
├── scripts/
│   ├── seed.ts
│   ├── reset-demo.ts
│   └── generate-demo-data.ts
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── ai-agents.md
│   └── aws.md
│
├── docker-compose.yml
├── README.md
├── .env.example
└── package.json

If a separate agents service adds unnecessary complexity, it is acceptable to integrate it into the backend while keeping the agent layer clearly separated.

---

# 64. ENVIRONMENT VARIABLES

Create:

.env.example

Include placeholders like:

NODE_ENV=development

PORT=5000

MONGODB_URI=

JWT_SECRET=

REDIS_URL=

AI_PROVIDER=bedrock

AWS_REGION=

AWS_ACCESS_KEY_ID=

AWS_SECRET_ACCESS_KEY=

BEDROCK_MODEL_ID=

MAPBOX_TOKEN=

DEMO_AI_MODE=true

Do not include real credentials.

---

# 65. DEMO MODE

The project must have a reliable demo mode.

Command:

npm run seed:demo

or equivalent.

This should create:

- areas
- citizens
- reports
- shortage events
- tankers
- incidents
- predictions
- allocations
- deliveries

It should produce the primary demo scenario automatically.

Also create:

npm run reset:demo

to return to the initial scenario.

---

# 66. TESTING

Add tests for the most important business logic.

At minimum:

severity calculation

confidence calculation

report clustering

fairness adjustment

tanker selection

allocation recommendation

delivery OTP verification

authorization

Example:

Input:
24 hours
620 people
<25% water
43°C
94% confidence

Expected:
severity >= 80

Expected:
CRITICAL

---

# 67. README

README must include:

# AquaShield

## Problem

## Solution

## Why this matters

## Features

## Architecture

## AI Agents

## AWS Integration

## Tech Stack

## Data Model

## Running Locally

## Demo Mode

## Environment Variables

## API Overview

## Screenshots

## Demo Flow

## Limitations

## Future Scope

## Team

Do not make unsupported claims.

---

# 68. FUTURE SCOPE

Mention these as future improvements, not required for MVP:

- municipal API integrations
- IoT water-level sensors
- groundwater monitoring
- satellite data
- real-time weather feeds
- SMS/WhatsApp reporting
- multilingual support
- advanced ML forecasting
- satellite-based drought analysis
- predictive tanker positioning
- automated infrastructure fault detection
- statewide deployment

Do not implement these unless core MVP is complete.

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

Build the application so this exact story can be demonstrated.

### 0:00–0:20

Problem.

“During a 43°C heatwave, a pipeline disruption leaves hundreds of people without water.”

Show citizen/report map.

### 0:20–0:50

Multiple citizens report no water.

Show:

37 reports

31 verified

94% confidence

### 0:50–1:15

Dashboard calculates:

Severity:
91/100

Critical

Estimated affected:
~620

### 1:15–1:45

AI recommendation:

Deploy Tanker T04

Show explanation.

### 1:45–2:10

Admin approves.

Tanker moves:

ASSIGNED
→ EN_ROUTE
→ ARRIVED

Show route/ETA.

### 2:10–2:35

Delivery:

10,000 L

OTP verified

620 estimated people served

### 2:35–2:50

Prediction.

Area C:

Risk 87/100

High risk within 12–24 hours.

### 2:50–3:00

Closing statement:

“AquaShield doesn't just respond to water crises. It helps communities detect them earlier and decide where limited water should go first.”

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

Prefer:

“estimated affected population”

“confidence”

“severity”

“recommended allocation”

“AI-assisted recommendation”

“human approval”

“early-warning risk”

Avoid:

“exactly affected population”

“AI automatically controls water distribution”

“100% accurate prediction”

“exact amount of water remaining”

---

# 74. IMPLEMENTATION ORDER

Build in this order.

PHASE 1

Project setup

Frontend

Backend

MongoDB

Authentication

Base layout

PHASE 2

Citizen report

Reports API

Database models

Seed data

PHASE 3

Map

Clustering

Confidence calculation

Severity engine

Admin dashboard

PHASE 4

Strands Agents

Crisis Detection Agent

Allocation Agent

Logistics Agent

Prediction Agent

PHASE 5

Tanker management

Allocation workflow

Operator UI

Delivery verification

PHASE 6

AWS integration

Bedrock adapter

Strands configuration

AWS documentation

PHASE 7

Analytics

Testing

Error states

Polish

PHASE 8

Demo scenario

README

Screenshots

Demo recording preparation

---

# 75. IMPORTANT CODING RULE

Do not generate everything blindly in one giant uncontrolled file.

Use:

- reusable modules
- services
- controllers
- routes
- schemas
- types
- hooks
- components
- utilities

Keep business logic separate from HTTP handlers.

Keep AI logic separate from deterministic scoring.

Keep database models separate from controllers.

---

# 76. IMPORTANT AI RULE

The AI should never be responsible for facts that the backend can calculate.

Backend calculates:

- distance
- duration
- severity
- confidence
- available tanker capacity
- previous delivery
- population estimates

AI handles:

- reasoning
- prioritization explanation
- recommendation
- summarization
- prediction explanation

This makes the system more reliable and easier to demonstrate.

---

# 77. IMPORTANT DEMO RELIABILITY RULE

All important demo operations must work without requiring the team to manually edit MongoDB.

Create buttons/actions for:

- generate crisis
- run detection
- calculate severity
- generate AI recommendation
- approve allocation
- assign tanker
- start trip
- arrive
- verify delivery
- complete delivery
- generate prediction

The complete demo should run from the UI.

---

# 78. ACCEPTANCE CRITERIA

The project is complete when:

[ ] Citizen can submit a water shortage report

[ ] Report is saved in MongoDB

[ ] Location is displayed

[ ] Reports can be grouped geographically

[ ] Shortage confidence is calculated

[ ] Estimated affected population is displayed

[ ] Severity score is calculated deterministically

[ ] Critical/High/Medium/Low states are visible

[ ] Admin can see shortage zones on a map

[ ] AI Crisis Detection Agent works

[ ] AI Allocation Agent works

[ ] AI Logistics Agent works

[ ] Early-warning prediction works

[ ] AI recommendation contains reasoning

[ ] Admin can approve allocation

[ ] Tanker can be assigned

[ ] Route/ETA is displayed

[ ] Operator can update trip status

[ ] Delivery OTP/QR verification works

[ ] Delivery updates dashboard

[ ] Water delivered is tracked

[ ] Audit logs are stored

[ ] Demo seed data exists

[ ] Demo reset exists

[ ] AWS/Strands integration exists

[ ] README is complete

[ ] .env.example exists

[ ] No secrets are committed

[ ] Application runs locally

[ ] Core tests pass

---

# 79. WHAT TO DO FIRST

Start by inspecting the existing repository.

If the repository is empty:

initialize the project structure.

If code already exists:

do not rewrite working components unnecessarily.

First create:

1. monorepo structure
2. frontend
3. backend
4. MongoDB connection
5. shared types
6. environment configuration
7. seed data
8. basic citizen → report → dashboard flow

Then continue feature-by-feature.

After each major feature:

- run the application
- test the feature
- fix errors
- keep the project runnable

Do not wait until the end to discover integration failures.

---

# 80. FINAL ENGINEERING PRINCIPLE

Build a **working, explainable, visually strong hackathon MVP**.

Do not optimize for maximum code.

Optimize for:

real problem
+
clear user story
+
working execution
+
meaningful AI
+
meaningful AWS usage
+
transparent decisions
+
strong demo

The final application should make a judge think:

“This system can actually help an authority understand where a water crisis is happening, how severe it is, what action should happen first, and whether the response was completed.”

Build AquaShield around that idea.