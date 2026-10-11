import mongoose from "mongoose";
import { demonstration } from "./demonstration.js";
import { assertSimulationTarget } from "./simulation.js";

mongoose.set("bufferCommands", false);

export async function connectDatabase(config, { dbName } = {}) {
  const simulationDb = config.SIMULATION_ENABLED
    ? assertSimulationTarget(config, false, dbName)
    : undefined;
  if (config.MONGODB_TEST_DB_NAME && config.NODE_ENV !== "test")
    throw new Error("Test database override requires NODE_ENV=test.");
  dbName = dbName || config.MONGODB_TEST_DB_NAME;
  if (dbName && !/^aquashield_[a-z0-9_]+_[a-f0-9]{32}$/.test(dbName))
    throw new Error("Refusing an unsafe test database name.");
  const demoDb = demonstration(config) ? config.DEMO_DATABASE_NAME : undefined;
  if (demoDb && !/^aquashield_demo(?:_[a-z0-9]+)*$/.test(demoDb))
    throw new Error("Refusing an unsafe demonstration database name.");
  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: config.MONGODB_CONNECT_TIMEOUT_MS,
    connectTimeoutMS: config.MONGODB_CONNECT_TIMEOUT_MS,
    socketTimeoutMS: config.MONGODB_CONNECT_TIMEOUT_MS,
    maxPoolSize: 10,
    ...(simulationDb || dbName || demoDb
      ? { dbName: simulationDb || dbName || demoDb }
      : {}),
  });
  if (simulationDb) {
    const db = mongoose.connection.db;
    const marker = await db
      .collection("simulationruns")
      .findOne({ _id: "municipal-v1" });
    const collections = await db.listCollections().toArray();
    let unsafe =
      marker &&
      (marker.databaseName !== simulationDb ||
        marker.isDemo !== true ||
        !/^[a-f0-9-]{36}$/.test(marker.runId || ""));
    if (
      marker &&
      (await db
        .collection("simulationruns")
        .countDocuments(
          { _id: { $ne: "municipal-v1" } },
          { limit: 1, maxTimeMS: config.MONGODB_CONNECT_TIMEOUT_MS },
        ))
    )
      unsafe = true;
    for (const { name } of collections) {
      if (name === "simulationruns" && marker) continue;
      const filter = marker
        ? { "simulation.runId": { $ne: marker.runId } }
        : {};
      if (
        await db
          .collection(name)
          .countDocuments(filter, {
            limit: 1,
            maxTimeMS: config.MONGODB_CONNECT_TIMEOUT_MS,
          })
      )
        unsafe = true;
    }
    if (unsafe) {
      await mongoose.disconnect();
      throw new Error(
        "Unsafe simulation database contents; preserved without writes.",
      );
    }
  }
}

export async function getDatabaseStatus() {
  if (mongoose.connection.readyState !== 1) return "disconnected";
  try {
    await mongoose.connection.db.admin().ping({ timeoutMS: 2000 });
    return "connected";
  } catch {
    return "unavailable";
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
