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
