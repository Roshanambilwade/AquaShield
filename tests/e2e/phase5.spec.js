import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { prepareBrowserAdmin } from "../helpers/admin.js";
import { seedDemoReports } from "../../apps/api/src/demo/seedReports.js";
let admin;
test.beforeAll(async () => {
  admin = await prepareBrowserAdmin();
  await seedDemoReports();
});
test.afterAll(async () => {
  await admin.cleanup();
});

test("four agent roles use real protected APIs and clearly labeled demo output on desktop/mobile", async ({
  page,
}, info) => {
  await admin.signIn(page);
  await page.goto("/admin?demo=true");
  const panel = page.getByLabel("AquaShield AI recommendation");
  await expect(panel).toContainText("No AI recommendation has been generated");
  for (const role of ["allocate", "detect", "logistics", "predict"]) {
    await panel.getByLabel("Agent role").selectOption(role);
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/ai/") && r.request().method() === "POST",
    );
    await panel
      .getByRole("button", { name: "Generate recommendation" })
      .click();
    const received = await response;
    expect(received.status()).toBe(200);
    const data = (await received.json()).data;
    expect(data.execution.mode).toBe("DEMO_SIMULATION");
    expect(data.execution.providerExecuted).toBe(false);
    await expect(panel).toContainText(
      "Demo AI simulation — no Gemini execution",
    );
    await expect(panel).toContainText("89.5/100");
    await expect(panel).toContainText("97.6%");
    await expect(panel).toContainText("~588");
    await expect(panel).toContainText("Human review required");
    await expect(panel).toContainText("No allocation approved");
    await expect(panel).toContainText("Missing information");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({
    path: `.local/qa/phase5-${info.project.name}.png`,
    fullPage: true,
  });
  await panel.screenshot({
    path: `.local/qa/phase5-panel-${info.project.name}.png`,
  });
});

test("pending assessment has a loading state and prevents duplicate requests", async ({
  page,
}) => {
  await admin.signIn(page);
  await page.goto("/admin?demo=true");
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/ai/recommend-allocation", async (route) => {
    await gate;
    await route.continue();
  });
  const panel = page.getByLabel("AquaShield AI recommendation");
  await panel.getByRole("button", { name: "Generate recommendation" }).click();
  try {
    await expect(panel.getByRole("status")).toContainText(
      "assessing the evidence",
    );
    await expect(panel.getByLabel("Agent role")).toBeDisabled();
    await expect(
      panel.getByRole("button", { name: "Assessing evidence…" }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(panel).toContainText("Human review required");
});

test("agent failures show retry; changes of role or selected area clear old advice", async ({
  page,
}) => {
  await admin.signIn(page);
  await page.goto("/admin?demo=true");
  let fail = "TIMEOUT";
  await page.route("**/api/ai/recommend-allocation", async (route) => {
    if (fail)
      await route.fulfill({
        status: fail === "TIMEOUT" ? 504 : 502,
        json: {
          success: false,
          code: fail === "TIMEOUT" ? "AI_TIMEOUT" : "AI_PROVIDER_UNAVAILABLE",
          message:
            fail === "TIMEOUT"
              ? "The agent took too long. Please retry."
              : "Google is temporarily unavailable.",
        },
      });
    else await route.continue();
  });
  const panel = page.getByLabel("AquaShield AI recommendation");
  await panel.getByRole("button", { name: "Generate recommendation" }).click();
  await expect(panel.getByRole("alert")).toContainText("took too long");
  fail = "UNAVAILABLE";
  await panel.getByRole("button", { name: "Retry recommendation" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "Google is temporarily unavailable",
  );
  fail = false;
  await panel.getByRole("button", { name: "Retry recommendation" }).click();
  await expect(panel).toContainText("Human review required");
  await panel.getByLabel("Agent role").selectOption("detect");
  await expect(panel).toContainText("No AI recommendation has been generated");
  await page
    .getByLabel("Shortage event table")
    .getByRole("button", { name: "Satpur", exact: true })
    .click();
  await panel.getByLabel("Agent role").selectOption("detect");
  await expect(panel).toContainText("Selected area: Satpur");
  await panel.getByRole("button", { name: "Generate recommendation" }).click();
  await expect(panel).toContainText("Backend evidence · Satpur");
});

test("missing configuration and empty evidence are honest; public pages expose no agent control", async ({
  page,
}) => {
  expect(
    (await page.request.post("/api/ai/detect", { data: {} })).status(),
  ).toBe(401);
  await page.goto("/alerts?demo=true");
  await expect(page.getByLabel("AquaShield AI recommendation")).toHaveCount(0);
  await admin.signIn(page);
  await page.goto("/admin?demo=true");
  await page.route("**/api/ai/**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        code: "AI_NOT_CONFIGURED",
        message:
          "Set backend GEMINI_API_KEY and GEMINI_MODEL_ID, or enable DEMO_AI_MODE locally.",
      },
    }),
  );
  const panel = page.getByLabel("AquaShield AI recommendation");
  await panel.getByRole("button", { name: "Generate recommendation" }).click();
  await expect(panel.getByRole("alert")).toContainText("Set backend");
  await page.route("**/api/shortages?demo=true", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          events: [],
          summary: {
            activeShortages: 0,
            criticalAreas: 0,
            estimatedPeopleAffected: 0,
            emergingAreas: 0,
          },
          isDemo: true,
        },
      },
    }),
  );
  await page.reload();
  await expect(
    panel.getByRole("button", { name: "Generate recommendation" }),
  ).toBeDisabled();
});
