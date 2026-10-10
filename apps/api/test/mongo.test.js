import { after, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
} from "../src/config/database.js";
import { createApp } from "../src/app.js";

after(disconnectDatabase);

test("real MongoDB connection and ping power the HTTP health endpoint", async () => {
  const config = loadEnv();
  await connectDatabase({
    ...config,
    MONGODB_URI: process.env.MONGODB_TEST_URI || config.MONGODB_URI,
  });
  assert.equal(await getDatabaseStatus(), "connected");
  const app = createApp(config);
  const { body } = await request(app).get("/api/health").expect(200);
  assert.equal(body.data.database, "connected");
  await request(app).get("/api/health/live").expect(200);
  const ready = await request(app).get("/api/health/ready").expect(200);
  assert.equal(ready.body.data.database, "connected");
  assert.equal(ready.body.data.ai.availability, "NOT_PROBED");
  // Read-only: Phase 1 creates no domain collections or test records.
  await disconnectDatabase();
  assert.equal(await getDatabaseStatus(), "disconnected");
  const unavailable = await request(app).get("/api/health").expect(503);
  assert.equal(unavailable.body.code, "DATABASE_UNAVAILABLE");
  await request(app).get("/api/health/live").expect(200);
  await request(app).get("/api/health/ready").expect(503);
});
