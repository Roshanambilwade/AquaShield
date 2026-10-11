import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/config/env.js";
import { assertSimulationTarget } from "../src/config/simulation.js";
import { tickReports, simulationAccounts } from "../src/simulation/scenario.js";
import { simulationCommandSchema } from "../src/routes/simulation.js";
const base = {
  NODE_ENV: "development",
  SIMULATION_ENABLED: "true",
  DEMONSTRATION_MODE: "true",
  DEMO_AI_MODE: "true",
  FORECAST_DEMO_ENABLED: "true",
  SIMULATION_DATABASE_NAME: "aquashield_simulation",
  MONGODB_URI: "mongodb://127.0.0.1:27017/aquashield_simulation",
};
test("simulation defaults off; isolated URI and explicit offline flags are required", () => {
  assert.equal(parseEnv({}).SIMULATION_ENABLED, false);
  assert.equal(assertSimulationTarget(parseEnv(base)), "aquashield_simulation");
  for (const values of [
    { MONGODB_URI: "mongodb://127.0.0.1:27017/aquashield_demo" },
    { SIMULATION_DATABASE_NAME: undefined },
    { DEMONSTRATION_MODE: "false" },
    { FORECAST_DEMO_ENABLED: "false" },
    { DEMO_AI_MODE: "false" },
    { SIMULATION_PREPARE_ENABLED: "true", SIMULATION_ENABLED: "false" },
  ])
    assert.throws(
      () => parseEnv({ ...base, ...values }),
      /Invalid environment configuration/,
    );
});
test("simulation refuses production, protected names and alternate database overrides", () => {
  for (const name of [
    "aquashield_demo",
    "aquashield",
    "admin",
    "aquashield_production",
  ])
    assert.throws(() =>
      parseEnv({
        ...base,
        SIMULATION_DATABASE_NAME: name,
        MONGODB_URI: `mongodb://127.0.0.1:27017/${name}`,
      }),
    );
  assert.throws(() => parseEnv({ ...base, NODE_ENV: "production" }));
  assert.throws(
    () => assertSimulationTarget(parseEnv(base), false, "aquashield_demo"),
    (e) => e.code === "UNSAFE_SIMULATION_TARGET",
  );
});
test("simulation tests require freshly named dedicated UUID databases", () => {
  assert.throws(() => parseEnv({ ...base, NODE_ENV: "test" }));
  const name = "aquashield_simulation_test_0123456789abcdef0123456789abcdef";
  assert.equal(
    parseEnv({
      ...base,
      NODE_ENV: "test",
      SIMULATION_DATABASE_NAME: name,
      MONGODB_TEST_DB_NAME: name,
      MONGODB_URI: `mongodb://127.0.0.1:27017/${name}`,
    }).SIMULATION_ENABLED,
    true,
  );
});
test("command schemas reject invalid scenarios, speed, ticks and extra authority fields", () => {
  for (const input of [
    { action: "start", scenario: "unknown" },
    { action: "speed", speed: 4 },
    { action: "speed", speed: 0 },
    { action: "step", tick: 0 },
    { action: "step", tick: 25 },
    { action: "step", tick: 1, approve: true },
    { action: "reset" },
  ])
    assert.equal(simulationCommandSchema.safeParse(input).success, false);
  for (const input of [
    { action: "start" },
    { action: "pause" },
    { action: "resume" },
    { action: "stop" },
    { action: "step", tick: 1 },
    { action: "speed", speed: 3 },
  ])
    assert.equal(simulationCommandSchema.safeParse(input).success, true);
});
test("scenario is reproducible, bounded and contains only reported household inputs", () => {
  const users = Object.fromEntries(
    simulationAccounts
      .filter((a) => a.role === "CITIZEN")
      .map((a) => [a.key, { id: a.key, role: a.role }]),
  );
  const run = {
    runId: "synthetic-run",
    anchorAt: new Date("2026-10-10T00:00:00Z"),
  };
  const rows = Array.from({ length: 24 }, (_, i) =>
    tickReports(run, i + 1, users),
  ).flat();
  assert.equal(rows.length, 72);
  assert.equal(new Set(rows.map((r) => r.input.submissionId)).size, 72);
  assert.equal(new Set(rows.map((r) => r.input.areaId)).size, 6);
  assert.deepEqual(tickReports(run, 1, users), tickReports(run, 1, users));
  assert.ok(
    rows.some(
      (r) =>
        r.input.waterLevel === "UNKNOWN" &&
        r.input.reportedDurationHours === null,
    ),
  );
  assert.ok(
    rows.every(
      (r) =>
        !("severityScore" in r.input) &&
        !("verificationStatus" in r.input) &&
        !("estimatedAffectedPopulation" in r.input),
    ),
  );
});
