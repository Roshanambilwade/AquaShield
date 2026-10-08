const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);
import { adminHeaders } from "./adminApi.js";
export async function shortageRequest(
  demo,
  { id, method = "GET", signal } = {},
) {
  let response;
  try {
    response = await fetch(
      `${baseUrl}/shortages${method === "POST" ? "/detect" : id ? `/${encodeURIComponent(id)}` : ""}?demo=${demo}`,
      {
        method,
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
        headers: {
          Accept: "application/json",
          ...(method === "POST" ? adminHeaders() : {}),
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: method === "POST" ? "{}" : undefined,
        cache: "no-store",
      },
    );
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Unable to load shortage evidence. Check the connection and try again.",
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
  if (!response.ok || !payload.success)
    throw new Error(
      [
        "DATABASE_UNAVAILABLE",
        "SHORTAGE_NOT_FOUND",
        "DEMO_DISABLED",
        "RATE_LIMITED",
        "DETECTION_CAPACITY_EXCEEDED",
      ].includes(payload.code)
        ? payload.message
        : "Unable to load shortage evidence. Please try again.",
    );
  return payload.data;
}
