import test from "node:test";
import assert from "node:assert/strict";
import {
  portalHome,
  loginDestination,
  allowedDestination,
} from "../../web/src/lib/portalAccess.js";

test("login defaults to the portal for the server-authenticated role", () => {
  for (const [role, home] of [
    ["CITIZEN", "/my-reports"],
    ["ADMIN", "/admin"],
    ["OPERATOR", "/operator"],
  ]) {
    assert.equal(portalHome(role), home);
    assert.equal(loginDestination(role, null), home);
  }
});

test("login retains only destinations accessible to the current role, including demo context", () => {
  for (const [role, destination] of [
    ["CITIZEN", "/report"],
    ["CITIZEN", "/report/abc"],
    ["ADMIN", "/admin/allocations?demo=true"],
    ["OPERATOR", "/operator?demo=true"],
  ])
    assert.equal(loginDestination(role, destination), destination);
  for (const role of ["CITIZEN", "ADMIN", "OPERATOR"])
    for (const destination of ["/", "/alerts", "/alerts/abc", "/status"])
      assert.equal(loginDestination(role, destination), destination);
});

test("other roles' portal destinations never change the authenticated role or its home", () => {
  for (const [role, home, forbidden] of [
    [
      "CITIZEN",
      "/my-reports",
      ["/admin", "/admin/reports?demo=true", "/operator?role=OPERATOR"],
    ],
    ["ADMIN", "/admin", ["/report", "/my-reports", "/operator"]],
    [
      "OPERATOR",
      "/operator",
      ["/admin", "/admin/tankers?demo=true", "/report", "/my-reports"],
    ],
  ])
    for (const destination of forbidden) {
      assert.equal(allowedDestination(role, destination), false);
      assert.equal(loginDestination(role, destination), home);
    }
});

test("unsafe redirects, ambiguous route prefixes and authentication loops are rejected", () => {
  for (const role of ["CITIZEN", "ADMIN", "OPERATOR"])
    for (const destination of [
      "https://external.test/admin",
      "//external.test",
      "/\\external.test",
      "/adminish",
      "/operatorish",
      "/reports",
      "/my-reportsish",
      "/login",
      "/citizen/login",
      "/register",
      "/report\n",
      "/report/../admin",
      "/report/%2e%2e/admin",
      "/admin/../operator",
      "/operator/%2f..%2fadmin",
      {},
      "javascript:alert(1)",
    ])
      assert.equal(loginDestination(role, destination), portalHome(role));
  for (const role of [null, "UNKNOWN", "toString", "constructor"])
    assert.equal(allowedDestination(role, "/admin"), false);
});
