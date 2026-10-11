// IPC harness for real process restart; only an owned UUID simulation target.
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
  !/^aquashield_simulation_test_[a-f0-9]{32}$/.test(
    config.SIMULATION_DATABASE_NAME,
  )
)
  throw new Error("Disposable simulation target required");
const app = createApp(config);
let port,
  connected = false,
  sent = false;
const runtime = startRuntime(config, {
  app,
  connect: async (c) => {
    await connectDatabase(c);
    await app.locals.simulation.initialize();
  },
  disconnect: async () => {
    await app.locals.simulation.close();
    await disconnectDatabase();
  },
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
