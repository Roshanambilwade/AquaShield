# AWS hosting and MongoDB Atlas deployment

Status: hosting configuration prepared locally; no AWS resources created and no Atlas connection verified. Keep the existing local `.env` and simulation credentials unchanged. This guide deploys the ordinary application, not the isolated dynamic simulator. Production rejects simulation, forecast-demo and demonstration flags; restarting multiple simulation runs in one database remains unimplemented.

## Runtime, install and environment contract

React/Vite JavaScript static assets run in Amplify; Express JavaScript, Mongoose and the existing Gemini/Strands SDK run in the API container; Atlas is external persistent storage. Use Node >=22.13 (the container uses Node 22), npm workspaces `@aquashield/web` and `@aquashield/api`, the committed root lockfile and the root build context. API code does not require a compilation step. No Redis, Bedrock or additional agent service is introduced.

From a clean repository checkout, run `npm ci --include=dev --no-audit --no-fund`, then `npm run lint`, `npm test`, `npm run build` and `npm run security:check`. Amplify explicitly includes build-time development dependencies even if its shell has `NODE_ENV=production`; only static artifacts are published. Use `node scripts/verifyCleanBuild.js` to verify an isolated fresh install/build without copying private files. Several installed packages use install scripts (Google GenAI, esbuild, protobufjs and optional platform-specific fsevents); review locked packages rather than disabling scripts needed for the build. Integration/browser tests need local MongoDB and the configured Playwright Edge browser.

| Variable | Location and meaning |
| --- | --- |
| `NODE_ENV` | Backend runtime: `production`; local development stays `development`. |
| `PORT` | Backend runtime: 5000 matching App Runner image Port; server binds all interfaces. App Runner reserves this name, so set the service image Port to 5000 rather than adding a custom environment entry. |
| `MONGODB_URI` | Backend runtime secret: authenticated TLS Atlas URI with explicit live database. Local development defaults to local MongoDB; production refuses that fallback and loopback hosts. |
| `CORS_ORIGIN` | Backend runtime: exact comma-separated HTTPS frontend origins, without paths/trailing slash. Local defaults permit localhost and 127.0.0.1:5173. |
| `GEMINI_API_KEY`, `GEMINI_MODEL_ID`, `AI_PROVIDER` | Backend only. Provider remains `gemini`; key and existing selected model are optional for numerical operation and required for live advice. Never place in Amplify. |
| `DEMO_AI_MODE`, `DEMONSTRATION_MODE`, `DEMO_SEED_ENABLED`, `FORECAST_DEMO_ENABLED` | Backend: explicitly `false` in production; true is rejected. No seeds at startup. |
| `DEMO_DATABASE_NAME` | Non-production demonstration selector only, default `aquashield_demo`. It overrides the URI database only when demonstration is enabled; that mode is forbidden in production. |
| `SIMULATION_ENABLED`, `SIMULATION_PREPARE_ENABLED` | Backend: explicitly `false` in production. Production simulation is unsupported and must not be enabled by bypassing guards. |
| `SIMULATION_DATABASE_NAME` | Non-production simulation selector only; must exactly match the URI database and guarded run provenance. Not a production database override. |
| `MONGODB_TEST_DB_NAME`, `MONGODB_TEST_URI` | Test tooling only; do not inject in deployment. Runtime forbids production test-name overrides. |
| `VITE_API_BASE_URL` | Amplify public build setting: exact `https://API_HOST/api`. `/api` remains supported only for local Vite or the existing same-origin nginx proxy. |
| `API_PROXY_TARGET` | Local Vite dev/preview only; cannot configure an Amplify proxy. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Explicit one-time backend administrator provisioning only; no production defaults. |
| Other validated limits/thresholds | Backend defaults in `.env.example`: session duration, bounded database/AI/shutdown timeouts, detection/privacy, operational freshness, routing/OTP and prediction settings. Retain defaults unless intentionally reviewed. |

Injected process environment wins over root dotenv, which loads without override. Production's parsed URI database is authoritative: demo/simulation selectors cannot replace it because their activating flags are rejected. The test helper overrides developer values for offline tests and generates owned UUID targets. Do not run tests in an environment carrying production Atlas configuration.

## Frontend: Amplify Hosting

Connect the repository and release branch, choose the monorepo root `apps/web`, and set `AMPLIFY_MONOREPO_APP_ROOT=apps/web`. Use the root `amplify.yml`, a Node 22 build image/runtime, and set the public build variable `VITE_API_BASE_URL=https://YOUR_BACKEND_HOST/api`. The file builds from the workspace root and publishes `apps/web/dist`. It refuses a missing/non-HTTPS API URL. Do not put MongoDB, Gemini, provisioning passwords or any other secrets in Amplify environment variables. Vite values are public and baked into the bundle; rebuild when the backend URL changes.

Paste `deploy/amplify-rewrites.json` into Amplify's redirects/rewrites JSON editor for client-side routing. This is a manual console setting, not automatically applied by the build file. Missing static files must remain errors. There is no production Vite proxy; API calls go directly to the HTTPS backend. Test direct navigation/reload on `/login`, `/admin`, `/my-reports` and `/operator`.

[AWS monorepo build documentation](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html) and [SPA rewrites](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html).

## Backend: existing container

Build with repository-root context: `docker build -f apps/api/Dockerfile -t aquashield-api:release .`. Use an approved pinned Node image digest through the `NODE_IMAGE` build argument for release, scan the Linux image, then publish to a private container registry. The existing container uses non-root Node, installs locked API production dependencies, excludes local secrets and starts the Express server on `0.0.0.0:5000`. No frontend build or seed command belongs in the backend startup.

Check AWS account eligibility first: App Runner is unavailable to new customers; eligible existing customers may continue creating services. For an ineligible account, evaluate ECS Express Mode, the AWS-recommended alternative, before provisioning. This repository does not yet contain an ECS infrastructure stack. [AWS availability and migration guidance](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html).

For eligible App Runner image hosting, configure port 5000, HTTP health path `/api/health/ready`, and runtime settings from `deploy/backend.env.example`, replacing all placeholders. Store MongoDB/Gemini secrets in AWS Secrets Manager or the supported runtime secret mechanism with least-privilege access. Set `CORS_ORIGIN` to the exact Amplify HTTPS origin, comma-separating only deliberate additional origins. No wildcard or localhost in production. Health must become 200 without Gemini; readiness requires MongoDB.

App Runner image configuration uses `RuntimeEnvironmentVariables` for ordinary settings and `RuntimeEnvironmentSecrets` for secret ARN references (console: environment-variable source Secrets Manager/SSM). Map the Mongo secret to `MONGODB_URI` and optional Google secret to `GEMINI_API_KEY`, not a committed literal. Give the service instance role only the necessary secret/parameter access and KMS decrypt access where applicable; the ECR image access role is separate. Select/review region-compatible secret ARNs with the owner. Omit a custom `PORT` environment entry because App Runner reserves it; configure image Port 5000 instead. Secret updates require service redeployment to load new values. No AWS access keys are application prerequisites. [AWS secret references and reserved PORT](https://docs.aws.amazon.com/apprunner/latest/dg/env-variable.html).

Use one backend instance for the initial release: several existing abuse-control/provider bounds are process-local. Do not claim a global multi-instance limiter; add a reviewed shared/edge control before scaling. Configure enough CPU/memory for native Sharp and the current SDK, bounded platform request timeouts compatible with configured AI deadlines, and termination grace longer than `SHUTDOWN_TIMEOUT_MS`. App Runner/network/region eligibility, image execution and actual cloud limits still require release testing.

## MongoDB Atlas (connection string needed at deployment)

Create a dedicated non-demo `aquashield` database and a dedicated database user with read/write access limited to that database. Use an authenticated `mongodb+srv` URI with that explicit database path; percent-encode password special characters. Atlas SRV enables TLS by default; do not add TLS bypass options. The application already accepts this URI through `MONGODB_URI`; no source-code replacement is required.

Supply the URI privately in the backend environment/secret store, not in chat, Git, frontend settings or a build argument. When ready, you can save it in an ignored private file or configure the runtime secret and provide its location/name. No Atlas credential is needed for current offline tests. Local data is not automatically copied to Atlas; new production storage starts without demo accounts/reports. Back up any desired data and review an explicit migration separately rather than uploading simulation records.

In the Atlas console, create/select the project, choose the deployment cluster/region, create the restricted application database user in Database Access, and select Connect → Drivers for the SRV template. Specify `aquashield` in its path rather than the default/admin database. Selecting a URI name does not seed or import records; collections are created only by explicitly authorized application actions. Ensure the user can create the application's required indexes within that database, and enable suitable backups before storing operational data.

Allow the backend's actual egress addresses in Atlas's network access list (or configure supported private networking). Default App Runner public egress does not give this repository a guaranteed static outbound IP. For a stable Atlas allowlist, use an App Runner outbound VPC connector in private subnets routed through a NAT Gateway with an Elastic IP; add that IP to Atlas. With several NAT gateways allow each actual egress IP. The connector alone does not provide public internet access: NAT routing is needed for public Atlas and Gemini. A private Atlas endpoint/peering alternative requires separately verified tier/region/network support. Do not use `0.0.0.0/0` as the normal deployment solution. Do not treat frontend client addresses as database clients. Verify DNS/SRV resolution, TLS and database permissions from the deployed runtime. [Atlas IP access-list documentation](https://www.mongodb.com/docs/atlas/security/ip-access-list/) and [App Runner VPC egress requirements](https://docs.aws.amazon.com/apprunner/latest/dg/network-vpc.html).

For a controlled **local read-only** Atlas connectivity test, allow only the developer's current public IP and use a dedicated deployment/staging target. In a fresh shell, privately inject `MONGODB_URI` without command-history exposure, set `NODE_ENV=production`, `CORS_ORIGIN` to the planned HTTPS frontend, all demo/simulation flags to `false`, `AI_PROVIDER=gemini`, and remove `MONGODB_TEST_DB_NAME`. Run `npm run config:check -- --production` first. Then run a driver-only ping from that environment:

```powershell
node --input-type=module -e "import mongoose from 'mongoose'; import {loadEnv} from './apps/api/src/config/env.js'; let c; try {const v=loadEnv(); if(v.NODE_ENV!=='production') throw new Error(); c=new mongoose.mongo.MongoClient(v.MONGODB_URI,{serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,socketTimeoutMS:5000}); await c.connect(); await c.db().command({ping:1},{maxTimeMS:2000}); console.log('ATLAS_PING_OK');} catch {console.error('ATLAS_PING_FAILED');process.exitCode=1;} finally {await c?.close();}"
```

This sends only a bounded MongoDB ping: no application startup, schema/index creation, seed, user creation or persistence mutation. It does not prove write permission or deployed AWS networking. Close the shell afterward so Atlas overrides do not affect local work. Actual persistence/authentication tests are separate owner-authorized post-deployment smoke actions.

Provision the first administrator once using `node apps/api/src/scripts/createAdmin.js` from an approved environment with the same production configuration and privately injected `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12–256 characters). Remove provisioning variables afterward. Existing local simulation/demo credentials do not sign into a new Atlas database. Never seed demo data at production startup. Review indexes and backups as described in [the existing readiness report](phase9-deployment-readiness.md).

Before adding data, the owner must choose **A: start clean**, with an explicitly approved guarded deployment dataset, or **B: import selected reviewed data in a separate migration**. Nothing in this task performs either setup. Option B requires source/target review, a distinct target, source backup, dry-run count/integrity comparison, rollback to the prior target/image and explicit import authorization. Never upload faculty credentials or private simulation state merely to fill the dashboard.

## Authentication and edge security

Authentication uses random opaque bearer tokens with SHA-256 hashes and expiries in MongoDB, scrypt passwords, current role/owner authorization, and browser sessionStorage. It uses neither JWT nor cookies; do not add cookie flags or credentialed CORS assumptions. Cross-origin clients send Authorization, and the existing CORS middleware handles preflight before routing. HTTPS transport is required; CORS is not authorization. Preserve role, ownership, OTP replay/expiry and conditional delivery accounting checks. API errors/health never include raw database/provider secrets. Review edge HSTS/CSP, map tile permissions, XSS protection and trusted-proxy/IP limiter behavior before public access. Do not blindly enable `trust proxy=true`; the actual proxy chain and spoof prevention remain an external release check.

## Rollback, troubleshooting and remaining external work

Retain the prior API image digest and Amplify release; rollback application releases to those versions if smoke checks fail. Do not drop/restore/overwrite Atlas as an automatic application rollback. Review schema/index compatibility and use Atlas backup restoration to a separate reviewed target only with owner authorization. Redeploy the frontend if its public API URL changes.

Configuration rejection names fields only: check explicit live database/TLS/auth, HTTPS CORS and disabled demo/test flags. A 503 readiness result means database access is unavailable: check Atlas user permissions, allowed egress IP, NAT routes, DNS/SRV, TLS and selected region; keep URI/passwords private. A CORS 403 means the exact frontend origin is absent from `CORS_ORIGIN`. SPA refresh 404 means rewrites are missing. Fetch failures may indicate a stale build-time API URL or HTTPS mismatch. Login failure on clean Atlas may mean administrator provisioning has not happened; local demo credentials are not copied.

Unresolved: Atlas project/cluster/user/secret, restricted networking and backup policy; AWS account/App Runner eligibility, region, ECR image and secret-access roles, HTTPS URLs and edge policies; pinned/scanned release image and actual hosting runtime; owner data choice and administrator provisioning; public smoke/persistence checks. No cloud or Atlas success is claimed from local checks. See [the execution report](deployment-readiness-report.md) for checks actually run during preparation.

## Release checks

1. Run `npm run verify` locally with local MongoDB; these tests use owned UUID databases, not production Atlas. Run `npm run test:containers` where Docker is available. Pin/scan release images. Never point mutating test fixtures at live Atlas.
2. In the intended private runtime environment run `npm run config:check -- --production` (parsing only; never prints the connection string). Remove test overrides and disable every demo/simulation flag.
3. After hosting, verify HTTPS `/api/health/live` and `/api/health/ready`, exact-origin preflight, rejected unauthorized admin access and login/logout. Check the browser's API host and SPA refresh.
4. With a dedicated acceptance account, submit one explicitly identified test report, confirm its stored document in Atlas, restart the backend, and confirm authorized history still retrieves it. Review cleanup explicitly; no automatic production database deletion.
5. Exercise manually approved allocation and owned OTP delivery with controlled evidence, distinguish estimated/unknown values, check uploads, audit visibility, rate limits and numerical predictions without Gemini. Live Gemini calls remain separately authorized.
6. Record tested public URLs, image digest, configuration field names, connectivity/persistence evidence and limitations before declaring deployment complete. Current local checks alone are not cloud acceptance.

The existing container-smoke helper expects its historical image tags, so where a Linux Docker engine is available build those exact tags before invoking it:

```powershell
docker build -f apps/api/Dockerfile -t aquashield-api:phase11 .
docker build -f apps/web/Dockerfile -t aquashield-web:phase11 .
npm run test:containers
```

This is an isolated local smoke check, not the production App Runner configuration. It requires host MongoDB on port 27017 reachable as `host.docker.internal` and removes only generated UUID fixtures. Do not substitute Atlas/production data into the helper.
