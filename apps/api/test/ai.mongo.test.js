import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import { createAdmin, loginAdmin } from "../src/services/authService.js";
import { seedDemoReports } from "../src/demo/seedReports.js";
import User from "../src/models/User.js";
import Report from "../src/models/Report.js";
import ShortageEvent from "../src/models/ShortageEvent.js";
const databaseName = `aquashield_phase5_test_${randomUUID().replaceAll("-", "")}`;
let config, app, token, user, hero;
const post = (endpoint, body = { demo: true }, target = app) =>
  request(target)
    .post(`/api/ai/${endpoint}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: true,
    AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "",
  };
  config.MONGODB_URI = process.env.MONGODB_TEST_URI || config.MONGODB_URI;
  await connectDatabase(config, { dbName: databaseName });
  const email = "phase-five@example.test",
    password = randomBytes(24).toString("hex");
  user = await createAdmin({ email, password });
  token = (await loginAdmin(email, password, config)).token;
  app = createApp(config);
  await seedDemoReports(config);
  hero = await ShortageEvent.findOne({ areaName: "Panchavati" });
});
after(async () => {
  if (mongoose.connection.name === databaseName)
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});

test("five endpoints use persisted evidence without creating fleet, allocations or forecasts", async () => {
  for (const endpoint of [
    "detect",
    "allocate",
    "logistics",
    "predict",
    "recommend-allocation",
  ]) {
    const { body } = await post(endpoint, {
      demo: true,
      eventId: String(hero._id),
    }).expect(200);
    const data = body.data;
    assert.equal(data.execution.providerExecuted, false);
    assert.equal(
      data.facts.zones.find((z) => z.area === "Panchavati").severity,
      hero.severityScore,
    );
    const allocationRole = ["allocate", "recommend-allocation"].includes(
      endpoint,
    );
    assert.equal(data.facts.zones.length, allocationRole ? 4 : 5);
    assert.equal(data.facts.risk, null);
    if (allocationRole) assert.deepEqual(data.facts.fleet, []);
    else assert.equal(data.facts.fleet, null);
    assert.equal(
      data.facts.reportsByHour.reduce((n, r) => n + r.count, 0),
      allocationRole ? 0 : 66,
    );
    assert.ok(
      data.advice.missingInformation.includes(
        allocationRole ? "Verified demand quantity" : "Available fleet records",
      ),
    );
    assert.equal(data.approved, false);
    assert.equal(JSON.stringify(data).includes("reporterKeyHash"), false);
  }
  assert.equal(await Report.countDocuments(), 66);
  const names = (await mongoose.connection.db.listCollections().toArray()).map(
    (c) => c.name,
  );
  for (const name of ["allocations", "tankers", "deliveries", "predictions"])
    assert.equal(names.includes(name), false);
});

test("strict validation rejects invented metrics, role/prompt/provider overrides and evidence mixing", async () => {
  for (const input of [
    { demo: "true" },
    { severity: 100 },
    { prompt: "dispatch" },
    { role: "ADMIN" },
    { apiKey: "injected" },
    { demo: true, eventId: "bad" },
  ])
    await post("detect", input).expect(422);
  await post("detect", { demo: false, eventId: String(hero._id) }).expect(422);
  await post("detect", { demo: true, eventId: "f".repeat(24) }).expect(404);
  const production = createApp({ ...config, NODE_ENV: "production" });
  await post("detect", { demo: true }, production).expect(403);
  await post("detect", { demo: false }, production).expect(403);
});

test("changed roles and revoked sessions cannot use AI; missing key is a controlled error", async () => {
  await User.updateOne({ _id: user._id }, { $set: { role: "CITIZEN" } });
  await post("detect").expect(403);
  await User.updateOne({ _id: user._id }, { $set: { role: "ADMIN" } });
  const real = createApp({ ...config, DEMO_AI_MODE: false });
  assert.equal(
    (await post("detect", { demo: true }, real).expect(503)).body.code,
    "AI_NOT_CONFIGURED",
  );
  await request(app)
    .post("/api/ai/detect")
    .set("Authorization", `Bearer ${"f".repeat(64)}`)
    .send({})
    .expect(401);
});

test("AI rate limit is shared across role aliases and returns retry metadata", async () => {
  const limited = createApp(config);
  for (let i = 0; i < 20; i++)
    await post(
      i % 2 ? "allocate" : "recommend-allocation",
      { invalid: true },
      limited,
    ).expect(422);
  const result = await post("detect", {}, limited).expect(429);
  assert.ok(result.headers["retry-after"]);
});
