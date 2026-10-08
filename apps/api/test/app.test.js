import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { parseEnv } from "../src/config/env.js";

const config = parseEnv({ NODE_ENV: "test" });
const app = createApp(config, { databaseStatus: async () => "connected" });

test("backend root and API index expose only Phase 1 metadata", async () => {
  const root = await request(app).get("/").expect(200);
  assert.equal(root.body.data.api, "/api");
  const api = await request(app).get("/api").expect(200);
  assert.equal(api.body.data.phase, 1);
  assert.deepEqual(api.body.data.endpoints, { health: "/api/health" });
});

test("health reports connected services without leaking configuration", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "ok");
  assert.equal(response.body.data.database, "connected");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["x-powered-by"], undefined);
  assert.equal(JSON.stringify(response.body).includes("mongodb://"), false);
});

for (const database of ["disconnected", "unavailable"]) {
  test(`health returns 503 when database is ${database}`, async () => {
    const degradedApp = createApp(config, {
      databaseStatus: async () => database,
    });
    const response = await request(degradedApp).get("/api/health").expect(503);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, "DATABASE_UNAVAILABLE");
    assert.equal(response.body.data.database, database);
    assert.deepEqual(response.body.details, {});
  });
}

test("unknown and later-phase endpoints return consistent 404 errors", async () => {
  for (const url of [
    "/missing",
    "/api/reports",
    "/api/auth/me",
    "/api/ai/detect",
  ]) {
    const { body } = await request(app).get(url).expect(404);
    assert.deepEqual(body, {
      success: false,
      message: "The requested endpoint does not exist.",
      code: "NOT_FOUND",
      details: {},
    });
  }
});

test("malformed JSON returns a safe 400 response", async () => {
  const { body } = await request(app)
    .post("/api/health")
    .set("Content-Type", "application/json")
    .send("{ broken")
    .expect(400);
  assert.equal(body.code, "INVALID_JSON");
  assert.equal(body.stack, undefined);
  assert.equal(JSON.stringify(body).includes("broken"), false);
});

test("oversized requests return a safe 413 response", async () => {
  const { body } = await request(app)
    .post("/api/health")
    .send({ value: "x".repeat(110000) })
    .expect(413);
  assert.equal(body.code, "PAYLOAD_TOO_LARGE");
});

test("unexpected async failures are caught without exposing message or stack", async () => {
  const brokenApp = createApp(config, {
    databaseStatus: async () => {
      throw new Error("secret connection string");
    },
  });
  const { body } = await request(brokenApp).get("/api/health").expect(500);
  assert.equal(body.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(body).includes("secret"), false);
  assert.equal(body.stack, undefined);
});

test("configured origins and their preflights are allowed", async () => {
  const response = await request(app)
    .get("/api/health")
    .set("Origin", "http://localhost:5173")
    .expect(200);
  assert.equal(
    response.headers["access-control-allow-origin"],
    "http://localhost:5173",
  );
  const preflight = await request(app)
    .options("/api/health")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "GET")
    .expect(204);
  assert.equal(
    preflight.headers["access-control-allow-origin"],
    "http://localhost:5173",
  );
});

test("unconfigured origins receive a consistent 403 error", async () => {
  const response = await request(app)
    .get("/api/health")
    .set("Origin", "https://untrusted.example")
    .expect(403);
  assert.equal(response.body.code, "CORS_ORIGIN_DENIED");
  assert.equal(response.headers["access-control-allow-origin"], undefined);
});
