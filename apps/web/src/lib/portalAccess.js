// UI policy only. Protected APIs check the current server-side account independently.
export const PORTALS = {
  CITIZEN: { home: "/my-reports", label: "Citizen" },
  ADMIN: { home: "/admin", label: "Administrator" },
  OPERATOR: { home: "/operator", label: "Operator" },
};

export function portalHome(role) {
  return PORTALS[role]?.home || "/";
}

export function allowedDestination(role, candidate) {
  if (!Object.hasOwn(PORTALS, role) || typeof candidate !== "string")
    return false;
  // Reject external URLs, protocol-relative URLs, whitespace and backslashes.
  if (!/^\/(?!\/)[^\s\\]*$/.test(candidate)) return false;
  const path = candidate.split(/[?#]/, 1)[0];
  // Prevent path normalization from turning an allowed prefix into another portal.
  try {
    if (
      new URL(candidate, "https://aquashield.invalid").pathname !== path ||
      /%(?:2f|5c|2e)/i.test(path)
    )
      return false;
  } catch {
    return false;
  }
  if (["/", "/status"].includes(path) || /^\/alerts(?:\/|$)/.test(path))
    return true;
  const routes = {
    CITIZEN: /^\/(?:report|my-reports)(?:\/|$)/,
    ADMIN: /^\/admin(?:\/|$)/,
    OPERATOR: /^\/operator(?:\/|$)/,
  };
  return routes[role].test(path);
}

export function loginDestination(role, candidate) {
  return allowedDestination(role, candidate) ? candidate : portalHome(role);
}
