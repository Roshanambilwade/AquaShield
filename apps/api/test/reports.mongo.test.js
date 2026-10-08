import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import mongoose from "mongoose";
import sharp from "sharp";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import Report, { initializeReportStorage } from "../src/models/Report.js";
import { demoReports } from "../src/demo/reports.js";

const databaseName = `aquashield_phase2_test_${randomUUID().replaceAll("-", "")}`;
const token = randomBytes(32).toString("hex");
const otherToken = randomBytes(32).toString("hex");
const input = () => ({
  submissionId: randomUUID(),
  location: { lat: 20.011, lng: 73.79 },
  locationSource: "MANUAL",
  locality: "Persistence Test",
  problem: "NO_WATER",
  lastSupplyTime: new Date(Date.now() - 18 * 3600000).toISOString(),
  reportedDurationHours: 18,
  waterLevel: "LESS_THAN_25",
  householdSize: 5,
  description: "Only this household's reported conditions.",
});
let config;
let app;
before(async () => {
  config = loadEnv();
  config = {
    ...config,
    MONGODB_URI: process.env.MONGODB_TEST_URI || config.MONGODB_URI,
  };
  await connectDatabase(config, { dbName: databaseName });
  await initializeReportStorage();
  app = createApp(config);
});
after(async () => {
  // Only remove the unique database created by this test, never the app database.
  if (mongoose.connection.name === databaseName)
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});

test("submission persists through a new MongoDB connection and HTTP history/detail", async () => {
  const payload = input();
  const { body } = await request(app)
    .post("/api/reports")
    .set("X-Citizen-Token", token)
    .send(payload)
    .expect(201);
  const id = body.data.id;
  assert.equal(body.data.verificationStatus, "PENDING");
  assert.equal(body.data.isDemo, false);
  assert.equal(body.data.reporterKeyHash, undefined);
  assert.equal(body.data.estimatedAffectedPopulation, undefined);
  assert.equal(await Report.countDocuments({ _id: id }), 1);
  await disconnectDatabase();
  await connectDatabase(config, { dbName: databaseName });
  const persisted = await Report.findById(id);
  assert.equal(persisted.householdSize, 5);
  const detail = await request(app)
    .get(`/api/reports/${id}`)
    .set("X-Citizen-Token", token)
    .expect(200);
  assert.equal(detail.body.data.reportedDurationHours, 18);
  const history = await request(app)
    .get("/api/reports")
    .set("X-Citizen-Token", token)
    .expect(200);
  assert.equal(
    history.body.data.reports.some((report) => report.id === id),
    true,
  );
  await request(app)
    .get(`/api/reports/${id}`)
    .set("X-Citizen-Token", otherToken)
    .expect(404);
  await request(app).get(`/api/reports/${id}`).expect(404);
  const stranger = await request(app)
    .get("/api/reports")
    .set("X-Citizen-Token", otherToken)
    .expect(200);
  assert.equal(stranger.body.data.pagination.total, 0);
});

test("retrying and concurrent requests with the same submission ID create one report", async () => {
  const payload = input();
  const responses = await Promise.all(
    [0, 1].map(() =>
      request(app)
        .post("/api/reports")
        .set("X-Citizen-Token", token)
        .send(payload),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 201],
  );
  assert.equal(responses[0].body.data.id, responses[1].body.data.id);
  assert.equal(
    await Report.countDocuments({ submissionId: payload.submissionId }),
    1,
  );
});

test("photos are persisted and returned only on authorized detail", async () => {
  const buffer = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#0c5555" },
  })
    .png()
    .toBuffer();
  const response = await request(app)
    .post("/api/reports")
    .set("X-Citizen-Token", token)
    .send({
      ...input(),
      photo: `data:image/png;base64,${buffer.toString("base64")}`,
    })
    .expect(201);
  assert.equal(response.body.data.hasPhoto, true);
  assert.equal(response.body.data.photo, undefined);
  const detail = await request(app)
    .get(`/api/reports/${response.body.data.id}`)
    .set("X-Citizen-Token", token)
    .expect(200);
  assert.equal(
    detail.body.data.photo.startsWith("data:image/jpeg;base64,"),
    true,
  );
});

test("demo seed is repeatable, public, labeled, and separate from private history", async () => {
  const records = demoReports();
  for (let pass = 0; pass < 2; pass += 1) {
    for (const record of records)
      await Report.updateOne(
        {
          reporterKeyHash: record.reporterKeyHash,
          submissionId: record.submissionId,
        },
        { $setOnInsert: record },
        { upsert: true, timestamps: false },
      );
  }
  assert.equal(await Report.countDocuments({ isDemo: true }), 12);
  const { body } = await request(app)
    .get("/api/reports?demo=true&limit=5")
    .expect(200);
  assert.equal(body.data.pagination.total, 12);
  assert.equal(body.data.reports.length, 5);
  assert.equal(
    body.data.reports.every((report) => report.isDemo),
    true,
  );
  await request(app).get(`/api/reports/${body.data.reports[0].id}`).expect(200);
  const mine = await request(app)
    .get("/api/reports")
    .set("X-Citizen-Token", token)
    .expect(200);
  assert.equal(
    mine.body.data.reports.every((report) => !report.isDemo),
    true,
  );
});

test("invalid input is rejected before any record is written", async () => {
  const count = await Report.countDocuments();
  await request(app)
    .post("/api/reports")
    .set("X-Citizen-Token", token)
    .send({ ...input(), householdSize: 0 })
    .expect(422);
  await request(app)
    .post("/api/reports")
    .set("X-Citizen-Token", token)
    .send({ ...input(), verificationStatus: "VERIFIED" })
    .expect(422);
  await request(app).post("/api/reports").send(input()).expect(400);
  await request(app).get("/api/reports/not-an-id").expect(422);
  await request(app)
    .get("/api/reports?page=0")
    .set("X-Citizen-Token", token)
    .expect(422);
  assert.equal(await Report.countDocuments(), count);
});

test("unavailable MongoDB returns a safe 503 for submission", async () => {
  const unavailable = createApp(config, {
    databaseStatus: async () => "disconnected",
  });
  const response = await request(unavailable)
    .post("/api/reports")
    .set("X-Citizen-Token", token)
    .send(input())
    .expect(503);
  assert.equal(response.body.code, "DATABASE_UNAVAILABLE");
});
