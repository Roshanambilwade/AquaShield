# AquaShield demo — implemented capabilities and future checkpoints

This guide reflects the revised scope as of 9 October 2026. Phases 1–6 and Phase 6.5 citizen accounts work locally. Phase 6 adds persisted fair allocation, explicit approval/assignment and operator visibility; follow the [complete Phase 6 walkthrough](phase6.md#run-and-demonstrate). Four Strands/Gemini roles and key-free demo output remain available. A complete live Gemini assessment remains unverified after provider failures. Trip controls, delivery verification, numeric prediction and AWS deployment remain future work. No Bedrock or AWS resources were added.

## Demonstrate the current Phase 1–4 application

1. Start MongoDB, configure the existing root `.env`, and run `npm run dev`. Provision an administrator using `npm run admin:create` if one does not already exist. Keep credentials, sessions and citizen contact details off camera.
2. Register a CITIZEN at `/register`, sign in at `/citizen/login`, then submit a household report through `/report`. Show the actual API/database-backed confirmation, account-owned history and status after refresh and renewed login. Explain that household size is citizen-provided; neighborhood impact is estimated later by the backend. Email ownership, identity and residency are unverified. Do not present fictional test submissions as real community evidence. Officers can review sources privately at `/admin/reports`; legacy/demo records have no invented reporter. See [Phase 6.5](phase65.md).
3. Run the existing `npm run seed:demo` for the clearly labeled simulation, sign in and open `/admin?demo=true`. Seed mode requires no AI credentials or `DEMO_AI_MODE`. Production rejects demo seeding/APIs; preserve that protection.
4. Show Panchavati, Satpur, Indira Nagar, Nashik Road and Adgaon on the map/table. Explain severity and confidence using the existing calculation breakdowns. Map report locations are administrator-only, and offline coordinate mode is available when street tiles fail.
5. Show simulated verification, approximate population, excluded duplicates/suspicious reports, recent report activity and aggregate analytics. Identify missing environmental/operational data as unknown. Current emerging evidence is not a predictive forecast.
6. In Phase 5, select each agent and generate a recommendation. With DEMO_AI_MODE=true, identify the response as simulation without a Gemini call. Explain the authoritative numeric evidence, source references, missing inputs and human-review status. No action is approved or dispatched. Fleet/delivery/forecast values remain unknown when records are absent.

## Computed seed snapshot, not scripted output

These values were derived from the unchanged seed inputs and existing business logic with the current default configuration and fixed demo observation clock. Recalculate if configuration/evidence changes; do not edit scores in MongoDB to match a video script.

| Area         | Total / eligible reports | Simulated verified reports | Shortage confidence | Severity / level | Approx. affected people | Evidence status |
| ------------ | ------------------------ | -------------------------- | ------------------- | ---------------- | ----------------------- | --------------- |
| Panchavati   | 40 / 37                  | 31                         | 97.6%               | 89.5 / CRITICAL  | ~588                    | ACTIVE          |
| Satpur       | 12 / 12                  | 8                          | 98.3%               | 65.1 / HIGH      | ~240                    | ACTIVE          |
| Indira Nagar | 8 / 8                    | 3                          | 84.3%               | 39 / MEDIUM      | ~124                    | ACTIVE          |
| Nashik Road  | 4 / 4                    | 0                          | 76.8%               | 14.2 / LOW       | ~44                     | ACTIVE          |
| Adgaon       | 2 / 2                    | 0                          | 73.6%               | 42.9 / MEDIUM    | ~44                     | EMERGING        |

The five areas contain 66 fictional report submissions, including two duplicates and one suspicious/conflicting submission. Simulated field checks, weather and infrastructure are not verified live facts. Confidence expresses evidence that a genuine shortage exists, not water remaining. Approximate population uses household evidence and an explicit coverage assumption; it is not a census or exact affected-person count.

## Agent demonstration and later checkpoints

- Phase 5 (implemented, live Gemini unverified): show four Strands/Gemini roles (Crisis Detection, Resource Allocation, Logistics, Early Warning), backend deterministic recommendations/fairness/ranking and separately validated agent explanations. Logistics/risk inputs remain unavailable until their later phase. Show actual successful Gemini execution with provider/model provenance; demonstrate DEMO_AI_MODE separately as key-free simulation with no provider call. This phase cannot assign tankers or dispatch water.
- Phase 6 (implemented): reset clearly fictional fleet/context through the admin UI, provision/link an operator, inspect backend fairness/candidates, reject and request another recommendation, explicitly approve and assign, then sign in as the operator. Show limited resources, missing information and stale conflicts. No route/ETA, delivery or people-served claim is available.
- Phase 6.5 (implemented): demonstrate registration, shared login/logout, protected submission, account-owned history across sessions, another account's denied access and ADMIN-only report source review. Contact/identity/residency remain unverified; old anonymous/demo records are retained without assigning them to real users.
- Phase 7 (not started): routing, trip controls and delivery verification belong to the next authorized scope. Deterministic prediction and Early Warning integration remain later work; never substitute an EMERGING cluster for a forecast.
- Phase 8–9: complete hardening/public deployment tests, then film the actual AWS-hosted application and publish accurate setup/screenshots/results. Prefer Amplify Hosting and eligible compatible App Runner, allowing MongoDB Atlas. Follow the account-eligibility and technical checks in specification sections 47–48; the target account/configuration is not yet verified.

There is no `reset:demo` CLI command or complete allocation-to-delivery demo. The authenticated Phase 6 **Reset demo operations** UI resets only owned fictional operations and preserves live records. The original `seed:demo` remains report-only. Agent execution must be labeled accurately and cannot replace backend calculations or approvals. Optional allocation explanations may fail into an explicitly deterministic recommendation; this does not claim Gemini or switch to simulated AI.

## Agent-mode demonstration

Use Strands with an explicitly configured Google/Gemini provider. Store GEMINI_API_KEY only in the backend/agent process environment; examples stay blank and credentials never appear on camera, in logs, bundles, API responses or source control. Choose a verified supported GEMINI_MODEL_ID before real execution. Main React/Express and agent modules remain JavaScript; the verified SDK did not require a TypeScript service.

- Real mode: DEMO_AI_MODE=false; demonstrate successful actual Gemini calls through Strands using minimal synthetic evidence, recorded role/provider/model/framework and validated explanations. Backend computes all severity/confidence/population/fairness/distance/ETA/risk numbers. A missing key or failed call is an explicit error/unavailable state, not simulated success.
- Demo mode: DEMO_AI_MODE=true; test without a key or network model calls using the same validated contract and backend-calculated facts. Display "Demo AI simulation — no Gemini execution," isDemo=true and providerExecuted=false. A simulation does not prove real Strands/Gemini execution.
- Preserve Phase 1–4 reporting/detection/dashboard availability during provider failures. Do not silently default to Bedrock or switch real failures into demo results. Keep production demo protections intact.

## Required AWS evidence for the final video

Show real public frontend and backend URLs, service names/region, direct SPA navigation, connected API health, administrator login/authorization/logout, citizen submission, report persistence after reload/reconnect, derived shortages and dashboard retrieval. Record tested commit/configuration and results in future `docs/aws.md`. Keep secrets off camera and preserve production CORS/auth/demo controls.

Resolve any isolated simulation environment explicitly during the authorized deployment phase. A local seeded walkthrough must be visibly distinguished from the public deployment proof. Do not enable production demo data silently or claim deployment from a console mock, environment variable, logo or plan. The final AWS requirement is actual tested application hosting, not Bedrock/Strands use.

## Pre-Phase-7 remediation update

See [the remediation report](remediation.md) for current public aggregation, bounded detection refresh, authoritative allocation advice, recovery policy, fleet eligibility, citizen response history, test isolation and agent verification. Earlier test counts in this document are historical phase snapshots. No live Gemini inference was run during remediation; demo and mocked-provider tests are not proof of live execution. Phase 7 and deployment remain outside this task.
