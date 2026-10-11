import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import SimulationRun from "../models/SimulationRun.js";
import User from "../models/User.js";
import Area from "../models/Area.js";
import Report from "../models/Report.js";
import ShortageEvent from "../models/ShortageEvent.js";
import Tanker from "../models/Tanker.js";
import Allocation from "../models/Allocation.js";
import Delivery from "../models/Delivery.js";
import CitizenAdvisory from "../models/CitizenAdvisory.js";
import { assertSimulationTarget } from "../config/simulation.js";
import { simulationContext } from "./simulationContext.js";
import { auditEntry } from "./auditContext.js";
import { ApiError } from "../middleware/errors.js";
import { hashPassword, initializeAuthStorage } from "./authService.js";
import { createReport, serializeReport } from "./reportService.js";
import { detectShortages, serializeShortage } from "./shortageService.js";
import { listTankers, saveTanker } from "./operationsService.js";
import { serializeDelivery } from "./deliveryService.js";
import { prepareForecastFixture } from "../demo/forecastFixture.js";
import { evaluatePredictions, predictionSummary } from "./predictionService.js";
import { validate, reportInputSchema } from "../validation/report.js";
import { tankerInput } from "../validation/operations.js";
import {
  simulationAccounts,
  areasForSimulation,
  tickReports,
  MAX_TICKS,
  VIRTUAL_TICK_MS,
} from "../simulation/scenario.js";

const conflict = () =>
  new ApiError(
    409,
    "SIMULATION_CONFLICT",
    "Simulation state changed or this command is not permitted. Refresh saved state.",
  );
export async function prepareSimulation(config, passwords) {
  assertSimulationTarget(config, true);
  if (!config.SIMULATION_PREPARE_ENABLED)
    throw new ApiError(
      403,
      "SIMULATION_PREPARATION_DISABLED",
      "Enable isolated simulation preparation explicitly.",
    );
  if (
    !simulationAccounts.every(
      (a) =>
        typeof passwords?.[a.key] === "string" && passwords[a.key].length >= 24,
    )
  )
    throw new Error("Dedicated simulation credentials required.");
  let run = await SimulationRun.findById("municipal-v1");
  if (!run) {
    // Claim only an empty dedicated database. An unfamiliar existing dataset is
    // never adopted, cleared or reseeded, regardless of its naming convention.
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    for (const { name } of collections)
      if (
        await mongoose.connection.db
          .collection(name)
          .countDocuments({}, { limit: 1 })
      )
        throw conflict();
    const anchorAt = new Date(Date.now() - 6 * 3600000);
    run = await SimulationRun.create({
      runId: randomUUID(),
      databaseName: config.SIMULATION_DATABASE_NAME,
      anchorAt,
      simulatedAt: anchorAt,
    });
  }
  if (run.databaseName !== config.SIMULATION_DATABASE_NAME) throw conflict();
  if (run.prepared)
    return {
      runId: run.runId,
      accounts: simulationAccounts.length,
      scenario: run.scenario,
      prepared: true,
    };
  return simulationContext.run(
    { runId: run.runId, tick: 0, eventAt: run.anchorAt },
    async () => {
      await initializeAuthStorage();
      for (const account of simulationAccounts) {
        const existing = await User.findOne({ email: account.email });
        if (existing) {
          if (
            existing.role !== account.role ||
            existing.simulation?.runId !== run.runId
          )
            throw conflict();
          continue;
        }
        await User.create({
          email: account.email,
          name: account.name,
          role: account.role,
          passwordHash: await hashPassword(passwords[account.key]),
          isDemo: true,
        });
      }
      const admin = await User.findOne({ email: simulationAccounts[0].email });
      for (const area of areasForSimulation(run.anchorAt)) {
        await Area.updateOne(
          { _id: area._id },
          { $setOnInsert: { ...area, seedKey: null } },
          { upsert: true, runValidators: true },
        );
      }
      for (let i = 0; i < 2; i++) {
        const identifier = `SIM-T${i + 1}`;
        if (await Tanker.exists({ identifier })) continue;
        const operator = await User.findOne({
          email: simulationAccounts[i + 1].email,
        });
        await saveTanker(
          null,
          validate(tankerInput, {
            identifier,
            name: `Synthetic water unit ${i + 1}`,
            capacityLitres: 8000 - i * 2000,
            availableLitres: 7000 - i * 2000,
            status: "AVAILABLE",
            operatorId: String(operator._id),
            currentLocation: areasForSimulation(run.anchorAt)[i].center,
            observedAt: new Date().toISOString(),
          }),
          { id: String(admin._id), role: "ADMIN" },
          true,
        );
      }
      await SimulationRun.updateOne(
        { _id: run._id },
        { $set: { prepared: true } },
      );
      return {
        runId: run.runId,
        accounts: simulationAccounts.length,
        scenario: run.scenario,
        prepared: true,
      };
    },
  );
}

export function createSimulationService(config, { afterReports } = {}) {
  let timer,
    active,
    actor,
    initializing,
    schedulerFailure = false,
    closed = false;
  const guard = () => assertSimulationTarget(config, true);
  async function initialize() {
    if (!config.SIMULATION_ENABLED) return;
    if (!initializing)
      initializing = (async () => {
        guard();
        // Only process startup performs recovery. No interval is recreated.
        await SimulationRun.updateOne(
          {
            _id: "municipal-v1",
            $or: [
              { status: { $in: ["RUNNING", "FAILED"] } },
              { inFlight: true },
            ],
          },
          {
            $set: {
              status: "PAUSED",
              inFlight: false,
              errorCode: "RESTART_PAUSED",
            },
            $push: { audit: auditEntry("SIMULATION_RESTART_PAUSED") },
          },
        );
      })().catch((e) => {
        initializing = undefined;
        throw e;
      });
    await initializing;
  }
  async function saved() {
    guard();
    await initialize();
    if (schedulerFailure) {
      // If MongoDB was unavailable, expose the stopped scheduler as soon as
      // storage recovers rather than leaving a misleading RUNNING status.
      await SimulationRun.updateOne(
        { _id: "municipal-v1", status: "RUNNING" },
        {
          $set: {
            status: "FAILED",
            inFlight: false,
            errorCode: "SIMULATION_TICK_FAILED",
          },
          $push: { audit: auditEntry("SIMULATION_TICK_FAILED", actor) },
        },
      );
      schedulerFailure = false;
    }
    const run = await SimulationRun.findById("municipal-v1").lean();
    if (!run?.prepared || run.databaseName !== config.SIMULATION_DATABASE_NAME)
      throw new ApiError(
        409,
        "SIMULATION_NOT_PREPARED",
        "Prepare the isolated simulation before using controls.",
      );
    return run;
  }
  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }
  async function performTick(tick, who, scheduled = false) {
    const run = await saved();
    if (tick <= run.tick) return run; // committed tick retry: no writes or journal.
    if (
      tick !== run.tick + 1 ||
      tick > MAX_TICKS ||
      run.inFlight ||
      !(scheduled
        ? run.status === "RUNNING"
        : ["READY", "PAUSED", "FAILED"].includes(run.status))
    )
      throw conflict();
    const pendingAt = run.pendingAt || new Date();
    const claimed = await SimulationRun.findOneAndUpdate(
      { _id: run._id, tick: run.tick, inFlight: false, status: run.status },
      { $set: { inFlight: true, pendingAt, errorCode: null } },
      { returnDocument: "after" },
    ).lean();
    if (!claimed) throw conflict();
    const eventAt = new Date(+run.anchorAt + tick * VIRTUAL_TICK_MS);
    let stage = "REPORT_SUBMISSION";
    try {
      await simulationContext.run(
        { runId: run.runId, tick, eventAt },
        async () => {
          const users = Object.fromEntries(
            (
              await User.find({
                role: "CITIZEN",
                "simulation.runId": run.runId,
              })
                .select("email role")
                .lean()
            ).map((u) => [
              u.email.split("@")[0],
              { id: String(u._id), role: u.role },
            ]),
          );
          for (const row of tickReports(run, tick, users))
            await createReport(
              validate(reportInputSchema, row.input),
              row.citizen,
              config,
            );
          if (afterReports) await afterReports(tick);
          stage = "SHORTAGE_ASSESSMENT";
          await detectShortages(config, { demo: true, now: eventAt });
          // A clearly separated retrospective synthetic history enters only at
          // tick four. It is never citizen/field evidence or an automatic notice.
          if (tick >= 4) {
            stage = "FORECAST_PREPARATION";
            await prepareForecastFixture(
              { ...config, DEMO_SEED_ENABLED: true },
              pendingAt,
            );
            stage = "FORECAST_EVALUATION";
            await evaluatePredictions(
              config,
              true,
              who.id,
              undefined,
              pendingAt,
              "SYNTHETIC_FORECAST",
            );
          }
          stage = "TICK_COMMIT";
          const committed = await SimulationRun.updateOne(
            { _id: run._id, tick: run.tick, inFlight: true },
            {
              $set: {
                tick,
                simulatedAt: eventAt,
                inFlight: false,
                pendingAt: null,
                status:
                  tick === MAX_TICKS
                    ? "STOPPED"
                    : scheduled
                      ? "RUNNING"
                      : "PAUSED",
                errorCode: null,
              },
              $push: {
                audit: {
                  ...auditEntry("SIMULATION_TICK_COMPLETED", who),
                  tick,
                  simulationAt: eventAt,
                },
              },
            },
          );
          if (committed.matchedCount !== 1) throw conflict();
        },
      );
    } catch (error) {
      clearTimer();
      // Only bounded classifications are logged. Never provider/DB messages,
      // requests, evidence, URI credentials or raw responses.
      console.info(
        JSON.stringify({
          event: "SIMULATION_TICK_FAILED",
          tick,
          stage,
          reason: [
            "PREDICTION_TIMEOUT",
            "PREDICTION_CAPACITY",
            "OPERATION_CONFLICT",
            "VALIDATION_ERROR",
            "SIMULATION_CONFLICT",
          ].includes(error.code)
            ? error.code
            : [
                  "MongoNetworkError",
                  "MongoServerSelectionError",
                  "MongoServerError",
                  "ValidationError",
                ].includes(error.name)
              ? error.name
              : "SERVICE_FAILURE",
        }),
      );
      await SimulationRun.updateOne(
        { _id: run._id, failedTicks: { $ne: tick } },
        {
          $addToSet: { failedTicks: tick },
          $push: {
            audit: {
              ...auditEntry("SIMULATION_TICK_FAILED", who),
              tick,
              simulationAt: eventAt,
              simulation: {
                source: "DYNAMIC_SIMULATION",
                runId: run.runId,
                tick,
                eventAt,
              },
            },
          },
        },
      );
      await SimulationRun.updateOne(
        { _id: run._id },
        {
          $set: {
            status: "FAILED",
            inFlight: false,
            errorCode: "SIMULATION_TICK_FAILED",
          },
        },
      );
      throw new ApiError(
        503,
        "SIMULATION_TICK_FAILED",
        "Tick failed. Partial evidence remains saved; pause and retry the same tick to recover without duplicating records.",
      );
    }
    return saved();
  }
  async function tick(tick, who, scheduled = false) {
    if (active) throw conflict();
    active = performTick(tick, who, scheduled);
    try {
      return await active;
    } finally {
      active = undefined;
    }
  }
  async function schedule() {
    clearTimer();
    const run = await saved();
    if (closed || run.status !== "RUNNING") return;
    timer = setTimeout(
      async () => {
        timer = undefined;
        try {
          const next = await saved();
          await tick(next.tick + 1, actor, true);
          await schedule();
        } catch {
          clearTimer();
          schedulerFailure = true;
          await saved().catch(() => {}); // Retain the flag while storage is unavailable.
        }
      },
      Math.max(5000, config.SIMULATION_TICK_INTERVAL_MS / run.speed),
    );
    timer.unref();
  }
  async function command(input, who) {
    if (who?.role !== "ADMIN")
      throw new ApiError(
        403,
        "ADMIN_REQUIRED",
        "Administrator access required.",
      );
    guard();
    if (["pause", "stop"].includes(input.action)) {
      clearTimer();
      if (active) await active.catch(() => {});
    } else if (active) throw conflict();
    const run = await saved();
    if (input.action === "step") return tick(input.tick, who);
    if (run.commandCount >= 250)
      throw new ApiError(
        409,
        "SIMULATION_LIMIT",
        "Control history limit reached; preserve this run and use another isolated database.",
      );
    const allowed = {
      start: ["READY"],
      pause: ["RUNNING"],
      resume: ["PAUSED"],
      stop: ["READY", "RUNNING", "PAUSED", "FAILED"],
      speed: ["READY", "PAUSED", "RUNNING"],
    };
    if (
      !allowed[input.action]?.includes(run.status) ||
      (input.action === "resume" && run.tick >= MAX_TICKS)
    )
      throw conflict();
    // The last permitted control must stop safely rather than exhaust the
    // history budget while leaving a timer that cannot be paused or stopped.
    const exhausted = run.commandCount === 249;
    const status = exhausted
      ? "STOPPED"
      : {
          start: "RUNNING",
          pause: "PAUSED",
          resume: "RUNNING",
          stop: "STOPPED",
        }[input.action] || run.status;
    const row = await SimulationRun.findOneAndUpdate(
      {
        _id: run._id,
        status: run.status,
        tick: run.tick,
        inFlight: false,
        commandCount: run.commandCount,
      },
      {
        $set: {
          status,
          ...(exhausted ? { errorCode: "SIMULATION_LIMIT" } : {}),
          ...(input.action === "speed" ? { speed: input.speed } : {}),
        },
        $inc: { commandCount: 1 },
        $push: {
          audit: {
            ...auditEntry(
              exhausted
                ? "SIMULATION_STOP"
                : `SIMULATION_${input.action.toUpperCase()}`,
              who,
            ),
            tick: run.tick,
            simulationAt: run.simulatedAt,
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!row) throw conflict();
    actor = who;
    if (status === "RUNNING") await schedule();
    else clearTimer();
    return row;
  }
  async function snapshot() {
    const run = await saved();
    const [
      reports,
      events,
      fleet,
      allocations,
      deliveries,
      advisories,
      predictions,
      pendingReviews,
    ] = await Promise.all([
      Report.find({ isDemo: true }).sort({ createdAt: -1 }).limit(24),
      ShortageEvent.find({ isDemo: true, status: { $ne: "SUPERSEDED" } })
        .sort({ severityScore: -1 })
        .limit(50),
      listTankers(config, true),
      Allocation.find({ isDemo: true })
        .sort({ createdAt: -1 })
        .limit(30)
        .select("status eventId tankerId simulation")
        .lean(),
      Delivery.find({ isDemo: true }).sort({ createdAt: -1 }).limit(30),
      CitizenAdvisory.find({ isDemo: true })
        .sort({ createdAt: -1 })
        .limit(30)
        .select(
          "areaName title status provenance createdAt expiresAt simulation",
        )
        .lean(),
      predictionSummary(config, true, new Date(), "SYNTHETIC_FORECAST"),
      Report.countDocuments({ isDemo: true, verificationStatus: "PENDING" }),
    ]);
    return {
      run,
      limits: {
        ticks: MAX_TICKS,
        reports: 72,
        speed: [1, 2, 3],
        intervalMs: config.SIMULATION_TICK_INTERVAL_MS,
      },
      reports: reports.map((r) => serializeReport(r)),
      events: events.map((e) => serializeShortage(e)),
      fleet: fleet.tankers,
      allocations: allocations.map((a) => ({ ...a, id: String(a._id) })),
      deliveries: deliveries.map(serializeDelivery),
      advisories: advisories.map((a) => ({ ...a, id: String(a._id) })),
      predictions,
      pendingReviews,
      provenance: "DYNAMIC_SIMULATION",
      advisorySuggestion:
        run.tick >= 4
          ? "Review the labeled synthetic evidence. Publish an explicitly simulated area advisory through Citizen advisories if appropriate."
          : null,
    };
  }
  async function close() {
    closed = true;
    clearTimer();
    if (active) await active.catch(() => {});
  }
  return { initialize, command, snapshot, close };
}
