import { loadEnv } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { assertSeedTarget } from "../config/demonstration.js";
import {
  assertForecastSource,
  prepareForecastFixture,
} from "../demo/forecastFixture.js";
try {
  const config = loadEnv();
  assertSeedTarget(config);
  assertForecastSource(config, false);
  await connectDatabase(config);
  console.info(JSON.stringify(await prepareForecastFixture(config)));
} catch {
  console.error(
    "Forecast preparation stopped safely. Check explicit demo/fixture/seed flags, guarded database and connectivity. Existing records were not overwritten.",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
