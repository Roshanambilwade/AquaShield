import { authenticate, bearerToken } from "../services/authService.js";
import { ApiError } from "./errors.js";
import { auditContext, securityLog } from "../services/auditContext.js";
export function requireAdmin(databaseStatus, roles = ["ADMIN"]) {
  return async (req, _res, next) => {
    try {
      const token = bearerToken(req);
      if ((await databaseStatus()) !== "connected")
        throw new ApiError(
          503,
          "DATABASE_UNAVAILABLE",
          "Administrator services are temporarily unavailable.",
        );
      req.admin = await authenticate(token, roles);
      const context = auditContext.getStore();
      if (context) {
        context.actorId = req.admin.id;
        context.role = req.admin.role;
      }
      next();
    } catch (error) {
      if ([401, 403].includes(error.status))
        securityLog("AUTHORIZATION_DENIED");
      throw error;
    }
  };
}
