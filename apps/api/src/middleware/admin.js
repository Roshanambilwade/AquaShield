import { authenticate, bearerToken } from "../services/authService.js";
import { ApiError } from "./errors.js";
export function requireAdmin(databaseStatus) {
  return async (req, _res, next) => {
    const token = bearerToken(req);
    if ((await databaseStatus()) !== "connected")
      throw new ApiError(
        503,
        "DATABASE_UNAVAILABLE",
        "Administrator services are temporarily unavailable.",
      );
    req.admin = await authenticate(token);
    next();
  };
}
