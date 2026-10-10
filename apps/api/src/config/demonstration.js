import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "../middleware/errors.js";

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
export const demonstrationSchema = z.object({
  DEMONSTRATION_MODE: flag,
  DEMO_SEED_ENABLED: flag,
  DEMO_DATABASE_NAME: z
    .string()
    .regex(/^aquashield_demo(?:_[a-z0-9]+)*$/)
    .default("aquashield_demo"),
});
export function demonstration(config) {
  if (config.DEMONSTRATION_MODE && config.NODE_ENV === "production")
    throw new ApiError(
      403,
      "DEMO_DISABLED",
      "Demonstration mode is disabled in production.",
    );
  return config.DEMONSTRATION_MODE === true;
}
export const datasetDemo = (config, requested = false) =>
  demonstration(config) || requested;
export function assertSeedTarget(config, connected = false) {
  if (
    !demonstration(config) ||
    config.DEMO_SEED_ENABLED !== true ||
    !["development", "test"].includes(config.NODE_ENV) ||
    (config.MONGODB_TEST_DB_NAME &&
      (config.NODE_ENV !== "test" ||
        !/^aquashield_[a-z0-9_]+_[a-f0-9]{32}$/.test(
          config.MONGODB_TEST_DB_NAME,
        ))) ||
    !/^aquashield_demo(?:_[a-z0-9]+)*$/.test(config.DEMO_DATABASE_NAME || "")
  )
    throw new ApiError(
      403,
      "UNSAFE_DEMO_TARGET",
      "Enable demonstration seeding only against an explicitly named demo database.",
    );
  if (connected) {
    const expected =
      config.NODE_ENV === "test" && config.MONGODB_TEST_DB_NAME
        ? config.MONGODB_TEST_DB_NAME
        : config.DEMO_DATABASE_NAME;
    if (
      mongoose.connection.readyState !== 1 ||
      mongoose.connection.name !== expected
    )
      throw new ApiError(
        403,
        "UNSAFE_DEMO_TARGET",
        "The connected database does not match the guarded demo target.",
      );
  }
}
