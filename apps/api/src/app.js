import express from "express";
import cors from "cors";
import { getDatabaseStatus } from "./config/database.js";
import { createApiRouter } from "./routes/index.js";
import { createReportRouter } from "./routes/reports.js";
import { createShortageRouter } from "./routes/shortages.js";
import { ApiError, errorHandler, notFound } from "./middleware/errors.js";

export function createApp(config, { databaseStatus = getDatabaseStatus } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.CORS_ORIGIN.includes(origin))
          return callback(null, true);
        callback(
          new ApiError(
            403,
            "CORS_ORIGIN_DENIED",
            "This origin is not allowed.",
          ),
        );
      },
    }),
  );
  app.use(
    "/api/reports",
    (_req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    createReportRouter(databaseStatus, config),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/shortages", createShortageRouter(config, databaseStatus));
  app.get("/", (_req, res) =>
    res.json({ success: true, data: { name: "AquaShield API", api: "/api" } }),
  );
  app.use("/api", createApiRouter(databaseStatus));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
