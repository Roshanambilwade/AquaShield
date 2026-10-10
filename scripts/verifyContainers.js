// Optional local smoke test. Images must already have been built. No root .env,
// cloud credentials, live providers, normal database or demo records are used.
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import mongoose from "mongoose";

const suffix = randomUUID().replaceAll("-", "");
const network = `aquashield-check-${suffix}`;
const apiName = `${network}-api`,
  webName = `${network}-web`;
const dbName = `aquashield_container_test_${suffix}`;
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let stage = "create isolated network",
  apiStarted = false,
  webStarted = false,
  networkCreated = false,
  connection;
try {
  docker("network", "create", network);
  networkCreated = true;
  stage = "start API container";
  docker(
    "run",
    "-d",
    "--name",
    apiName,
    "--network",
    network,
    "--network-alias",
    "api",
    "-e",
    "NODE_ENV=development",
    "-e",
    `MONGODB_URI=mongodb://host.docker.internal:27017/${dbName}`,
    "-e",
    "CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080",
    "-e",
    "DEMO_AI_MODE=false",
    "-e",
    "DEMONSTRATION_MODE=false",
    "-e",
    "DEMO_SEED_ENABLED=false",
    "aquashield-api:phase11",
  );
  apiStarted = true;
  stage = "start frontend container";
  docker(
    "run",
    "-d",
    "--name",
    webName,
    "--network",
    network,
    "-p",
    "127.0.0.1::8080",
    "aquashield-web:phase11",
  );
  webStarted = true;
  const mapping = docker("port", webName, "8080/tcp");
  assert.match(mapping, /^127\.0\.0\.1:\d+$/);
  const origin = `http://${mapping}`;
  const ready = async () => {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      try {
        if (
          (
            await fetch(`${origin}/api/health/ready`, {
              signal: AbortSignal.timeout(2000),
            })
          ).ok
        )
          return;
      } catch {
        /* bounded startup polling */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Container readiness deadline exceeded.");
  };
  stage = "readiness with host MongoDB (loopback port 27017)";
  await ready();
  stage = "non-root images and SPA/static routes";
  assert.notEqual(
    docker("exec", apiName, "node", "-e", "console.log(process.getuid())"),
    "0",
  );
  assert.notEqual(docker("exec", webName, "id", "-u"), "0");
  assert.equal(
    docker(
      "exec",
      apiName,
      "node",
      "-e",
      "console.log(require('node:fs').existsSync('/app/.env'))",
    ),
    "false",
  );
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  assert.match(
    await (await fetch(`${origin}/admin/audit`)).text(),
    /<div id="root">/,
  );
  assert.equal((await fetch(`${origin}/assets/nonexistent.js`)).status, 404);
  const call = async (method, path, body, token) => {
    const result = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    return { status: result.status, body: await result.json() };
  };
  stage = "container citizen auth, ownership and idempotent persistence";
  const password = randomBytes(24).toString("hex"),
    email = "container@fixture.test";
  assert.equal((await call("GET", "/dashboard/analytics")).status, 401);
  assert.equal(
    (
      await call("POST", "/auth/register", {
        name: "Synthetic container citizen",
        email,
        password,
      })
    ).status,
    201,
  );
  const login = await call("POST", "/auth/login", { email, password });
  assert.equal(login.status, 200);
  const token = login.body.data.token;
  const input = {
    submissionId: randomUUID(),
    areaId: "AREA_01",
    locality: "Panchavati",
    location: { lat: 20.011, lng: 73.79 },
    locationSource: "MANUAL",
    problem: "NO_WATER",
    waterLevel: "EMPTY",
    householdSize: 4,
    reportedDurationHours: 12,
    lastSupplyTime: null,
  };
  const created = await call("POST", "/reports", input, token);
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal((await call("POST", "/reports", input, token)).body.data.id, id);
  stage = "graceful container stop and restart persistence";
  docker("stop", "--time", "15", apiName);
  assert.equal(
    docker("inspect", "--format", "{{.State.ExitCode}}", apiName),
    "0",
  );
  assert.match(docker("logs", apiName), /API_STOPPED/);
  docker("start", apiName);
  await ready();
  const persisted = await call("GET", `/reports/${id}`, undefined, token);
  assert.equal(persisted.status, 200);
  assert.equal(persisted.body.data.id, id);
  assert.equal(persisted.body.data.householdSize, 4);
  assert.equal(
    (await call("GET", "/dashboard/analytics", undefined, token)).status,
    403,
  );
  stage = "direct persisted document verification";
  connection = await mongoose
    .createConnection(`mongodb://127.0.0.1:27017/${dbName}`, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    })
    .asPromise();
  assert.equal(await connection.collection("reports").countDocuments(), 1);
  console.info(
    "CONTAINER_SMOKE_PASS: non-root images, health, SPA refresh, authorization, report retry, Mongo persistence and graceful restart; no Gemini.",
  );
} catch {
  console.error(
    `CONTAINER_SMOKE_FAILED: ${stage}. No provider or configuration secrets are logged.`,
  );
  process.exitCode = 1;
} finally {
  // Remove only the names generated in this invocation, even after partial setup.
  for (const [started, name] of [
    [webStarted, webName],
    [apiStarted, apiName],
  ]) {
    if (started)
      try {
        docker("rm", "-f", name);
      } catch {
        console.error("CONTAINER_CLEANUP_FAILED");
        process.exitCode = 1;
      }
  }
  if (networkCreated)
    try {
      docker("network", "rm", network);
    } catch {
      console.error("NETWORK_CLEANUP_FAILED");
      process.exitCode = 1;
    }
  try {
    if (!connection)
      connection = await mongoose
        .createConnection(`mongodb://127.0.0.1:27017/${dbName}`, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 5000,
        })
        .asPromise();
    assert.equal(connection.name, dbName, "Unsafe cleanup target");
    assert.match(dbName, /^aquashield_container_test_[a-f0-9]{32}$/);
    await connection.dropDatabase({ maxTimeMS: 5000 });
  } catch {
    console.error("DISPOSABLE_DATABASE_CLEANUP_FAILED");
    process.exitCode = 1;
  } finally {
    if (connection) await connection.close();
  }
}
