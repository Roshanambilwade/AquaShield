import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { assertSimulationTarget } from "../config/simulation.js";
import { prepareSimulation } from "../services/simulationService.js";
import { simulationAccounts } from "../simulation/scenario.js";
try {
  const config = loadEnv();
  assertSimulationTarget(config);
  if (!config.SIMULATION_PREPARE_ENABLED)
    throw new Error("Preparation disabled");
  await connectDatabase(config);
  const directory = fileURLToPath(
    new URL("../../../../.local/", import.meta.url),
  );
  const path = `${directory}simulation-credentials-${config.SIMULATION_DATABASE_NAME}.json`;
  await mkdir(directory, { recursive: true });
  let credentials;
  try {
    credentials = JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    credentials = {
      databaseName: config.SIMULATION_DATABASE_NAME,
      accounts: simulationAccounts.map((a) => ({
        ...a,
        password: randomBytes(24).toString("base64url"),
      })),
    };
    await writeFile(path, JSON.stringify(credentials, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
  }
  if (credentials.databaseName !== config.SIMULATION_DATABASE_NAME)
    throw new Error("Credential target mismatch");
  const passwords = Object.fromEntries(
    credentials.accounts.map((a) => [a.key, a.password]),
  );
  const result = await prepareSimulation(config, passwords);
  console.info(
    JSON.stringify({
      prepared: result.prepared,
      accounts: result.accounts,
      scenario: result.scenario,
    }),
  );
  console.info(
    "Simulation prepared. Credentials are in the dedicated ignored .local simulation credential file. See docs/dynamic-simulation.md.",
  );
} catch {
  console.error(
    "SIMULATION_PREPARATION_FAILED: verify isolated target, flags, preserved credential file and database connectivity. No reset was performed.",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
