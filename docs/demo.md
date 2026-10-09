# AquaShield demo — implemented capabilities and future checkpoints

This guide reflects the revised specification strategy as of 9 October 2026. Phases 1–4 work locally; the next phase is explainable deterministic decision support. No LLM agents, tanker allocation/delivery workflow, prediction engine or verified AWS deployment have been added. AWS hosting is a later required deliverable; Strands Agents SDK and Amazon Bedrock remain optional future enhancements.

## Demonstrate the current Phase 1–4 application

1. Start MongoDB, configure the existing root `.env`, and run `npm run dev`. Provision an administrator using `npm run admin:create` if one does not already exist. Keep credentials and anonymous report keys off camera.
2. Submit a household report through `/report`. Show the actual API/database-backed confirmation, owner-only history and status after refresh. Explain that household size is citizen-provided; neighborhood impact is estimated later by the backend. Do not present fictional test submissions as real community evidence.
3. Run the existing `npm run seed:demo` for the clearly labeled simulation, sign in and open `/admin?demo=true`. Seed mode requires no AI credentials or `DEMO_AI_MODE`. Production rejects demo seeding/APIs; preserve that protection.
4. Show Panchavati, Satpur, Indira Nagar, Nashik Road and Adgaon on the map/table. Explain severity and confidence using the existing calculation breakdowns. Map report locations are administrator-only, and offline coordinate mode is available when street tiles fail.
5. Show simulated verification, approximate population, excluded duplicates/suspicious reports, recent report activity and aggregate analytics. Identify missing environmental/operational data as unknown. Current emerging evidence is not a predictive forecast.
6. Describe the AI-labeled panel as an inactive extension point in the unchanged Phase 4 UI. Assessment guidance is deterministic; no real agent or model executes. Available tankers, delivered water, response time and forecast values remain unknown when feeds/records are absent.

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

## Later phases — do not demonstrate as completed yet

- Phase 5: show structured deterministic recommendations with source evidence, stable priority rules, fairness assumptions, unknown inputs and explanations. No provider call is required; this phase cannot assign a tanker or dispatch water.
- Phase 6: once implemented/tested, show valid fleet data, feasibility checks, human approval/audit, assignment, operator trip status, estimated route/ETA, OTP/QR verification and recorded litres. Do not invent T04, fleet availability, exact travel time or people served.
- Phase 7: show the retained deterministic early-warning model evaluated against available trend/supply/environment/incident/history inputs, including unknowns, reasons and approximate horizon. Do not script an 87/100 prediction or substitute an EMERGING cluster for it.
- Phase 8–9: complete hardening/public deployment tests, then film the actual AWS-hosted application and publish accurate setup/screenshots/results. Prefer Amplify Hosting and eligible compatible App Runner, allowing MongoDB Atlas. Follow the account-eligibility and technical checks in specification sections 47–48; the target account/configuration is not yet verified.

There is currently no implemented `reset:demo` command or complete allocation-to-delivery demo. Extend/reset only labeled fictional records when the later phase is authorized, preserving private live data. Optional future LLM integrations must disclose actual execution and cannot replace deterministic numeric facts or approvals.

## Required AWS evidence for the final video

Show real public frontend and backend URLs, service names/region, direct SPA navigation, connected API health, administrator login/authorization/logout, citizen submission, report persistence after reload/reconnect, derived shortages and dashboard retrieval. Record tested commit/configuration and results in future `docs/aws.md`. Keep secrets off camera and preserve production CORS/auth/demo controls.

Resolve any isolated simulation environment explicitly during the authorized deployment phase. A local seeded walkthrough must be visibly distinguished from the public deployment proof. Do not enable production demo data silently or claim deployment from a console mock, environment variable, logo or plan. The final AWS requirement is actual tested application hosting, not Bedrock/Strands use.
