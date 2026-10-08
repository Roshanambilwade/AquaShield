const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);
export const ADMIN_TOKEN_KEY = "aquashield-admin-session";
export function adminHeaders() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export async function adminRequest(
  path,
  { method = "GET", body, signal } = {},
) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      headers: {
        Accept: "application/json",
        ...adminHeaders(),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Unable to reach administrator services. Please try again.",
      { cause: error },
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Administrator services returned an unexpected response.");
  }
  if (!response.ok || !payload.success) {
    if (
      [401, 403].includes(response.status) &&
      ["AUTH_REQUIRED", "SESSION_EXPIRED", "ADMIN_REQUIRED"].includes(
        payload.code,
      )
    ) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      window.dispatchEvent(new Event("admin-session-ended"));
    }
    const known = [
      "INVALID_CREDENTIALS",
      "AUTH_REQUIRED",
      "SESSION_EXPIRED",
      "ADMIN_REQUIRED",
      "DATABASE_UNAVAILABLE",
      "RATE_LIMITED",
      "DEMO_DISABLED",
      "SHORTAGE_NOT_FOUND",
      "VALIDATION_ERROR",
    ];
    throw new Error(
      known.includes(payload.code)
        ? payload.message
        : "Unable to load administrator data. Please try again.",
    );
  }
  return payload.data;
}
