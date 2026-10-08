import { Router } from "express";
import { z } from "zod";
import { validate } from "../validation/report.js";
import { ApiError } from "../middleware/errors.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import {
  loginAdmin,
  logoutAdmin,
  bearerToken,
} from "../services/authService.js";
import { requireAdmin } from "../middleware/admin.js";
export function createAuthRouter(config, databaseStatus) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.post(
    "/login",
    createSubmissionLimiter({ max: 10 }),
    async (req, res) => {
      const input = validate(
        z
          .object({
            email: z
              .email()
              .max(254)
              .transform((v) => v.toLowerCase()),
            password: z.string().min(1).max(256),
          })
          .strict(),
        req.body,
      );
      if ((await databaseStatus()) !== "connected")
        throw new ApiError(
          503,
          "DATABASE_UNAVAILABLE",
          "Sign-in is temporarily unavailable.",
        );
      res.json({
        success: true,
        data: await loginAdmin(input.email, input.password, config),
      });
    },
  );
  router.get("/me", requireAdmin(databaseStatus), (req, res) =>
    res.json({ success: true, data: { user: req.admin } }),
  );
  router.post("/logout", requireAdmin(databaseStatus), async (req, res) => {
    await logoutAdmin(bearerToken(req));
    res.json({ success: true, data: { loggedOut: true } });
  });
  return router;
}
