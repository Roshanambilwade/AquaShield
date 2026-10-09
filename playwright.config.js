import { defineConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

// Shared by the test server and fixtures; never seed the normal root database.
process.env.NODE_ENV = "test";
process.env.DEMO_AI_MODE = "true";
process.env.GEMINI_API_KEY = "";
process.env.MONGODB_TEST_DB_NAME ||= `aquashield_browser_test_${randomUUID().replaceAll("-", "")}`;

const localTemp = fileURLToPath(new URL("./.local/tmp/", import.meta.url));
mkdirSync(localTemp, { recursive: true });
process.env.TEMP = localTemp;
process.env.TMP = localTemp;

export default defineConfig({
  globalTeardown: "./tests/helpers/teardown.js",
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: "npm run start -w @aquashield/api",
      url: "http://127.0.0.1:5100/api",
      env: {
        PORT: "5100",
        NODE_ENV: "test",
        DEMO_AI_MODE: "true",
        CORS_ORIGIN: "http://127.0.0.1:4174",
      },
      reuseExistingServer: false,
    },
    {
      command: "npm run preview -w @aquashield/web -- --port 4174",
      url: "http://127.0.0.1:4174",
      env: { API_PROXY_TARGET: "http://127.0.0.1:5100" },
      reuseExistingServer: false,
    },
  ],
});
