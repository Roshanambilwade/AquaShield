import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { createSubmissionLimiter } from "../middleware/submissionLimit.js";
import { ApiError } from "../middleware/errors.js";
import { validate, reportIdSchema } from "../validation/report.js";
import {
  tankerInput,
  tankerUpdate,
  evidenceInput,
  recommendInput,
} from "../validation/operations.js";
import Tanker from "../models/Tanker.js";
import Allocation from "../models/Allocation.js";
import AllocationEvidence from "../models/AllocationEvidence.js";
import {
  allocationSnapshot,
  publicRecord,
  listTankers,
  saveTanker,
  saveEvidence,
  recommendAllocation,
  decideAllocation,
  assignAllocation,
  allocationById,
  operationError,
} from "../services/operationsService.js";
import { createOperator } from "../services/authService.js";
import { seedOperations } from "../demo/seedOperations.js";
import {
  listDeliveries,
  ensureDelivery,
  deliveryDetail,
} from "../services/deliveryService.js";

export function createOperationsRouter(config, databaseStatus, aiDependencies) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus));
  router.use((req, _res, next) => {
    req.demo =
      validate(
        z.object({ demo: z.enum(["true", "false"]).default("false") }).strict(),
        req.query,
      ).demo === "true";
    if (req.demo && config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Demo operations are disabled in production.",
      );
    next();
  });
  router.use((req, res, next) =>
    req.method === "GET" ? next() : mutationLimit(req, res, next),
  );
  const mutationLimit = createSubmissionLimiter({ max: 60 });
  const recommendationLimit = createSubmissionLimiter({ max: 20 });
  let inFlight = 0;
  const ok = (res, data) => res.json({ success: true, data });
  const id = (req) => validate(reportIdSchema, req.params.id);
  router.get("/tankers", async (req, res) =>
    ok(res, await listTankers(config, req.demo)),
  );
  router.get("/tankers/:id", async (req, res) => {
    const fleet = await listTankers(config, req.demo);
    const tanker = fleet.tankers.find((t) => t.id === id(req));
    if (!tanker)
      throw new ApiError(404, "TANKER_NOT_FOUND", "Tanker not found.");
    ok(res, { tanker });
  });
  router.post("/tankers", async (req, res) =>
    ok(res, {
      tanker: await saveTanker(
        null,
        validate(tankerInput, req.body),
        req.admin,
        req.demo,
      ),
    }),
  );
  router.patch("/tankers/:id", async (req, res) => {
    const input = validate(tankerUpdate, req.body);
    ok(res, {
      tanker: await saveTanker(
        id(req),
        input.tanker,
        req.admin,
        req.demo,
        input.revision,
      ),
    });
  });
  router.get("/allocation-context", async (req, res) => {
    const { events, ...context } = await allocationSnapshot(config, req.demo);
    void events;
    ok(res, context);
  });
  router.put("/evidence/:id", async (req, res) =>
    ok(res, {
      evidence: await saveEvidence(
        id(req),
        validate(evidenceInput, req.body),
        req.admin,
        config,
        req.demo,
      ),
    }),
  );
  router.get("/evidence/:id", async (req, res) =>
    ok(res, {
      evidence: await AllocationEvidence.findOne({
        eventId: id(req),
        isDemo: req.demo,
      }).lean(),
    }),
  );
  router.get("/allocations", async (req, res) =>
    ok(res, {
      allocations: (
        await Allocation.find({ isDemo: req.demo })
          .sort({ createdAt: -1 })
          .limit(200)
      ).map(publicRecord),
    }),
  );
  router.get("/allocations/:id", async (req, res) =>
    ok(res, {
      allocation: publicRecord(await allocationById(id(req), req.demo)),
    }),
  );
  router.post(
    "/allocations/recommend",
    recommendationLimit,
    async (req, res) => {
      const input = validate(recommendInput, req.body);
      if (inFlight >= 2)
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "Recommendations are busy. Please retry shortly.",
        );
      inFlight++;
      const controller = new AbortController();
      const cancel = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on("close", cancel);
      try {
        ok(
          res,
          await recommendAllocation(input, req.admin, config, req.demo, {
            ...aiDependencies,
            signal: controller.signal,
          }),
        );
      } finally {
        inFlight--;
        res.off("close", cancel);
      }
    },
  );
  for (const action of ["approve", "reject", "assign"])
    router.post(`/allocations/:id/${action}`, async (req, res) => {
      const input = validate(
        action === "reject"
          ? z.object({ reason: z.string().trim().min(5).max(500) }).strict()
          : z.object({}).strict(),
        req.body,
      );
      ok(res, {
        allocation:
          action === "assign"
            ? await assignAllocation(id(req), req.admin, config, req.demo)
            : await decideAllocation(
                id(req),
                action,
                input.reason,
                req.admin,
                config,
                req.demo,
              ),
      });
    });
  router.post("/operators", async (req, res) => {
    const input = validate(
      z
        .object({
          name: z.string().trim().min(2).max(120),
          email: z.email().max(254),
          password: z.string().min(12).max(256),
        })
        .strict(),
      req.body,
    );
    const user = await createOperator(input);
    ok(res, {
      operator: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });
  router.post("/demo/reset", async (req, res) => {
    validate(
      z.object({ confirm: z.literal("RESET_DEMO_OPERATIONS") }).strict(),
      req.body,
    );
    if (!req.demo || config.NODE_ENV === "production")
      throw new ApiError(
        403,
        "DEMO_DISABLED",
        "Reset only applies to local simulated operations.",
      );
    ok(res, await seedOperations(config, req.admin, { reset: true }));
  });
  router.use((error, _req, _res, next) => next(operationError(error)));
  return router;
}

export function createOperatorRouter(config, databaseStatus) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAdmin(databaseStatus, ["OPERATOR"]));
  router.get("/assignments/:id", async (req, res) => {
    validate(z.object({}).strict(), req.query);
    const allocation = await Allocation.findOne({
      _id: validate(reportIdSchema, req.params.id),
      operatorId: req.admin.id,
      status: { $in: ["ASSIGNED", "COMPLETED"] },
      ...(config.NODE_ENV === "production" ? { isDemo: false } : {}),
    });
    if (!allocation)
      throw new ApiError(404, "ALLOCATION_NOT_FOUND", "Assignment not found.");
    const d = await ensureDelivery(allocation);
    res.json({
      success: true,
      data: await deliveryDetail(d.id, req.admin, config),
    });
  });
  router.get("/assignments", async (req, res) => {
    validate(z.object({}).strict(), req.query);
    const filter = {
      operatorId: req.admin.id,
      ...(config.NODE_ENV === "production" ? { isDemo: false } : {}),
    };
    const [tankers, allocations] = await Promise.all([
      Tanker.find(filter).lean(),
      Allocation.find({ ...filter, status: "ASSIGNED" })
        .sort({ assignedAt: -1 })
        .lean(),
    ]);
    res.json({
      success: true,
      data: {
        deliveries: await listDeliveries(req.admin, config),
        tankers: tankers.map((t) => ({
          id: String(t._id),
          name: t.name,
          identifier: t.identifier,
          status: t.status,
          capacityLitres: t.capacityLitres,
          availableLitres: t.availableLitres,
          currentLocation: t.currentLocation,
          observedAt: t.observedAt,
          isDemo: t.isDemo,
        })),
        assignments: allocations.map((a) => ({
          id: String(a._id),
          tankerId: String(a.tankerId),
          status: a.status,
          assignedAt: a.assignedAt,
          notes: a.notes,
          isDemo: a.isDemo,
          destination: a.evidence.rankings.find(
            (e) => e.eventId === String(a.eventId),
          ),
          proposedLitres: a.evidence.proposedLitres,
        })),
      },
    });
  });
  return router;
}
