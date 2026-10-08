export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(_req, _res, next) {
  next(
    new ApiError(404, "NOT_FOUND", "The requested endpoint does not exist."),
  );
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);

  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong. Please try again.";
  let details = {};

  if (error instanceof ApiError) {
    ({ status, code, message, details } = error);
  } else if (error.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "The request body must contain valid JSON.";
  } else if (error.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "The request body is too large.";
  } else if (error.status >= 400 && error.status < 500) {
    status = error.status;
    code = "INVALID_REQUEST";
    message = "The request could not be processed.";
  } else {
    // Do not log raw errors: database errors may include credential-bearing URIs.
    console.error("Request failed with an internal server error.");
  }

  res.status(status).json({ success: false, message, code, details });
}
