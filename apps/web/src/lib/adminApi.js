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
  { method = "GET", body, signal, timeoutMs = 20000 } = {},
) {
  let response;
  const requestHeaders = adminHeaders();
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json",
        ...requestHeaders,
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
      response.status === 401 &&
      ["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(payload.code) &&
      requestHeaders.Authorization &&
      requestHeaders.Authorization === adminHeaders().Authorization
    ) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      window.dispatchEvent(new Event("admin-session-ended"));
    }
    const known = [
      "INVALID_CREDENTIALS",
      "REGISTRATION_UNAVAILABLE",
      "CITIZEN_REQUIRED",
      "REPORT_NOT_FOUND",
      "AUTH_REQUIRED",
      "SESSION_EXPIRED",
      "ADMIN_REQUIRED",
      "DATABASE_UNAVAILABLE",
      "RATE_LIMITED",
      "DEMO_DISABLED",
      "SHORTAGE_NOT_FOUND",
      "VALIDATION_ERROR",
      "AI_NOT_CONFIGURED",
      "AI_PROVIDER_FAILED",
      "OPERATION_CONFLICT",
      "TANKER_NOT_FOUND",
      "ALLOCATION_NOT_FOUND",
      "OPERATIONS_CAPACITY",
      "AI_PROVIDER_AUTH",
      "AI_MODEL_UNAVAILABLE",
      "AI_PROVIDER_RATE_LIMITED",
      "AI_PROVIDER_INVALID_REQUEST",
      "AI_PROVIDER_UNAVAILABLE",
      "AI_PROVIDER_NETWORK",
      "AI_TIMEOUT",
      "AI_INVALID_OUTPUT",
      "AI_NO_EVIDENCE",
      "AI_EVIDENCE_LIMIT",
    ];
    throw new Error(
      known.includes(payload.code)
        ? payload.message
        : "Unable to load administrator data. Please try again.",
    );
  }
  return payload.data;
}
