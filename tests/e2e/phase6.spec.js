import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { mkdir } from "node:fs/promises";
import { createApp } from "../../apps/api/src/app.js";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../apps/api/src/config/database.js";
import { createAdmin } from "../../apps/api/src/services/authService.js";
import Allocation from "../../apps/api/src/models/Allocation.js";
import Tanker from "../../apps/api/src/models/Tanker.js";

// Real HTTP and MongoDB, isolated from the developer's fleet and demo history.
const dbName = `aquashield_browser_phase6_${randomUUID().replaceAll("-", "")}`;
const password = randomBytes(24).toString("hex");
let server, origin;
test.beforeAll(async () => {
  const config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: true,
    GEMINI_API_KEY: "",
    CORS_ORIGIN: ["http://127.0.0.1:4174"],
  };
  await connectDatabase(config, { dbName });
  await createAdmin({
    email: "admin@phase6.test",
    password,
    name: "Operations administrator",
  });
  server = createApp(config).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.name === dbName)
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
test("admin recommendation, rejection, approval, assignment and operator visibility persist on desktop/mobile", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  // Forward unchanged browser requests to the isolated real API; no response mocks.
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@phase6.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/tankers?demo=true");
  await page.getByText("Prepare or reset the demo", { exact: true }).click();
  await page.getByRole("button", { name: "Reset demo operations" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Demo operations reset" }),
  ).toBeVisible();
  await page
    .getByLabel("Operator name", { exact: true })
    .fill("Test tanker operator");
  await page
    .getByLabel("Operator email", { exact: true })
    .fill("operator@phase6.test");
  await page.getByLabel("Initial password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Create operator/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Operator account created" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit DEMO-T01", exact: true })
    .click();
  await page
    .getByLabel(/^Operator account/)
    .selectOption({ label: "Test tanker operator" });
  await page.getByLabel("I have confirmed these operational facts now").check();
  await page.getByRole("button", { name: "Save tanker", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Tanker information saved" }),
  ).toBeVisible();
  await page.goto("/admin/allocations?demo=true");
  await expect(
    page.getByRole("heading", { name: "Fair allocation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request allocation recommendation" })
    .click();
  let card = page.getByRole("article", { name: /^Allocation / }).first();
  await expect(card).toContainText("RECOMMENDED");
  await card
    .getByLabel("Rejection reason")
    .fill("Review simulated water demand before approval");
  await card.getByRole("button", { name: "Reject allocation" }).click();
  await expect(card).toContainText("REJECTED");
  await page.getByLabel(/Request an agent explanation/).check();
  await page
    .getByRole("button", { name: "Request allocation recommendation" })
    .click();
  card = page.getByRole("article", { name: /^Allocation / }).first();
  await expect(card).toContainText("Demo AI simulation — no Gemini execution");
  await card.getByRole("button", { name: "Approve allocation" }).click();
  await expect(card).toContainText("APPROVED");
  await expect(
    card.getByRole("button", { name: "Assign approved tanker" }),
  ).toBeEnabled();
  await card.getByRole("button", { name: "Assign approved tanker" }).click();
  await expect(card).toContainText("ASSIGNED");
  await expect(
    page.getByText("No eligible tanker is currently available.", {
      exact: true,
    }),
  ).toBeVisible();
  const saved = await Allocation.findOne({ status: "ASSIGNED" }).lean();
  expect(saved.approvedBy.toString()).toBe(saved.assignedBy.toString());
  expect(
    (await Tanker.findById(saved.tankerId)).activeAllocationId.toString(),
  ).toBe(saved._id.toString());
  expect(await Allocation.countDocuments({ status: "REJECTED" })).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("article", { name: /^Allocation / }).first(),
  ).toContainText("ASSIGNED");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/phase6-admin-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/login?returnTo=/operator");
  await page.getByLabel("Email", { exact: true }).fill("operator@phase6.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/operator$/);
  await expect(
    page.getByRole("heading", { name: /Panchavati.*ASSIGNED/ }),
  ).toBeVisible();
  await expect(
    page.getByText(`Assignment ${saved._id}`, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/qa/phase6-operator-${info.project.name}.png`,
    fullPage: true,
  });
});
