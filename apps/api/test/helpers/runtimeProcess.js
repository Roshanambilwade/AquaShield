// IPC-only test harness around the actual application/runtime, with no test API.
import { loadEnv } from "../../src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../src/config/database.js";
import { createApp } from "../../src/app.js";
import { startRuntime } from "../../src/runtime.js";
const config = { ...loadEnv(), PORT: 0 };
if (
  config.NODE_ENV !== "test" ||
  !/^aquashield_reliability_test_[a-f0-9]{32}$/.test(
    config.MONGODB_TEST_DB_NAME,
  )
)
  throw new Error("Disposable test database required.");
let port,
  connected = false,
  sent = false;
const runtime = startRuntime(config, {
  app: createApp(config),
  connect: connectDatabase,
  disconnect: disconnectDatabase,
  log: (event, fields) => {
    if (event === "API_LISTENING") port = fields.port;
    if (event === "DATABASE_CONNECTED") connected = true;
    if (port && connected && !sent) {
      sent = true;
      process.send({ ready: true, port });
    }
  },
});
process.on("message", async (message) => {
  if (message === "stop") {
    await runtime.shutdown();
    process.disconnect();
  }
});
