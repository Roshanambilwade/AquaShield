import test from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/config/env.js";

test("development defaults are runnable without secrets", () => {
  const config = parseEnv({});
  assert.equal(config.PORT, 5000);
  assert.equal(config.MONGODB_URI, "mongodb://127.0.0.1:27017/aquashield");
  assert.deepEqual(config.CORS_ORIGIN, [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  assert.equal(config.JWT_SECRET, undefined);
});

test("overrides coerce integers and support explicit origins", () => {
  const config = parseEnv({
    PORT: "5100",
    CORS_ORIGIN: "http://localhost:5173, https://aquashield.example",
  });
  assert.equal(config.PORT, 5100);
  assert.deepEqual(config.CORS_ORIGIN, [
    "http://localhost:5173",
    "https://aquashield.example",
  ]);
});

for (const [field, value] of [
  ["PORT", "0"],
  ["PORT", "5000.5"],
  ["PORT", "65536"],
  ["PORT", "abc"],
  ["NODE_ENV", "invalid"],
  ["MONGODB_URI", "https://wrong.example"],
  ["MONGODB_CONNECT_TIMEOUT_MS", "0"],
  ["MONGODB_RETRY_INTERVAL_MS", "-1"],
  ["CORS_ORIGIN", "*"],
  ["CORS_ORIGIN", "http://localhost:5173/"],
  ["CORS_ORIGIN", "https://example.com/path"],
  ["CORS_ORIGIN", ""],
]) {
  test(`rejects invalid ${field}: ${value}`, () => {
    assert.throws(() => parseEnv({ [field]: value }), new RegExp(field));
  });
}

test("invalid configuration never leaks secret values", () => {
  assert.throws(
    () => parseEnv({ MONGODB_URI: "secret-value" }),
    (error) => {
      assert.equal(error.message.includes("secret-value"), false);
      return true;
    },
  );
});

test("production requires an explicit allowlist and never adds development origins", () => {
  assert.throws(() => parseEnv({ NODE_ENV: "production" }), /CORS_ORIGIN/);
  assert.deepEqual(
    parseEnv({
      NODE_ENV: "production",
      CORS_ORIGIN: "https://aquashield.example",
      MONGODB_URI: "mongodb+srv://fixture:fixture@db.example/aquashield",
    }).CORS_ORIGIN,
    ["https://aquashield.example"],
  );
});

test("explicit development allowlists replace defaults", () => {
  assert.deepEqual(
    parseEnv({ NODE_ENV: "development", CORS_ORIGIN: "http://localhost:6000" })
      .CORS_ORIGIN,
    ["http://localhost:6000"],
  );
});
