import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "../middleware/errors.js";

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
export const simulationSchema = z.object({
  SIMULATION_ENABLED: flag,
  SIMULATION_PREPARE_ENABLED: flag,
  SIMULATION_DATABASE_NAME: z
    .string()
    .regex(/^aquashield_simulation(?:_[a-z0-9]+)*$/)
    .optional(),
  SIMULATION_TICK_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(5000)
    .max(60000)
    .default(15000),
});
export function assertSimulationTarget(config, connected = false, override) {
  const fail = () => {
    throw new ApiError(
      403,
      "UNSAFE_SIMULATION_TARGET",
      "Simulation requires an explicit isolated nonproduction database and matching configuration.",
    );
  };
  if (
    !config.SIMULATION_ENABLED ||
    config.NODE_ENV === "production" ||
    !config.DEMONSTRATION_MODE
  )
    fail();
  const name = config.SIMULATION_DATABASE_NAME;
  if (
    !/^aquashield_simulation(?:_[a-z0-9]+)*$/.test(name || "") ||
    name === config.DEMO_DATABASE_NAME
  )
    fail();
  let uriName;
  try {
    uriName = new mongoose.mongo.MongoClient(config.MONGODB_URI).options.dbName;
  } catch {
    fail();
  }
  // URI and selected database must both name the isolated target: no override of
  // a faculty/production URI is accepted, even when using the same Mongo server.
  if (
    uriName !== name ||
    (override && override !== name) ||
    (config.MONGODB_TEST_DB_NAME && config.MONGODB_TEST_DB_NAME !== name)
  )
    fail();
  if (
    config.NODE_ENV === "test" &&
    !/^aquashield_simulation_test_[a-f0-9]{32}$/.test(name)
  )
    fail();
  if (
    connected &&
    (mongoose.connection.readyState !== 1 || mongoose.connection.name !== name)
  )
    fail();
  return name;
}
