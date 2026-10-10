import { ApiError } from "../middleware/errors.js";
export async function analyticsBound(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.code === 50 || error.name === "MongoOperationTimeoutError")
      throw new ApiError(
        503,
        "ANALYTICS_TIMEOUT",
        "This query exceeded its time limit. Narrow the date range and retry.",
      );
    throw error;
  }
}
