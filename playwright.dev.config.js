import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
  ...base,
  testDir: "./tests/development",
  projects: [
    { name: "localhost", use: { baseURL: "http://localhost:5173" } },
    { name: "127.0.0.1", use: { baseURL: "http://127.0.0.1:5173" } },
  ],
  // Exercise the real .env and normal development proxy, without a CORS override.
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    env: { NODE_ENV: "development" },
    reuseExistingServer: !process.env.CI,
  },
});
