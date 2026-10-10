import User from "../models/User.js";
import Report, { initializeReportStorage } from "../models/Report.js";
import Area from "../models/Area.js";
import Tanker from "../models/Tanker.js";
import Allocation from "../models/Allocation.js";
import AllocationEvidence from "../models/AllocationEvidence.js";
import Delivery from "../models/Delivery.js";
import DemoSeedState from "../models/DemoSeedState.js";
import {
  hashPassword,
  initializeAuthStorage,
} from "../services/authService.js";
import { hashCitizenToken } from "../services/reportService.js";
import { detectShortages } from "../services/shortageService.js";
import {
  initializeOperations,
  saveTanker,
  saveEvidence,
  allocationSnapshot,
  recommendAllocation,
  decideAllocation,
  assignAllocation,
} from "../services/operationsService.js";
import {
  ensureDelivery,
  transitionTrip,
  issueDeliveryOtp,
  verifyDeliveryOtp,
  completeDelivery,
} from "../services/deliveryService.js";
import { reportInputSchema, validate } from "../validation/report.js";
import {
  tankerInput,
  evidenceInput,
  recommendInput,
} from "../validation/operations.js";
import { assertSeedTarget } from "../config/demonstration.js";
import {
  accountDefinitions,
  scenarioAreas,
  scenarioReports,
  tripScenarios,
  SEED_VERSION,
  seedRequestId,
} from "./scenario.js";

// Existing operational records, even partially created scenes, are never advanced
// or reset on a repeat run. An interrupted scene requires municipal review.
export async function seedPersistentDemo(
  config,
  passwords,
  { now = new Date() } = {},
) {
  assertSeedTarget(config, true);
  if (
    !accountDefinitions.every(
      (a) =>
        typeof passwords?.[a.key] === "string" && passwords[a.key].length >= 24,
    )
  )
    throw new Error("Dedicated demo credentials are required.");
  const counts = Object.fromEntries(
    [
      "accounts",
      "areas",
      "reports",
      "tankers",
      "fairnessEvidence",
      "allocations",
      "deliveries",
    ].map((k) => [k, { inserted: 0, present: 0, skipped: 0 }]),
  );
  const tally = (kind, created) =>
    counts[kind][created ? "inserted" : "present"]++;
  await Promise.all([
    initializeAuthStorage(),
    initializeReportStorage(),
    initializeOperations(),
  ]);
  for (const a of accountDefinitions) {
    const old = await User.findOne({ email: a.email });
    if (
      old &&
      (!old.isDemo || old.seedKey !== a.seedKey || old.role !== a.role)
    )
      throw new Error("Demo account collision; account preserved.");
  }
  for (let i = 1; i <= 9; i++) {
    const old = await Tanker.findOne({
      identifier: `FAC-T${String(i).padStart(2, "0")}`,
    });
    if (old && (!old.isDemo || old.seedOwner !== SEED_VERSION))
      throw new Error("Demo tanker collision; record preserved.");
  }
  const state = await DemoSeedState.findOneAndUpdate(
    { _id: SEED_VERSION },
    { $setOnInsert: { anchoredAt: now } },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  const anchor = state.anchoredAt,
    users = {};
  for (const a of accountDefinitions) {
    let user = await User.findOne({ email: a.email });
    const created = !user;
    if (!user) {
      try {
        user = await User.create({
          email: a.email,
          name: a.name,
          role: a.role,
          passwordHash: await hashPassword(passwords[a.key]),
          isDemo: true,
          seedKey: a.seedKey,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await User.findOne({ email: a.email, seedKey: a.seedKey });
        if (!user)
          throw new Error("Demo account collision; preserved.", {
            cause: error,
          });
      }
    }
    users[a.key] = { id: String(user._id), role: user.role };
    tally("accounts", created);
  }
  const actor = users.admin;
  for (const area of scenarioAreas(anchor)) {
    const old = await Area.findById(area._id);
    if (old && !old.isDemo)
      throw new Error("Live area preserved; seed aborted.");
    const r = await Area.updateOne(
      { _id: area._id },
      { $setOnInsert: area },
      { upsert: true, runValidators: true, timestamps: false },
    );
    tally("areas", r.upsertedCount === 1);
  }
  const citizens = accountDefinitions
    .filter((a) => a.role === "CITIZEN")
    .map((a) => users[a.key]);
  for (const d of scenarioReports(anchor, citizens)) {
    const {
      _id,
      seedKey,
      ownerId,
      createdAt,
      updatedAt,
      verificationStatus,
      verificationSource,
      isDemo,
      sourceType,
      hasPhoto,
      ...fields
    } = d;
    const input = validate(reportInputSchema, {
      ...fields,
      lastSupplyTime: fields.lastSupplyTime?.toISOString() ?? null,
    });
    const old = await Report.findById(_id);
    if (old && old.seedKey !== seedKey) {
      counts.reports.skipped++;
      continue;
    }
    const r = await Report.updateOne(
      { _id },
      {
        $setOnInsert: {
          ...input,
          ownerId,
          reporterKeyHash: hashCitizenToken(`citizen:${ownerId}`),
          seedKey,
          createdAt,
          updatedAt,
          verificationStatus,
          verificationSource,
          isDemo,
          sourceType,
          hasPhoto,
        },
      },
      { upsert: true, runValidators: true, timestamps: false },
    );
    tally("reports", r.upsertedCount === 1);
  }
  await detectShortages(config, { demo: true });
  const capacities = [12000, 10000, 9000, 8000, 7000, 6000, 5000, 4000, 6000],
    water = [10000, 9000, 8500, 7000, 6000, 4500, 4000, null, 6000];
  for (let i = 0; i < 9; i++) {
    const identifier = `FAC-T${String(i + 1).padStart(2, "0")}`;
    const rememberedId = state.tankerIds?.[identifier];
    const existingTanker = rememberedId
      ? await Tanker.findById(rememberedId)
      : await Tanker.findOne({ identifier });
    if (existingTanker) {
      if (!existingTanker.isDemo || existingTanker.seedOwner !== SEED_VERSION)
        throw new Error("Demo fleet identity collision; record preserved.");
      if (!rememberedId)
        await DemoSeedState.updateOne(
          { _id: SEED_VERSION },
          { $set: { [`tankerIds.${identifier}`]: existingTanker._id } },
        );
      tally("tankers", false);
      continue;
    }
    const input = validate(tankerInput, {
      identifier,
      name: `Scenario water unit ${i + 1}`,
      capacityLitres: capacities[i],
      availableLitres: water[i],
      status: i === 8 ? "UNAVAILABLE" : "AVAILABLE",
      currentLocation: scenarioAreas(anchor)[i % 5].center,
      observedAt: new Date(
        +anchor - (i === 7 ? 24 : 0) * 3600000,
      ).toISOString(),
      operatorId: users[`operator-${String(i + 1).padStart(2, "0")}`].id,
    });
    const t = await saveTanker(null, input, actor, true);
    await Tanker.updateOne(
      { _id: t.id },
      { $set: { seedOwner: SEED_VERSION } },
    );
    await DemoSeedState.updateOne(
      { _id: SEED_VERSION },
      { $set: { [`tankerIds.${identifier}`]: t.id } },
    );
    tally("tankers", true);
  }
  let snapshot = await allocationSnapshot(config, true);
  for (const ranking of snapshot.rankings) {
    if (await AllocationEvidence.exists({ eventId: ranking.eventId })) {
      tally("fairnessEvidence", false);
      continue;
    }
    const r = await saveEvidence(
      ranking.eventId,
      validate(evidenceInput, {
        demandLitres: ranking.area === "Panchavati" ? 10000 : 6000,
        recentDeliveredLitres: ranking.area === "Panchavati" ? 2000 : null,
        source:
          "Simulated municipal demand and previous-day ledger; demonstration evidence, not field measurements.",
        observedAt: anchor.toISOString(),
      }),
      actor,
      config,
      true,
    );
    await AllocationEvidence.updateOne(
      { _id: r.id },
      { $set: { seedOwner: SEED_VERSION } },
    );
    tally("fairnessEvidence", true);
  }
  for (const scene of tripScenarios) {
    const requestId = seedRequestId(scene.key);
    const existing = await Allocation.findOne({
      createdBy: actor.id,
      requestId,
    });
    if (existing) {
      tally("allocations", false);
      if (await Delivery.exists({ allocationId: existing._id }))
        tally("deliveries", false);
      continue;
    }
    snapshot = await allocationSnapshot(config, true);
    if (!snapshot.rankings.length || !snapshot.candidates.length) {
      counts.allocations.skipped++;
      continue;
    }
    const result = await recommendAllocation(
      validate(recommendInput, {
        eventId: snapshot.rankings[0].eventId,
        requestId,
        useAi: false,
        notes: "Simulated faculty scenario created through audited services.",
      }),
      actor,
      config,
      true,
    );
    const a = result.allocation;
    if (!a) {
      counts.allocations.skipped++;
      continue;
    }
    await Allocation.updateOne(
      { _id: a.id },
      { $set: { seedKey: `${SEED_VERSION}:${scene.key}` } },
    );
    tally("allocations", true);
    if (scene.stage === "RECOMMENDED") continue;
    if (scene.stage === "REJECTED") {
      await decideAllocation(
        a.id,
        "reject",
        "Simulated administrative request for a fresh assessment.",
        actor,
        config,
        true,
      );
      continue;
    }
    await decideAllocation(a.id, "approve", "", actor, config, true);
    await assignAllocation(a.id, actor, config, true);
    const d = await ensureDelivery(await Allocation.findById(a.id));
    await Delivery.updateOne(
      { _id: d._id },
      { $set: { seedKey: `${SEED_VERSION}:${scene.key}` } },
    );
    tally("deliveries", true);
    const operator = { id: String(d.operatorId), role: "OPERATOR" };
    if (scene.stage === "ASSIGNED") continue;
    await transitionTrip(d.id, "start", operator, config);
    if (scene.stage === "EN_ROUTE") continue;
    await transitionTrip(d.id, "arrive", operator, config);
    if (scene.stage === "ARRIVED") continue;
    const otp = await issueDeliveryOtp(d.id, operator, config, {
      revealDemo: true,
    });
    await verifyDeliveryOtp(d.id, otp.demoOtp, operator, config);
    await completeDelivery(
      d.id,
      Math.min(500, d.plannedLitres ?? 500),
      operator,
      config,
    );
  }
  return {
    version: SEED_VERSION,
    counts,
    databaseChecked: true,
    aiCalls: 0,
    totals: {
      citizens: await User.countDocuments({ isDemo: true, role: "CITIZEN" }),
      operators: await User.countDocuments({ isDemo: true, role: "OPERATOR" }),
      reports: await Report.countDocuments({ isDemo: true }),
      tankers: await Tanker.countDocuments({ seedOwner: SEED_VERSION }),
      allocations: await Allocation.countDocuments({
        seedKey: new RegExp(`^${SEED_VERSION}:`),
      }),
      deliveries: await Delivery.countDocuments({
        seedKey: new RegExp(`^${SEED_VERSION}:`),
      }),
    },
  };
}
