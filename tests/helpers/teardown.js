import mongoose from "mongoose";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../apps/api/src/config/database.js";
import { assertTestDatabase } from "./safety.js";
export default async function teardown() {
  const config = loadEnv();
  if (!config.MONGODB_TEST_DB_NAME)
    throw new Error("Missing isolated browser database.");
  try {
    await connectDatabase(config);
    assertTestDatabase();
    if (mongoose.connection.name !== config.MONGODB_TEST_DB_NAME)
      throw new Error("Test database mismatch.");
    await mongoose.connection.dropDatabase();
  } finally {
    await disconnectDatabase();
  }
}
