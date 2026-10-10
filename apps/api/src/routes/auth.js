import { Router } from "express";
import { z } from "zod";
import { validate } from "../validation/report.js";
import { ApiError } from "../middleware/errors.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import {
  loginAdmin,
  logoutAdmin,
  bearerToken,
  createCitizen,
} from "../services/authService.js";
import { requireAdmin } from "../middleware/admin.js";
import { registrationInput } from "../validation/auth.js";
import { demonstration } from "../config/demonstration.js";
export function createAuthRouter(config, databaseStatus) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.post(
    "/register",
    createSubmissionLimiter({ max: 10 }),
    async (req, res) => {
      const input = validate(
        registrationInput,
        req.body,
        "Please check your registration details.",
      );
      if ((await databaseStatus()) !== "connected")
        throw new ApiError(
          503,
          "DATABASE_UNAVAILABLE",
          "Registration is temporarily unavailable.",
        );
      res
        .status(201)
        .json({
          success: true,
          data: {
            user: await createCitizen(input, { demo: demonstration(config) }),
          },
        });
    },
  );
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
        data: await loginAdmin(input.email, input.password, config, [
          "ADMIN",
          "OPERATOR",
          "CITIZEN",
        ]),
      });
    },
  );
  router.get(
    "/me",
    requireAdmin(databaseStatus, ["ADMIN", "OPERATOR", "CITIZEN"]),
    (req, res) => res.json({ success: true, data: { user: req.admin } }),
  );
  router.post(
    "/logout",
    requireAdmin(databaseStatus, ["ADMIN", "OPERATOR", "CITIZEN"]),
    async (req, res) => {
      await logoutAdmin(bearerToken(req));
      res.json({ success: true, data: { loggedOut: true } });
    },
  );
  return router;
}
