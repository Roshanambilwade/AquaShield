import mongoose from "mongoose";
import { test, expect } from "@playwright/test";
import sharp from "sharp";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../apps/api/src/config/database.js";
import { loadEnv } from "../../apps/api/src/config/env.js";
import Report, {
  initializeReportStorage,
} from "../../apps/api/src/models/Report.js";
import { seedDemoReports } from "../../apps/api/src/demo/seedReports.js";
import { detectShortages } from "../../apps/api/src/services/shortageService.js";
import { prepareBrowserCitizen } from "../helpers/citizen.js";

const ownedIds = [];
const citizens = [];
test.beforeEach(async ({ page }) => {
  const citizen = await prepareBrowserCitizen();
  citizens.push(citizen);
  await citizen.signIn(page);
});
test.beforeAll(async () => {
  await connectDatabase(loadEnv());
  await initializeReportStorage();
  await seedDemoReports();
});
test.afterAll(async () => {
  // Delete only the exact report IDs created by these browser tests.
  if (ownedIds.length)
    await Report.collection.deleteMany({
      _id: { $in: ownedIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isDemo: false,
    });
  await detectShortages(loadEnv());
  for (const citizen of citizens) await citizen.cleanup();
  await disconnectDatabase();
});

async function fillReport(page) {
  await page.goto("/report");
  await page.getByLabel("Or choose a locality center").selectOption("AREA_01");
  await page.getByLabel("Problem type").selectOption("NO_WATER");
  await page.getByLabel("Approximate shortage duration (hours)").fill("18");
  await page
    .getByLabel("Current household water level")
    .selectOption("LESS_THAN_25");
  await page.getByLabel("How many people are in your household?").fill("5");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Browser flow test: household water shortage.");
}

async function submitAndRemember(page) {
  const response = page.waitForResponse(
    (result) =>
      result.url().endsWith("/api/reports") &&
      result.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  const saved = await response;
  const body = await saved.json();
  expect(saved.status()).toBe(201);
  ownedIds.push(body.data.id);
  await expect(page).toHaveURL(
    new RegExp(`/report/success\\?id=${body.data.id}$`),
  );
  await expect(
    page.getByRole("heading", { name: "Your report has been received." }),
  ).toBeVisible();
  return body.data.id;
}

test("citizen submits with photo; MongoDB, history, and status retain the report", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fillReport(page);
  const photo = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#0c5555" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Photo (JPEG or PNG, up to 2 MB)")
    .setInputFiles({ name: "water.png", mimeType: "image/png", buffer: photo });
  await expect(
    page.getByAltText("Selected report photo preview"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/qa/report-form-${testInfo.project.name}.png`,
    fullPage: true,
  });
  const id = await submitAndRemember(page);
  const stored = await Report.findById(id).select("+photo");
  expect(stored.householdSize).toBe(5);
  expect(stored.reportedDurationHours).toBe(18);
  expect(stored.verificationStatus).toBe("PENDING");
  expect(stored.photo.contentType).toBe("image/jpeg");
  await page.getByRole("link", { name: "Track this report" }).click();
  await expect(
    page.getByRole("heading", { name: "Report status" }),
  ).toBeVisible();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
  await expect(
    page.getByAltText("Photo supplied with this water problem report"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Approximately 18 hours")).toBeVisible();
  await page.goto("/my-reports");
  await expect(page.getByRole("heading", { name: "Panchavati" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/qa/history-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "View report" }).click();
  await page.screenshot({
    path: `.local/qa/report-status-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("unknown supply time and duration are not replaced with invented values", async ({
  page,
}) => {
  await fillReport(page);
  await page.getByLabel("Approximate shortage duration (hours)").fill("");
  await page
    .getByLabel("Current household water level")
    .selectOption("UNKNOWN");
  const id = await submitAndRemember(page);
  const stored = await Report.findById(id);
  expect(stored.lastSupplyTime).toBeNull();
  expect(stored.reportedDurationHours).toBeNull();
  expect(stored.waterLevel).toBe("UNKNOWN");
});

test("client validation and failed submission preserve the form for retry", async ({
  page,
}) => {
  await page.goto("/report");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("highlighted fields");
  await fillReport(page);
  await page.route("**/api/reports", (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        message:
          "Reports cannot be accessed right now. Please try again shortly.",
        code: "DATABASE_UNAVAILABLE",
        details: {},
      },
    }),
  );
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("try again shortly");
  await expect(
    page.getByLabel("How many people are in your household?"),
  ).toHaveValue("5");
  await page.unroute("**/api/reports");
  await submitAndRemember(page);
});

test("device capture works and denied permission offers manual selection", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 19.9975,
    longitude: 73.7898,
    accuracy: 30,
  });
  await page.goto("/report");
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
    "19.9975",
  );
  await expect(page.getByLabel("Longitude", { exact: true })).toHaveValue(
    "73.7898",
  );
  await expect(page.getByText(/Location captured/)).toBeVisible();
  await page.reload();
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_success, failure) =>
      failure({ code: 1 });
  });
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(page.getByText(/permission was denied/)).toBeVisible();
  await page.getByLabel("Or choose a locality center").selectOption("AREA_01");
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
    "20.011",
  );
});

test("another citizen's history is empty and private report IDs cannot be read", async ({
  page,
  browser,
}) => {
  await fillReport(page);
  const id = await submitAndRemember(page);
  const other = await browser.newContext();
  try {
    const stranger = await other.newPage();
    const otherCitizen = await prepareBrowserCitizen();
    citizens.push(otherCitizen);
    await otherCitizen.signIn(stranger);
    await stranger.goto("http://127.0.0.1:4174/my-reports");
    await expect(
      stranger.getByRole("heading", { name: "No reports here yet." }),
    ).toBeVisible();
    await stranger.goto(`http://127.0.0.1:4174/report/${id}`);
    await expect(stranger.getByRole("alert")).toContainText(
      "not available to your account",
    );
  } finally {
    await other.close();
  }
});

test("demo history is labeled simulated and remains separate", async ({
  page,
}) => {
  await page.goto("/my-reports?demo=true");
  await expect(
    page.getByRole("heading", { name: "Demo reports", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Simulated demo", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "View report" }).first().click();
  await expect(page.getByText(/Simulated demo report/)).toBeVisible();
  await page.goto("/my-reports");
  await expect(
    page.getByRole("heading", { name: "No reports here yet." }),
  ).toBeVisible();
});

test("canceling a photo while it is being read does not block submission", async ({
  page,
}) => {
  await fillReport(page);
  await page.evaluate(() => {
    const original = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (file) {
      window.finishPhotoRead = () =>
        new Promise((resolve) => {
          this.addEventListener("loadend", resolve, { once: true });
          original.call(this, file);
        });
    };
  });
  const photo = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const input = page.getByLabel("Photo (JPEG or PNG, up to 2 MB)");
  await input.setInputFiles({
    name: "water.png",
    mimeType: "image/png",
    buffer: photo,
  });
  await expect(
    page.getByRole("button", { name: "Submit report", exact: true }),
  ).toBeDisabled();
  await input.setInputFiles([]);
  await page.evaluate(() => window.finishPhotoRead());
  await expect(
    page.getByRole("button", { name: "Submit report", exact: true }),
  ).toBeEnabled();
  await expect(page.getByAltText("Selected report photo preview")).toHaveCount(
    0,
  );
});
