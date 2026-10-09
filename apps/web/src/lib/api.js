const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);

export async function getHealth(signal) {
  let response;
  try {
    response = await fetch(`${baseUrl}/health`, {
      signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Unable to reach AquaShield. Check that the API is running and try again.",
      { cause: error },
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      "The service returned an unexpected response. Please try again.",
    );
  }

  if (
    response.status === 503 &&
    payload.code === "DATABASE_UNAVAILABLE" &&
    payload.data
  )
    return payload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error("Unable to check system status. Please try again.");
  }
  return payload;
}
import { adminHeaders, ADMIN_TOKEN_KEY } from "./adminApi.js";

export class ReportApiError extends Error {
  constructor(message, code, fields = {}) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

async function reportRequest(path, { method = "GET", body, signal } = {}) {
  const requestHeaders = adminHeaders();
  const timeout = AbortSignal.timeout(15000);
  let response;
  try {
    response = await fetch(`${baseUrl}/reports${path}`, {
      method,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
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
    if (error.name === "TimeoutError")
      throw new Error(
        "The request timed out. Please try again. Retrying the same submission will not create a duplicate.",
        { cause: error },
      );
    throw new Error(
      error.message.startsWith("Browser storage")
        ? error.message
        : "Unable to reach AquaShield. Your details are still here; please try again.",
      { cause: error },
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      "The service returned an unexpected response. Please try again.",
    );
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
    const knownCodes = [
      "VALIDATION_ERROR",
      "INVALID_PHOTO",
      "DATABASE_UNAVAILABLE",
      "REPORT_NOT_FOUND",
      "AUTH_REQUIRED",
      "SESSION_EXPIRED",
      "CITIZEN_REQUIRED",
      "DEMO_DISABLED",
      "PAYLOAD_TOO_LARGE",
      "RATE_LIMITED",
    ];
    throw new ReportApiError(
      knownCodes.includes(payload.code)
        ? payload.message
        : "Unable to process your report. Please try again.",
      payload.code,
      payload.details?.fields,
    );
  }
  return payload.data;
}

export const submitReport = (body) =>
  reportRequest("", { method: "POST", body });
export const getReport = (id, signal) =>
  reportRequest(`/${encodeURIComponent(id)}`, { signal });
export const getReports = (page, demo, signal) =>
  reportRequest(`?page=${page}&demo=${demo}`, { signal });
