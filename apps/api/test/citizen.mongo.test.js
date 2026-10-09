import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import {
  createAdmin,
  createOperator,
  loginAdmin,
} from "../src/services/authService.js";
import { citizenSession } from "./helpers/citizen.js";
import User from "../src/models/User.js";
import AdminSession from "../src/models/AdminSession.js";
import Report from "../src/models/Report.js";
import ShortageEvent from "../src/models/ShortageEvent.js";
import { demoReports } from "../src/demo/reports.js";
import { createHash } from "node:crypto";

const databaseName = `aquashield_citizen_test_${randomUUID().replaceAll("-", "")}`;
const password = randomBytes(24).toString("hex");
const payload = () => ({
  submissionId: randomUUID(),
  location: { lat: 20.011, lng: 73.79 },
  locationSource: "MANUAL",
  locality: "Citizen ownership test",
  problem: "NO_WATER",
  reportedDurationHours: 24,
  waterLevel: "EMPTY",
  householdSize: 5,
  description: "Private household evidence",
});
let config,
  app,
  citizen,
  other,
  third,
  adminToken,
  operatorToken,
  operatorId,
  reportId;
const as = (client, token = citizen.token) =>
  client.set("Authorization", `Bearer ${token}`);
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: true,
    GEMINI_API_KEY: "",
  };
  await connectDatabase(
    {
      ...config,
      MONGODB_URI: process.env.MONGODB_TEST_URI || config.MONGODB_URI,
    },
    { dbName: databaseName },
  );
  app = createApp(config);
  citizen = await citizenSession(config);
  other = await citizenSession(config);
  third = await citizenSession(config);
  await createAdmin({
    name: "Officer",
    email: "officer@citizen.test",
    password,
  });
  adminToken = (await loginAdmin("officer@citizen.test", password, config))
    .token;
  const operator = await createOperator({
    name: "Operator",
    email: "operator@citizen.test",
    password,
  });
  operatorId = String(operator._id);
  operatorToken = (
    await loginAdmin(operator.email, password, config, ["OPERATOR"])
  ).token;
});
after(async () => {
  if (mongoose.connection.name === databaseName)
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});
test("registration assigns CITIZEN, stores scrypt only and uses shared login/me/logout", async () => {
  const input = {
    name: "Registered resident",
    email: "  New@Citizen.Test  ",
    password,
  };
  const created = await request(app)
    .post("/api/auth/register")
    .send(input)
    .expect(201);
  assert.equal(created.body.data.user.role, "CITIZEN");
  assert.equal(created.body.data.user.emailVerified, false);
  assert.equal(created.body.data.user.passwordHash, undefined);
  const stored = await User.findById(created.body.data.user.id).select(
    "+passwordHash",
  );
  assert.ok(stored.passwordHash.startsWith("scrypt:"));
  assert.notEqual(stored.passwordHash, password);
  assert.equal(stored.email, "new@citizen.test");
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: stored.email, password })
    .expect(200);
  const token = login.body.data.token;
  await as(request(app).get("/api/auth/me"), token).expect(200);
  const session = await AdminSession.findOne({ userId: stored._id }).select(
    "+tokenHash",
  );
  assert.equal(
    session.tokenHash,
    createHash("sha256").update(token).digest("hex"),
  );
  const wrong = await request(app)
    .post("/api/auth/login")
    .send({ email: stored.email, password: "incorrect" })
    .expect(401);
  const missing = await request(app)
    .post("/api/auth/login")
    .send({ email: "missing@citizen.test", password: "incorrect" })
    .expect(401);
  assert.deepEqual(wrong.body, missing.body);
  await as(request(app).post("/api/auth/logout"), token).send({}).expect(200);
  await as(request(app).get("/api/auth/me"), token).expect(401);
});
test("duplicate registration never overwrites or upgrades existing accounts", async () => {
  const before = await User.findOne({ email: "officer@citizen.test" }).select(
    "+passwordHash",
  );
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Attacker",
      email: "OFFICER@CITIZEN.TEST",
      password: "different-password-long",
    })
    .expect(409);
  assert.equal(response.body.code, "REGISTRATION_UNAVAILABLE");
  assert.equal(JSON.stringify(response.body).includes("already exists"), false);
  const unchanged = await User.findById(before.id).select("+passwordHash");
  assert.equal(unchanged.role, "ADMIN");
  assert.equal(unchanged.passwordHash, before.passwordHash);
  const input = {
    name: "Concurrent citizen",
    email: "race@citizen.test",
    password,
  };
  const results = await Promise.all(
    [0, 1].map(() => request(app).post("/api/auth/register").send(input)),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments({ email: input.email }), 1);
});
test("invalid registration, roles and verification injection fail; registration is rate limited", async () => {
  const local = createApp(config);
  for (const extra of [
    { role: "ADMIN" },
    { role: "OPERATOR" },
    { emailVerifiedAt: new Date().toISOString() },
    { name: " " },
    { password: "short" },
    { email: "invalid" },
    { phone: "unnecessary" },
  ])
    await request(local)
      .post("/api/auth/register")
      .send({
        name: "Citizen",
        email: "injection@citizen.test",
        password,
        ...extra,
      })
      .expect(422);
  assert.equal(
    await User.countDocuments({ email: "injection@citizen.test" }),
    0,
  );
  const limited = createApp(config);
  for (let i = 0; i < 10; i++)
    await request(limited).post("/api/auth/register").send({}).expect(422);
  const blocked = await request(limited)
    .post("/api/auth/register")
    .send({})
    .expect(429);
  assert.ok(blocked.headers["retry-after"]);
});
test("report submission requires an actual citizen session and rejects client ownership", async () => {
  const body = payload();
  await request(app).post("/api/reports").send(body).expect(401);
  await request(app)
    .post("/api/reports")
    .set("X-Citizen-Token", randomBytes(32).toString("hex"))
    .send(body)
    .expect(401);
  for (const token of [adminToken, operatorToken])
    await as(request(app).post("/api/reports"), token).send(body).expect(403);
  for (const extra of [
    { ownerId: other.id },
    { userId: other.id },
    { reporterKeyHash: "forged" },
    { role: "ADMIN" },
  ])
    await as(request(app).post("/api/reports"))
      .send({ ...body, ...extra })
      .expect(422);
  const saved = await as(request(app).post("/api/reports"))
    .send(body)
    .expect(201);
  reportId = saved.body.data.id;
  const stored = await Report.findById(reportId).select("+reporterKeyHash");
  assert.equal(String(stored.ownerId), citizen.id);
  assert.ok(stored.createdAt instanceof Date);
  assert.equal(saved.body.data.ownerId, undefined);
  assert.equal(saved.body.data.reporterKeyHash, undefined);
});
test("owned history survives reconnect and new login; changing IDs or keys cannot access another owner", async () => {
  await disconnectDatabase();
  await connectDatabase(
    {
      ...config,
      MONGODB_URI: process.env.MONGODB_TEST_URI || config.MONGODB_URI,
    },
    { dbName: databaseName },
  );
  const fresh = await loginAdmin(citizen.user.email, citizen.password, config, [
    "CITIZEN",
  ]);
  const own = await as(
    request(app).get(`/api/reports/${reportId}`),
    fresh.token,
  ).expect(200);
  assert.equal(own.body.data.householdSize, 5);
  assert.equal(
    (await as(request(app).get("/api/reports"), fresh.token).expect(200)).body
      .data.pagination.total,
    1,
  );
  await as(request(app).get(`/api/reports/${reportId}`), other.token)
    .set("X-Citizen-Token", citizen.token)
    .expect(404);
  assert.equal(
    (await as(request(app).get("/api/reports"), other.token).expect(200)).body
      .data.pagination.total,
    0,
  );
  await request(app).get(`/api/reports/${reportId}`).expect(401);
  await request(app).get("/api/reports").expect(401);
});
test("citizen cannot access municipal PII, AI, allocation or operator APIs; admin and operator access persist", async () => {
  for (const path of [
    "/api/dashboard/reports",
    `/api/dashboard/reports/${reportId}`,
    "/api/operations/tankers",
    "/api/operator/assignments",
  ])
    await as(request(app).get(path)).expect(403);
  await as(request(app).post("/api/ai/allocate")).send({}).expect(403);
  await as(request(app).get("/api/auth/me"), adminToken).expect(200);
  await as(request(app).get("/api/auth/me"), operatorToken).expect(200);
  await as(request(app).get("/api/operator/assignments"), operatorToken).expect(
    200,
  );
  for (const token of [operatorToken, citizen.token])
    await as(request(app).get("/api/dashboard/reports"), token).expect(403);
  const officer = await as(
    request(app).get(`/api/dashboard/reports/${reportId}`),
    adminToken,
  ).expect(200);
  assert.equal(officer.body.data.reporter.email, citizen.user.email);
  assert.equal(officer.body.data.reporter.emailVerified, false);
  assert.equal(officer.body.data.reporter.identityVerified, false);
  assert.equal(officer.body.data.reporter.residencyVerified, false);
  assert.equal(officer.body.data.description, "Private household evidence");
  assert.equal(JSON.stringify(officer.body).includes("passwordHash"), false);
  const publicEvent = await request(app).get("/api/shortages").expect(200);
  assert.equal(
    JSON.stringify(publicEvent.body).includes(citizen.user.email),
    false,
  );
  assert.equal(JSON.stringify(publicEvent.body).includes(citizen.id), false);
});
test("all portal APIs use trusted account roles even with forged role and demo parameters; denial preserves valid sessions", async () => {
  for (const token of [citizen.token, operatorToken]) {
    for (const path of [
      "dashboard/summary",
      "dashboard/map",
      "dashboard/analytics",
      "dashboard/reports",
      `dashboard/reports/${reportId}`,
      "operations/tankers",
      "operations/allocations",
    ]) {
      const denied = await as(
        request(app).get(`/api/${path}?demo=true&role=ADMIN`),
        token,
      ).expect(403);
      assert.equal(denied.body.code, "ADMIN_REQUIRED");
      assert.equal(JSON.stringify(denied.body).includes("passwordHash"), false);
    }
    const restored = await as(request(app).get("/api/auth/me"), token).expect(
      200,
    );
    assert.equal(
      restored.body.data.user.role,
      token === citizen.token ? "CITIZEN" : "OPERATOR",
    );
  }
  for (const token of [citizen.token, adminToken]) {
    await as(
      request(app).get("/api/operator/assignments?role=OPERATOR&demo=true"),
      token,
    ).expect(403);
    await as(request(app).get("/api/auth/me"), token).expect(200);
  }
});

test("account-based independent reporting retains detection, duplicates and safe area allocation tracking", async () => {
  for (const session of [other, third])
    await as(request(app).post("/api/reports"), session.token)
      .send(payload())
      .expect(201);
  const event = await ShortageEvent.findOne({ reportIds: reportId });
  assert.equal(event.eligibleReportCount, 3);
  assert.equal(event.status, "ACTIVE");
  const newSession = await loginAdmin(
    citizen.user.email,
    citizen.password,
    config,
    ["CITIZEN"],
  );
  await as(request(app).post("/api/reports"), newSession.token)
    .send(payload())
    .expect(201);
  const repeated = await ShortageEvent.findById(event.id);
  assert.equal(repeated.duplicateReportCount, 1);
  assert.equal(repeated.eligibleReportCount, 3);
  const fleet = await as(
    request(app).post("/api/operations/tankers"),
    adminToken,
  )
    .send({
      identifier: "OWN-T01",
      name: "Test fleet",
      capacityLitres: 8000,
      availableLitres: 7000,
      status: "AVAILABLE",
      operatorId,
      currentLocation: null,
      observedAt: new Date().toISOString(),
    })
    .expect(200);
  const recommendation = await as(
    request(app).post("/api/operations/allocations/recommend"),
    adminToken,
  )
    .send({ eventId: event.id, requestId: randomUUID(), useAi: false })
    .expect(200);
  const id = recommendation.body.data.allocation.id;
  await as(
    request(app).post(`/api/operations/allocations/${id}/approve`),
    adminToken,
  )
    .send({})
    .expect(200);
  await as(
    request(app).post(`/api/operations/allocations/${id}/assign`),
    adminToken,
  )
    .send({})
    .expect(200);
  const detail = (
    await as(request(app).get(`/api/reports/${reportId}`)).expect(200)
  ).body.data;
  assert.equal(detail.responseStatus.status, "ASSIGNED");
  assert.equal(detail.responseStatus.operatorId, undefined);
  assert.equal(detail.responseStatus.tankerId, undefined);
  assert.equal(detail.responseStatus.ai, undefined);
  assert.equal(detail.shortageEvent, null); // Small cluster evidence is withheld consistently.
  assert.equal(detail.verificationStatus, "PENDING");
  const renewed = await loginAdmin(
    citizen.user.email,
    citizen.password,
    config,
    ["CITIZEN"],
  );
  const history = (
    await as(request(app).get("/api/reports"), renewed.token).expect(200)
  ).body.data;
  const ownReport = history.reports.find((r) => r.id === reportId);
  assert.deepEqual(ownReport.responseStatus, detail.responseStatus);
  for (const forbidden of ["operatorId", "tankerId", "notes", "evidence", "ai"])
    assert.equal(ownReport.responseStatus[forbidden], undefined);
  await as(request(app).get(`/api/reports/${reportId}`), other.token).expect(
    404,
  );
  await as(request(app).get(`/api/reports/${reportId}`), operatorToken).expect(
    403,
  );
  const ai = await as(request(app).post("/api/ai/detect"), adminToken)
    .send({ eventId: event.id })
    .expect(200);
  assert.equal(JSON.stringify(ai.body).includes(citizen.user.email), false);
  assert.equal(JSON.stringify(ai.body).includes(citizen.id), false);
  assert.equal(
    JSON.stringify(ai.body).includes("Private household evidence"),
    false,
  );
  assert.equal(
    (
      await as(
        request(app).get("/api/operator/assignments"),
        operatorToken,
      ).expect(200)
    ).body.data.tankers[0].id,
    fleet.body.data.tanker.id,
  );
});
test("legacy and demo reports remain unassigned, preserved and correctly labeled", async () => {
  const legacy = await Report.create({
    ...payload(),
    reporterKeyHash: randomBytes(32).toString("hex"),
  });
  const demo = await Report.create(demoReports()[0]);
  assert.equal(legacy.ownerId, null);
  assert.equal(demo.ownerId, null);
  await as(request(app).get(`/api/reports/${legacy.id}`)).expect(404);
  const staff = await as(
    request(app).get(`/api/dashboard/reports/${legacy.id}`),
    adminToken,
  ).expect(200);
  assert.equal(staff.body.data.reporter.source, "LEGACY_OR_IMPORTED");
  const publicDemo = await request(app)
    .get(`/api/reports/${demo.id}`)
    .expect(200);
  assert.equal(publicDemo.body.data.isDemo, true);
  assert.equal(publicDemo.body.data.reporter, undefined);
  await request(createApp({ ...config, NODE_ENV: "production" }))
    .get("/api/reports?demo=true")
    .expect(403);
  const mine = await as(request(app).get("/api/reports")).expect(200);
  assert.equal(
    mine.body.data.reports.some((r) => [legacy.id, demo.id].includes(r.id)),
    false,
  );
  assert.equal((await Report.findById(legacy.id)).ownerId, null);
});
test("expired, disabled and role-changed citizen sessions cannot submit; logout revokes server access", async () => {
  const fresh = await citizenSession(config);
  await AdminSession.updateMany(
    { userId: fresh.id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await as(request(app).post("/api/reports"), fresh.token)
    .send(payload())
    .expect(401);
  const next = await loginAdmin(fresh.user.email, fresh.password, config, [
    "CITIZEN",
  ]);
  await User.updateOne({ _id: fresh.id }, { $set: { role: "OPERATOR" } });
  await as(request(app).post("/api/reports"), next.token)
    .send(payload())
    .expect(403);
  await User.updateOne(
    { _id: fresh.id },
    { $set: { role: "CITIZEN", disabled: true } },
  );
  await as(request(app).get("/api/reports"), next.token).expect(401);
  await User.updateOne({ _id: fresh.id }, { $set: { disabled: false } });
  await as(request(app).post("/api/auth/logout"), next.token)
    .send({})
    .expect(200);
  await as(request(app).get("/api/reports"), next.token).expect(401);
});
