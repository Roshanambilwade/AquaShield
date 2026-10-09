import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { parseEnv } from "../src/config/env.js";
import { hashPassword, verifyPassword } from "../src/services/authService.js";
import { registrationInput } from "../src/validation/auth.js";
const config = parseEnv({ NODE_ENV: "test" });
const app = createApp(config, { databaseStatus: async () => "unavailable" });
test("scrypt hashes use random salts and validate only the correct password", async () => {
  const password = "test-password-long-enough";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("incorrect", first), false);
});
test("all dashboard routes reject anonymous requests before accessing the database", async () => {
  for (const path of [
    "summary",
    "map",
    "analytics",
    `shortages/${"0".repeat(24)}`,
  ]) {
    const response = await request(app)
      .get(`/api/dashboard/${path}`)
      .expect(401);
    assert.equal(response.body.code, "AUTH_REQUIRED");
    assert.equal(response.headers["cache-control"], "no-store");
  }
  await request(app).get("/api/auth/me").expect(401);
  await request(app)
    .get("/api/dashboard/map")
    .set("Authorization", "Bearer forged")
    .expect(401);
  await request(app)
    .get("/api/dashboard/map")
    .set("Authorization", `Bearer ${"a".repeat(64)}`)
    .expect(503);
});
test("sign-in rejects invalid payloads, role injection, and fails safely when MongoDB is unavailable", async () => {
  await request(app)
    .post("/api/auth/login")
    .send({ email: "bad", password: "p" })
    .expect(422);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@example.test", password: "p", role: "ADMIN" })
    .expect(422);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@example.test", password: "p" })
    .expect(503);
});
test("sign-in is rate limited and disallowed origins cannot use it", async () => {
  const limited = createApp(config);
  for (let i = 0; i < 10; i++)
    await request(limited).post("/api/auth/login").send({}).expect(422);
  const blocked = await request(limited)
    .post("/api/auth/login")
    .send({})
    .expect(429);
  assert.ok(blocked.headers["retry-after"]);
  await request(limited)
    .post("/api/auth/login")
    .set("Origin", "https://untrusted.example")
    .send({})
    .expect(403);
});
test("admin session configuration has bounded lifetime", () => {
  assert.equal(config.ADMIN_SESSION_HOURS, 8);
  for (const value of ["0", "25", "abc"])
    assert.throws(
      () => parseEnv({ ADMIN_SESSION_HOURS: value }),
      /ADMIN_SESSION_HOURS/,
    );
});
test("registration allows only minimal contact inputs and rejects privileges or invented verification", () => {
  const input = {
    name: " Citizen ",
    email: " CITIZEN@EXAMPLE.TEST ",
    password: "long-password-example",
  };
  assert.equal(registrationInput.parse(input).email, "citizen@example.test");
  assert.equal(registrationInput.parse(input).name, "Citizen");
  for (const extra of [
    { role: "ADMIN" },
    { role: "OPERATOR" },
    { emailVerifiedAt: "2026-10-09" },
    { ownerId: "forged" },
    { password: "short" },
    { name: " " },
    { email: "not-an-email" },
  ])
    assert.equal(
      registrationInput.safeParse({ ...input, ...extra }).success,
      false,
    );
});
test("citizen registration and personal report routes fail safely without valid authentication or MongoDB", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({
      name: "Citizen",
      email: "citizen@example.test",
      password: "long-password-example",
    })
    .expect(503);
  await request(app).post("/api/reports").send({}).expect(401);
  await request(app)
    .post("/api/reports")
    .set("X-Citizen-Token", "a".repeat(64))
    .send({})
    .expect(401);
});
