import mongoose from "mongoose";
export function assertTestDatabase() {
  if (
    process.env.NODE_ENV !== "test" ||
    !/^aquashield_[a-z0-9_]+_[a-f0-9]{32}$/.test(mongoose.connection.name || "")
  )
    throw new Error(
      "Browser fixtures require an isolated UUID-named test database.",
    );
}
