import { loadEnv } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { seedDemoReports } from "./seedReports.js";

try {
  const config = loadEnv();
  if (config.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  await connectDatabase(config);
  await seedDemoReports();
  console.info(
    "12 simulated reports are available at /my-reports?demo=true. Existing citizen reports were preserved.",
  );
} catch {
  console.error(
    "Could not seed demo reports. Check MongoDB and run outside production mode.",
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
