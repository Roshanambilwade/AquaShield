import { loadEnv } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { seedPersistentDemo } from "./persistentSeed.js";
import { assertSeedTarget } from "../config/demonstration.js";
import { demoCredentials } from "./credentials.js";

try {
  const config = loadEnv();
  assertSeedTarget(config);
  await connectDatabase(config);
  assertSeedTarget(config, true);
  const passwords = await demoCredentials(config.DEMO_DATABASE_NAME);
  console.info(JSON.stringify(await seedPersistentDemo(config, passwords)));
  console.info(
    "Demo instructions: docs/demo-guide.md. Credentials are in ignored .local/demo-credentials.json; no credentials were logged.",
  );
} catch {
  console.error(
    "Demo seed stopped safely. Check explicit demo flags, database target, credential file and connectivity. Existing records were not reset.",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
