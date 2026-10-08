import mongoose from "mongoose";

mongoose.set("bufferCommands", false);

export async function connectDatabase(config, { dbName } = {}) {
  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: config.MONGODB_CONNECT_TIMEOUT_MS,
    connectTimeoutMS: config.MONGODB_CONNECT_TIMEOUT_MS,
    socketTimeoutMS: config.MONGODB_CONNECT_TIMEOUT_MS,
    maxPoolSize: 10,
    ...(dbName ? { dbName } : {}),
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
