import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
const port = Number(process.env.AQUASHIELD_BROWSER_DEV_PORT || 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid browser development port.");
const origins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
export default defineConfig({
  ...base,
  testDir: "./tests/development",
  outputDir: "./.local/test-results-origins",
  projects: origins.map((url) => ({
    name: new URL(url).hostname,
    use: { baseURL: url },
  })),
  // Never reuse a user's normal server: both fixtures and API use the isolated database.
  webServer: [
    {
      command: "npm run start -w @aquashield/api",
      url: "http://127.0.0.1:5102/api",
      env: {
        PORT: "5102",
        NODE_ENV: "test",
        DEMO_AI_MODE: "true",
        CORS_ORIGIN: origins.join(","),
      },
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -w @aquashield/web -- --port ${port} --strictPort`,
      url: origins[1],
      env: { API_PROXY_TARGET: "http://127.0.0.1:5102" },
      reuseExistingServer: false,
    },
  ],
});
