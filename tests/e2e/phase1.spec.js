import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const health = {
  success: true,
  data: {
    service: "aquashield-api",
    status: "ok",
    database: "connected",
    uptimeSeconds: 1,
    timestamp: "2026-10-08T08:00:00.000Z",
  },
};

test("overview has no browser errors or horizontal overflow", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A coordinated response.",
  );
  await expect(page.getByLabel("Project availability")).toContainText(
    "Phase 1",
  );
  await expect(page.getByRole("navigation")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/overview-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("basic routes support navigation and direct refresh", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Municipal team" })
    .click();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your workspace starts here.",
  );
  await page.reload();
  await expect(page.getByText("Phase 1 foundation")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Operator", exact: true })
    .click();
  await expect(page).toHaveURL("/operator");
  await expect(
    page.getByText("Tanker operator", { exact: true }),
  ).toBeVisible();
});

test("unknown frontend route renders 404 and returns home", async ({
  page,
}) => {
  await page.goto("/missing-page");
  await expect(page.getByText("404 · Page not found")).toBeVisible();
  await page.getByRole("link", { name: "Return to overview" }).click();
  await expect(page).toHaveURL("/");
});

test("status reaches the real API through the preview proxy", async ({
  page,
}) => {
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/health"),
  );
  await page.goto("/status");
  const response = await responsePromise;
  expect([200, 503]).toContain(response.status());
  const body = await response.json();
  expect(body.data.service).toBe("aquashield-api");
  await expect(page.getByText("Backend API", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeEnabled();
});

test("loading and healthy states are shown and refresh works", async ({
  page,
}) => {
  await page.route("**/api/health", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: health });
  });
  await page.goto("/status");
  await expect(page.getByRole("button", { name: "Checking…" })).toBeDisabled();
  await expect(page.getByText("All services operational")).toBeVisible();
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByText("All services operational")).toBeVisible();
});

test("database failure is shown and refresh recovers", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/health", (route) => {
    calls += 1;
    return calls === 1
      ? route.fulfill({
          status: 503,
          json: {
            success: false,
            code: "DATABASE_UNAVAILABLE",
            details: {},
            data: {
              ...health.data,
              status: "degraded",
              database: "disconnected",
            },
          },
        })
      : route.fulfill({ json: health });
  });
  await page.goto("/status");
  await expect(
    page.getByText("Database unavailable", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByText("All services operational")).toBeVisible();
});

test("network errors show a friendly message and retry control", async ({
  page,
}) => {
  await page.route("**/api/health", (route) => route.abort("failed"));
  await page.goto("/status");
  await expect(page.getByRole("alert")).toContainText(
    "Unable to reach AquaShield.",
  );
  await expect(page.getByRole("button", { name: "Check again" })).toBeEnabled();
});

test("non-JSON failures show a friendly response error", async ({ page }) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<h1>Bad gateway</h1>",
    }),
  );
  await page.goto("/status");
  await expect(page.getByRole("alert")).toContainText("unexpected response");
});

test("API failures do not show internal error details", async ({ page }) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      status: 500,
      json: { success: false, message: "secret internal error" },
    }),
  );
  await page.goto("/status");
  await expect(page.getByRole("alert")).toContainText(
    "Unable to check system status.",
  );
  await expect(page.getByRole("alert")).not.toContainText("secret");
});
