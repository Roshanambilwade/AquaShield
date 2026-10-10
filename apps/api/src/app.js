import express from "express";
import cors from "cors";
import { correlationMiddleware } from "./services/auditContext.js";
import { createAuditRouter } from "./routes/audit.js";
import { getDatabaseStatus } from "./config/database.js";
import { createApiRouter } from "./routes/index.js";
import { createReportRouter } from "./routes/reports.js";
import { createShortageRouter } from "./routes/shortages.js";
import { createAuthRouter } from "./routes/auth.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createAiRouter } from "./routes/ai.js";
import { createPredictionRouter } from "./routes/predictions.js";
import { createDeliveryRouter } from "./routes/deliveries.js";
import {
  createOperationsRouter,
  createOperatorRouter,
} from "./routes/operations.js";
import { ApiError, errorHandler, notFound } from "./middleware/errors.js";

export function createApp(
  config,
  {
    databaseStatus = getDatabaseStatus,
    aiDependencies,
    deliveryDependencies,
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(correlationMiddleware);
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    });
    next();
  });
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
  app.use("/api/auth", createAuthRouter(config, databaseStatus));
  app.use("/api/dashboard", createDashboardRouter(config, databaseStatus));
  app.use("/api/audit", createAuditRouter(config, databaseStatus));
  app.use("/api/ai", createAiRouter(config, databaseStatus, aiDependencies));
  app.use("/api/predictions", createPredictionRouter(config, databaseStatus));
  app.use(
    "/api/operations",
    createOperationsRouter(config, databaseStatus, aiDependencies),
  );
  app.use("/api/operator", createOperatorRouter(config, databaseStatus));
  app.use(
    "/api/deliveries",
    createDeliveryRouter(config, databaseStatus, deliveryDependencies),
  );
  app.use("/api/shortages", createShortageRouter(config, databaseStatus));
  app.get("/", (_req, res) =>
    res.json({ success: true, data: { name: "AquaShield API", api: "/api" } }),
  );
  app.use("/api", createApiRouter(databaseStatus, config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
