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
import {
  createAdmin,
  createCitizen,
  createOperator,
} from "../../apps/api/src/services/authService.js";
import User from "../../apps/api/src/models/User.js";
import Tanker from "../../apps/api/src/models/Tanker.js";
import AdminSession from "../../apps/api/src/models/AdminSession.js";

const dbName = `aquashield_browser_portals_${randomUUID().replaceAll("-", "")}`;
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
  await createCitizen({
    name: "Citizen portal tester",
    email: "citizen@portal.test",
    password,
  });
  await createAdmin({
    name: "Municipal portal tester",
    email: "admin@portal.test",
    password,
  });
  const operator = await createOperator({
    name: "Operator portal tester",
    email: "operator@portal.test",
    password,
  });
  const other = await createOperator({
    name: "Other operator",
    email: "other@portal.test",
    password,
  });
  await Tanker.create([
    {
      identifier: "OWN-TANKER",
      name: "Own tanker",
      capacityLitres: 1000,
      operatorId: operator.id,
      isDemo: true,
    },
    {
      identifier: "OTHER-TANKER",
      name: "Other tanker",
      capacityLitres: 1000,
      operatorId: other.id,
      isDemo: true,
    },
  ]);
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
test.beforeEach(async ({ page }) => {
  // Real Express requests and isolated MongoDB; no response mocks.
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

async function signIn(page, email, destination) {
  await page.goto(
    `/login${destination ? `?returnTo=${encodeURIComponent(destination)}` : ""}`,
  );
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function currentRole(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("aquashield-admin-session")}`,
      },
    });
    return {
      status: response.status,
      role: (await response.json()).data?.user.role,
    };
  });
}

for (const scenario of [
  {
    role: "CITIZEN",
    invalidReturnTo: "/report/../admin?demo=true",
    email: "citizen@portal.test",
    home: "/my-reports",
    allowed: "/report",
    ownLink: "My reports",
    forbidden: [
      "/admin?demo=true&role=ADMIN",
      "/admin/reports",
      "/admin/tankers?demo=true",
      "/admin/allocations",
      "/operator?demo=true",
    ],
    hidden: ["Municipal team", "Operator", "Citizen sign in", "Register"],
  },
  {
    role: "ADMIN",
    invalidReturnTo: "/admin/../operator",
    email: "admin@portal.test",
    home: "/admin",
    allowed: "/admin/tankers?demo=true",
    ownLink: "Municipal team",
    forbidden: ["/operator", "/report", "/my-reports"],
    hidden: [
      "Operator",
      "Report water shortage",
      "My reports",
      "Citizen sign in",
      "Register",
    ],
  },
  {
    role: "OPERATOR",
    invalidReturnTo: "/operator/../admin",
    email: "operator@portal.test",
    home: "/operator",
    allowed: "/operator?demo=true",
    ownLink: "Operator",
    forbidden: [
      "/admin?demo=true",
      "/admin/reports",
      "/admin/tankers",
      "/admin/allocations",
      "/report",
      "/my-reports",
    ],
    hidden: [
      "Municipal team",
      "Report water shortage",
      "My reports",
      "Citizen sign in",
      "Register",
    ],
  },
])
  test(`${scenario.role} keeps its portal, navigation and session across login, refresh and forbidden URLs`, async ({
    page,
  }, info) => {
    test.setTimeout(60000);
    await signIn(page, scenario.email, scenario.invalidReturnTo);
    await expect(page).toHaveURL(scenario.home);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(
      nav.getByRole("link", { name: scenario.ownLink, exact: true }),
    ).toBeVisible();
    for (const label of scenario.hidden)
      await expect(
        nav.getByRole("link", { name: label, exact: true }),
      ).toHaveCount(0);
    if (scenario.role === "ADMIN") {
      const tools = page.getByRole("navigation", {
        name: "Administrator navigation",
      });
      for (const label of ["Tankers", "Allocations", "Citizen reports"])
        await expect(
          tools.getByRole("link", { name: label, exact: true }),
        ).toBeVisible();
      await expect(page.locator('a[href="/report"]')).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Review citizen reports", exact: true })).toBeVisible();
    }
    if (scenario.role === "OPERATOR") {
      await expect(page.getByText(/OWN-TANKER/)).toBeVisible();
      await expect(page.getByText(/OTHER-TANKER/)).toHaveCount(0);
    }
    await page.reload();
    await expect(
      nav.getByRole("link", { name: scenario.ownLink, exact: true }),
    ).toBeVisible();
    expect(await currentRole(page)).toEqual({
      status: 200,
      role: scenario.role,
    });
    if (scenario.role !== "CITIZEN") {
      await page.goto(`/report/${"0".repeat(24)}`);
      await expect(page.getByRole("alert")).toContainText("citizen account");
      await expect(
        page.getByRole("link", { name: "Citizen sign in", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("link", { name: "Return to your portal" }).click();
      await expect(page).toHaveURL(scenario.home);
    }
    await page.goto("/");
    for (const href of ["/report", "/admin", "/operator"].filter(
      (path) =>
        path !== (scenario.role === "CITIZEN" ? "/report" : scenario.home),
    ))
      await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
    // Browser role metadata and query parameters cannot change the server principal.
    await page.evaluate(() =>
      sessionStorage.setItem("aquashield-role", "ADMIN"),
    );
    for (const path of scenario.forbidden) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: /access required$/ }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toContainText(
        "cannot access this portal",
      );
      await expect(
        page.getByRole("button", { name: "Sign in", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("link", { name: "Return to your portal" }).click();
      await expect(page).toHaveURL(scenario.home);
    }
    expect(await currentRole(page)).toEqual({
      status: 200,
      role: scenario.role,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await mkdir(".local/qa", { recursive: true });
    await page.screenshot({
      path: `.local/qa/portal-${scenario.role.toLowerCase()}-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: /sign in$/ })).toBeVisible();
    expect(await currentRole(page)).toEqual({ status: 401, role: undefined });
    await signIn(page, scenario.email, scenario.allowed);
    await expect(page).toHaveURL(scenario.allowed);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: /sign in$/ })).toBeVisible();
  });

test("wrong-role API denial does not destroy a valid session; refresh uses the current backend role", async ({
  page,
}) => {
  const operator = await User.findOne({ email: "operator@portal.test" });
  await signIn(page, operator.email);
  await expect(page).toHaveURL("/operator");
  await expect(page.getByText(/OWN-TANKER/)).toBeVisible();
  try {
    await User.updateOne({ _id: operator.id }, { $set: { role: "CITIZEN" } });
    await page.getByRole("button", { name: "Refresh assignments" }).click();
    await expect(page.getByRole("alert")).toContainText("required access");
    await expect(page.getByText(/OWN-TANKER/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    expect(await currentRole(page)).toEqual({ status: 200, role: "CITIZEN" });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Operator access required" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "My reports", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Return to your portal" }).click();
    await expect(page).toHaveURL("/my-reports");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
  } finally {
    await User.updateOne({ _id: operator.id }, { $set: { role: "OPERATOR" } });
  }
});

test("expired sessions return to sign-in and renewal restores citizen navigation", async ({
  page,
}) => {
  const citizen = await User.findOne({ email: "citizen@portal.test" });
  await signIn(page, citizen.email);
  await expect(page).toHaveURL("/my-reports");
  await AdminSession.updateMany(
    { userId: citizen.id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Citizen sign in" }),
  ).toBeVisible();
  await signIn(page, citizen.email);
  await expect(page).toHaveURL("/my-reports");
  expect(await currentRole(page)).toEqual({ status: 200, role: "CITIZEN" });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});

test("signed-out visitors retain public alerts, registration and portal sign-in choices", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const label of [
    "Municipal team",
    "Operator",
    "Citizen sign in",
    "Register",
    "Local alerts",
  ])
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
  await nav.getByRole("link", { name: "Operator", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operator sign in" }),
  ).toBeVisible();
  await page.goto("/alerts");
  await expect(
    page.getByRole("heading", { name: "Water crisis overview", exact: true }),
  ).toBeVisible();
});
