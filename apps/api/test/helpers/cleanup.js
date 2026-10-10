import mongoose from "mongoose";
import { disconnectDatabase } from "../../src/config/database.js";

// The caller passes the UUID name it generated, never a normal/demo database.
// Keep failures visible while always closing sockets so failed hooks can exit.
export async function cleanupTestDatabase(
  expected,
  {
    connection = mongoose.connection,
    disconnect = disconnectDatabase,
    nodeEnv = process.env.NODE_ENV,
  } = {},
) {
  try {
    if (
      nodeEnv !== "test" ||
      !/^aquashield_[a-z0-9_]+_[a-f0-9]{32}$/.test(expected)
    )
      throw new Error(
        "Refusing cleanup without an owned disposable test database.",
      );
    if (connection.readyState !== 1) return;
    if (connection.name !== expected)
      throw new Error("Refusing cleanup of a different database.");
    await connection.dropDatabase({ maxTimeMS: 5000 });
  } finally {
    await disconnect();
  }
}
