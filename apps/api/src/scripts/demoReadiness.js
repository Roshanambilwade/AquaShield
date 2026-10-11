import { loadEnv } from "../config/env.js";
import { assertSeedTarget } from "../config/demonstration.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { demoReadiness } from "../services/demoReadinessService.js";
try {
  const config = loadEnv();
  assertSeedTarget({ ...config, DEMO_SEED_ENABLED: true });
  await connectDatabase(config);
  console.info(JSON.stringify(await demoReadiness(config), null, 2));
} catch {
  console.error(
    "Read-only readiness check unavailable. Check explicit demonstration target/configuration and connectivity.",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
