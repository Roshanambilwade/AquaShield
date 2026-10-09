import { ApiError } from "../../middleware/errors.js";

// Inspect only known status/code fields. Never return messages, URLs, headers,
// provider payloads, credentials or stacks, even through nested SDK errors.
export function sanitizeProviderError(error) {
  const seen = new Set();
  let current = error;
  let timeout = false;
  let network = false;
  for (let i = 0; current && i < 6 && !seen.has(current); i++) {
    seen.add(current);
    let payload;
    try {
      payload = JSON.parse(current.message)?.error;
    } catch {
      /* non-JSON errors */
    }
    const status = Number(current.status ?? payload?.code);
    const code = payload?.status ?? current.code;
    if (current.name === "MaxTokensError")
      return failure(
        "AI_INVALID_OUTPUT",
        "The model reached its output limit before completing the validated assessment.",
        "MODEL_OUTPUT_LIMIT",
      );
    if (["StructuredOutputError", "JsonValidationError"].includes(current.name))
      return failure(
        "AI_INVALID_OUTPUT",
        "The model did not complete the required structured assessment.",
        "STRUCTURED_OUTPUT_FAILURE",
      );
    const invalidKey =
      Array.isArray(payload?.details) &&
      payload.details.some((detail) => detail?.reason === "API_KEY_INVALID");
    if (
      status === 401 ||
      status === 403 ||
      invalidKey ||
      code === "UNAUTHENTICATED" ||
      code === "PERMISSION_DENIED"
    )
      return failure(
        "AI_PROVIDER_AUTH",
        "Google rejected the credentials or access permissions.",
        "AUTH_OR_PERMISSION",
        status,
      );
    if (status === 404 || code === "NOT_FOUND")
      return failure(
        "AI_MODEL_UNAVAILABLE",
        "The configured model is unavailable for this API or account.",
        "MODEL_UNAVAILABLE",
        status,
      );
    if (status === 429 || code === "RESOURCE_EXHAUSTED")
      return failure(
        "AI_PROVIDER_RATE_LIMITED",
        "Google rejected the request because of quota or rate limits.",
        "RATE_LIMIT_OR_QUOTA",
        status,
      );
    if (status === 400 || code === "INVALID_ARGUMENT")
      return failure(
        "AI_PROVIDER_INVALID_REQUEST",
        "Google rejected the provider request configuration.",
        "INVALID_PROVIDER_REQUEST",
        status,
      );
    if (status === 503 || code === "UNAVAILABLE")
      return failure(
        "AI_PROVIDER_UNAVAILABLE",
        "Google is temporarily unavailable.",
        "PROVIDER_UNAVAILABLE",
        status,
      );
    timeout ||=
      status === 504 ||
      code === "DEADLINE_EXCEEDED" ||
      ["TimeoutError", "AbortError"].includes(current.name) ||
      [
        "ETIMEDOUT",
        "UND_ERR_CONNECT_TIMEOUT",
        "UND_ERR_HEADERS_TIMEOUT",
        "UND_ERR_BODY_TIMEOUT",
      ].includes(code);
    network ||= [
      "ENOTFOUND",
      "EAI_AGAIN",
      "ECONNRESET",
      "ECONNREFUSED",
      "ENETUNREACH",
      "EHOSTUNREACH",
      "EACCES",
      "EPERM",
      "CERT_HAS_EXPIRED",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
    ].includes(code);
    current = current.cause;
  }
  if (timeout)
    return failure(
      "AI_TIMEOUT",
      "The provider or network timed out. Please retry.",
      "PROVIDER_OR_NETWORK_TIMEOUT",
    );
  if (network)
    return failure(
      "AI_PROVIDER_NETWORK",
      "The backend could not reach Google securely. Check network connectivity.",
      "NETWORK_OR_TLS",
    );
  return failure(
    "AI_PROVIDER_FAILED",
    "Gemini could not complete the assessment. Check backend provider configuration or try again later.",
    "UNCLASSIFIED_PROVIDER_FAILURE",
  );
}

function failure(code, message, category, status) {
  return new ApiError(code === "AI_TIMEOUT" ? 504 : 502, code, message, {
    category,
    ...(Number.isInteger(status) && status >= 400 && status <= 599
      ? { providerHttpStatus: status }
      : {}),
  });
}
