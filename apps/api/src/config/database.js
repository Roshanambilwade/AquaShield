import mongoose from "mongoose";
import { demonstration } from "./demonstration.js";

mongoose.set("bufferCommands", false);

export async function connectDatabase(config, { dbName } = {}) {
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
    ...(dbName || demoDb ? { dbName: dbName || demoDb } : {}),
  });
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
