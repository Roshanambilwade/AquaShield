import { test, expect } from "@playwright/test";
import { loadEnv } from "../../apps/api/src/config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../apps/api/src/config/database.js";
import Report from "../../apps/api/src/models/Report.js";
import { detectShortages } from "../../apps/api/src/services/shortageService.js";

const createdIds = [];
test.beforeAll(async () => {
  await connectDatabase(loadEnv());
});
test.afterAll(async () => {
  if (createdIds.length)
    await Report.deleteMany({ _id: { $in: createdIds }, isDemo: false });
  await detectShortages(loadEnv());
  await disconnectDatabase();
});

test("normal development origin can submit, persist, and retrieve a citizen report", async ({
  page,
  baseURL,
}) => {
  await page.goto("/report");
  await page.getByLabel("Or choose a locality center").selectOption("AREA_01");
  await page.getByLabel("Problem type").selectOption("NO_WATER");
  await page.getByLabel("How many people are in your household?").fill("4");
  await page
    .getByLabel("Description", { exact: true })
    .fill(`CORS regression from ${baseURL}`);
  const pending = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url() === `${baseURL}/api/reports`,
  );
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  const response = await pending;
  const body = await response.json();
  if (body.data?.id) createdIds.push(body.data.id);
  expect(response.status(), JSON.stringify(body)).toBe(201);
  expect(await response.request().headerValue("origin")).toBe(baseURL);
  expect(response.headers()["access-control-allow-origin"]).toBe(baseURL);
  expect(
    response.headers()["access-control-allow-credentials"],
  ).toBeUndefined();
  const stored = await Report.findById(body.data.id);
  expect(stored).not.toBeNull();
  expect(stored.householdSize).toBe(4);
  expect(stored.description).toBe(`CORS regression from ${baseURL}`);
  await expect(
    page.getByRole("heading", { name: "Your report has been received." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Track this report" }).click();
  await page.reload();
  await expect(page.getByText(body.data.id, { exact: true })).toBeVisible();
  await page.goto("/my-reports");
  await expect(page.getByRole("heading", { name: "Panchavati" })).toBeVisible();
});
