import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { createApp } from "../src/app.js";
import {
  createAdmin,
  createOperator,
  loginAdmin,
} from "../src/services/authService.js";
import { seedOperations } from "../src/demo/seedOperations.js";
import { ApiError } from "../src/middleware/errors.js";
import Tanker from "../src/models/Tanker.js";
import Allocation from "../src/models/Allocation.js";
import AllocationEvidence from "../src/models/AllocationEvidence.js";
import User from "../src/models/User.js";
import ShortageEvent from "../src/models/ShortageEvent.js";
const databaseName = `aquashield_phase6_test_${randomUUID().replaceAll("-", "")}`;
let config,
  app,
  token,
  actor,
  operator,
  operatorToken,
  otherToken,
  hero,
  tanker;
const call = (method, path, body, as = token, target = app) => {
  const client = request(target);
  return client[method](`/api/operations/${path}?demo=true`)
    .set("Authorization", `Bearer ${as}`)
    .send(body);
};
const recommend = (body = {}, target = app) =>
  call(
    "post",
    "allocations/recommend",
    { eventId: hero, requestId: randomUUID(), useAi: false, ...body },
    token,
    target,
  );

async function recoveryFixture() {
  app = createApp(config); // independent rate-limit window
  await seedOperations(config, actor, { reset: true });
  await User.updateOne({ _id: operator._id }, { $set: { disabled: false } });
  await Tanker.updateOne(
    { _id: tanker._id },
    {
      $set: {
        operatorId: operator._id,
        observedAt: new Date(),
        availableLitres: 8000,
      },
    },
  );
  const a = (await recommend().expect(200)).body.data.allocation;
  await call("post", `allocations/${a.id}/approve`, {}).expect(200);
  await Allocation.updateOne({ _id: a.id }, { $set: { status: "ASSIGNING" } });
  return a;
}
before(async () => {
  config = {
    ...loadEnv(),
    NODE_ENV: "test",
    DEMO_AI_MODE: true,
    GEMINI_API_KEY: "",
  };
  await connectDatabase(
    {
      ...config,
      MONGODB_URI: process.env.MONGODB_TEST_URI || config.MONGODB_URI,
    },
    { dbName: databaseName },
  );
  const password = randomBytes(24).toString("hex");
  const admin = await createAdmin({ email: "admin@phase6.test", password });
  actor = { id: String(admin._id) };
  token = (await loginAdmin(admin.email, password, config)).token;
  operator = await createOperator({
    email: "operator@phase6.test",
    password,
    name: "Test operator",
  });
  operatorToken = (
    await loginAdmin(operator.email, password, config, ["OPERATOR"])
  ).token;
  const other = await createOperator({
    email: "other@phase6.test",
    password,
    name: "Unrelated operator",
  });
  otherToken = (await loginAdmin(other.email, password, config, ["OPERATOR"]))
    .token;
  app = createApp(config);
  await seedOperations(config, actor);
  hero = (await call("get", "allocation-context").expect(200)).body.data
    .rankings[0].eventId;
  tanker = await Tanker.findOne({ identifier: "DEMO-T01" });
});
after(async () => {
  if (mongoose.connection.name === databaseName)
    await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});
test("operations reject anonymous users, operators and client authority fields", async () => {
  await request(app).get("/api/operations/tankers").expect(401);
  await call("get", "tankers", undefined, operatorToken).expect(403);
  await recommend({ priority: 100 }).expect(422);
  await recommend({ createdBy: actor.id }).expect(422);
  await request(app)
    .get("/api/operator/assignments")
    .set("Authorization", `Bearer ${token}`)
    .expect(403);
  await call("post", "operators", {
    email: "bad@x.test",
    name: "Bad",
    password: "short",
    role: "ADMIN",
  }).expect(422);
});
test("no eligible tanker returns a clear blocked result; fleet updates use revisions", async () => {
  const blocked = await recommend().expect(200);
  assert.equal(blocked.body.data.blocked, true);
  assert.equal(await Allocation.countDocuments(), 0);
  const payload = {
    identifier: tanker.identifier,
    name: tanker.name,
    capacityLitres: tanker.capacityLitres,
    availableLitres: 8000,
    status: "AVAILABLE",
    operatorId: String(operator._id),
    currentLocation: null,
    observedAt: new Date().toISOString(),
  };
  const result = await call("patch", `tankers/${tanker.id}`, {
    revision: tanker.revision,
    tanker: payload,
  }).expect(200);
  tanker = await Tanker.findById(tanker.id);
  assert.equal(result.body.data.tanker.operatorId, String(operator._id));
  await call("patch", `tankers/${tanker.id}`, {
    revision: tanker.revision - 1,
    tanker: payload,
  }).expect(409);
});
test("recommendations are idempotent, active shortage uniqueness is atomic, and unapproved assignment is blocked", async () => {
  const key = randomUUID();
  const first = await recommend({ requestId: key }).expect(200);
  const id = first.body.data.allocation.id;
  assert.equal(
    first.body.data.allocation.ai.execution.mode,
    "DETERMINISTIC_ONLY",
  );
  assert.equal(
    (await recommend({ requestId: key }).expect(200)).body.data.allocation.id,
    id,
  );
  const duplicates = await Promise.all([recommend(), recommend()]);
  assert.ok(duplicates.every((r) => r.status === 409));
  await call("post", `allocations/${id}/assign`, {}).expect(409);
  await call("post", `allocations/${id}/reject`, {
    reason: "Need a fresh municipal assessment",
  }).expect(200);
  assert.equal((await Allocation.findById(id)).active, false);
  await call("post", `allocations/${id}/approve`, {}).expect(409);
});
test("AI modes preserve contracts and provider failures produce labeled deterministic recommendations", async () => {
  for (const failure of [
    new ApiError(504, "AI_TIMEOUT", "timeout"),
    new Error("SECRET"),
    null,
  ]) {
    const target =
      failure === null
        ? app
        : createApp(
            {
              ...config,
              DEMO_AI_MODE: false,
              AI_PROVIDER: "gemini",
              GEMINI_API_KEY: "test-placeholder",
              GEMINI_MODEL_ID: "test-model",
            },
            {
              aiDependencies: {
                invoke: async () => {
                  throw failure;
                },
              },
            },
          );
    const { body } = await recommend({ useAi: true }, target).expect(200);
    const allocation = body.data.allocation;
    assert.equal(
      allocation.ai.execution.mode,
      failure ? "DETERMINISTIC_ONLY" : "DEMO_SIMULATION",
    );
    assert.equal(JSON.stringify(allocation).includes("SECRET"), false);
    await call("post", `allocations/${allocation.id}/reject`, {
      reason: "Testing alternate recommendation",
    }).expect(200);
  }
  const malformed = createApp(
    {
      ...config,
      DEMO_AI_MODE: false,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-placeholder",
      GEMINI_MODEL_ID: "test-model",
    },
    { aiDependencies: { invoke: async () => ({ fake: true }) } },
  );
  const bad = (await recommend({ useAi: true }, malformed).expect(200)).body
    .data.allocation;
  assert.equal(bad.ai.failureCode, "AI_INVALID_OUTPUT");
  await call("post", `allocations/${bad.id}/reject`, {
    reason: "Malformed agent output reviewed",
  }).expect(200);
});
test("availability and fairness changes invalidate approval and assignment", async () => {
  const allocation = (await recommend().expect(200)).body.data.allocation;
  await Tanker.updateOne(
    { _id: tanker.id },
    { $set: { status: "UNAVAILABLE" }, $inc: { revision: 1 } },
  );
  await call("post", `allocations/${allocation.id}/approve`, {}).expect(409);
  await Tanker.updateOne(
    { _id: tanker.id },
    { $set: { status: "AVAILABLE" }, $inc: { revision: 1 } },
  );
  await call("post", `allocations/${allocation.id}/approve`, {}).expect(200);
  await AllocationEvidence.updateOne(
    { eventId: hero },
    { $set: { recentDeliveredLitres: 10000 } },
  );
  const adjustedApp = createApp({ ...config, AI_FAIRNESS_MAX_ADJUSTMENT: 30 });
  const context = (
    await call(
      "get",
      "allocation-context",
      undefined,
      token,
      adjustedApp,
    ).expect(200)
  ).body.data;
  assert.notEqual(context.rankings[0].eventId, hero);
  await call(
    "post",
    `allocations/${allocation.id}/assign`,
    {},
    token,
    adjustedApp,
  ).expect(409);
  await AllocationEvidence.updateOne(
    { eventId: hero },
    { $set: { recentDeliveredLitres: 4000 } },
  );
  await call("post", `allocations/${allocation.id}/reject`, {
    reason: "Fairness changed during review",
  }).expect(200);
});
test("concurrent assignment retries produce one assignment and one tanker reservation", async () => {
  const a = (await recommend().expect(200)).body.data.allocation;
  await call("post", `allocations/${a.id}/approve`, {}).expect(200);
  const results = await Promise.all([
    call("post", `allocations/${a.id}/assign`, {}),
    call("post", `allocations/${a.id}/assign`, {}),
  ]);
  assert.ok(results.some((r) => r.status === 200));
  assert.ok(results.every((r) => [200, 409].includes(r.status)));
  const assigned = await Allocation.findById(a.id);
  assert.equal(assigned.status, "ASSIGNED");
  assert.equal(
    assigned.audit.filter((e) => e.action === "TANKER_ASSIGNED").length,
    1,
  );
  assert.equal(
    String((await Tanker.findById(tanker.id)).activeAllocationId),
    a.id,
  );
  const context = (await call("get", "allocation-context").expect(200)).body
    .data;
  assert.equal(
    context.candidates.some((t) => t.id === tanker.id),
    false,
  );
  await call("post", `allocations/${a.id}/reject`, {
    reason: "Too late to reject assignment",
  }).expect(409);
});
test("operators see only their own assigned records and disabled accounts lose access", async () => {
  const get = (as) =>
    request(app)
      .get("/api/operator/assignments")
      .set("Authorization", `Bearer ${as}`);
  const own = (await get(operatorToken).expect(200)).body.data;
  assert.equal(own.assignments.length, 1);
  assert.equal(
    (await get(otherToken).expect(200)).body.data.assignments.length,
    0,
  );
  assert.equal(JSON.stringify(own).includes("reporterKeyHash"), false);
  await get(otherToken).query({ operatorId: operator.id }).expect(422);
  await request(app)
    .get(`/api/operator/assignments/${own.assignments[0].id}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .expect(404);
  await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${otherToken}`)
    .expect(200);
  await User.updateOne({ _id: operator._id }, { $set: { disabled: true } });
  await get(operatorToken).expect(401);
  await User.updateOne({ _id: operator._id }, { $set: { disabled: false } });
});
test("demo reset is repeatable, refuses production and preserves live records", async () => {
  const live = await Tanker.create({
    identifier: "LIVE-KEEP",
    name: "Real record",
    capacityLitres: 1000,
    isDemo: false,
  });
  await call("post", "demo/reset", { confirm: "RESET_DEMO_OPERATIONS" }).expect(
    200,
  );
  await call("post", "demo/reset", { confirm: "RESET_DEMO_OPERATIONS" }).expect(
    200,
  );
  assert.equal(
    await Tanker.countDocuments({
      seedOwner: "aquashield-phase6",
      isDemo: true,
    }),
    3,
  );
  assert.ok(await Tanker.findById(live._id));
  assert.equal(await Allocation.countDocuments({ isDemo: true }), 0);
  await call(
    "post",
    "demo/reset",
    { confirm: "RESET_DEMO_OPERATIONS" },
    token,
    createApp({ ...config, NODE_ENV: "production" }),
  ).expect(403);
});

test("changed approved water quantities are blocked; recommendation and approval evidence are retained", async () => {
  const a = (await recommend().expect(200)).body.data.allocation;
  await call("post", `allocations/${a.id}/approve`, {}).expect(200);
  await Tanker.updateOne(
    { _id: tanker._id },
    { $set: { availableLitres: 7000 }, $inc: { revision: 1 } },
  );
  await call("post", `allocations/${a.id}/assign`, {}).expect(409);
  const saved = await Allocation.findById(a.id);
  assert.equal(saved.recommendationEvidence.proposedLitres, 8000);
  assert.equal(saved.approvalEvidence.proposedLitres, 8000);
  assert.equal(saved.status, "APPROVED");
  await call("post", `allocations/${a.id}/reject`, {
    reason: "Approved water quantity changed",
  }).expect(200);
  await Tanker.updateOne(
    { _id: tanker._id },
    { $set: { availableLitres: 8000 }, $inc: { revision: 1 } },
  );
});

test("different allocation intents cannot double-reserve one tanker, and a reserved intent resumes safely", async () => {
  const a = (await recommend().expect(200)).body.data.allocation;
  await call("post", `allocations/${a.id}/approve`, {}).expect(200);
  // Persist an older approval for another event, as could exist before priority changes.
  const secondEvent = a.evidence.rankings[1].eventId;
  const b = await Allocation.create({
    eventId: secondEvent,
    tankerId: a.tankerId,
    status: "APPROVED",
    isDemo: true,
    requestId: randomUUID(),
    createdBy: actor.id,
    evidence: a.evidence,
    approvalEvidence: a.evidence,
  });
  const results = await Promise.all([
    call("post", `allocations/${a.id}/assign`, {}),
    call("post", `allocations/${b.id}/assign`, {}),
  ]);
  assert.ok(results.some((r) => r.status === 200));
  assert.ok(results.some((r) => r.status === 409));
  assert.equal(
    await Allocation.countDocuments({
      tankerId: a.tankerId,
      status: "ASSIGNED",
    }),
    1,
  );
  const reserved = await Tanker.findById(a.tankerId);
  const winner = await Allocation.findById(reserved.activeAllocationId);
  // Simulate interruption after reservation but before finalizing the assignment.
  await Allocation.updateOne(
    { _id: winner._id },
    {
      $set: { status: "ASSIGNING" },
      $pull: { audit: { action: "TANKER_ASSIGNED" } },
    },
  );
  await call("post", `allocations/${winner.id}/assign`, {}).expect(200);
  assert.equal(
    (await Tanker.findById(a.tankerId)).activeAllocationId.toString(),
    winner.id,
  );
  assert.equal(
    (await Allocation.findById(winner.id)).audit.filter(
      (e) => e.action === "TANKER_ASSIGNED",
    ).length,
    1,
  );
});

for (const reserved of [false, true]) {
  test(`F4 recovery after crash ${reserved ? "after" : "before"} reservation revalidates and is replayable`, async () => {
    const a = await recoveryFixture();
    if (reserved)
      await Tanker.updateOne(
        { _id: tanker._id },
        { $set: { status: "ASSIGNED", activeAllocationId: a.id } },
      );
    await call("post", `allocations/${a.id}/assign`, {}).expect(200);
    await call("post", `allocations/${a.id}/assign`, {}).expect(200);
    assert.equal(
      (await Allocation.findById(a.id)).audit.filter(
        (e) => e.action === "TANKER_ASSIGNED",
      ).length,
      1,
    );
  });
  for (const invalidation of ["operator", "event", "reject"])
    test(`F4 ${invalidation} safely reconciles ${reserved ? "reserved" : "unreserved"} intent`, async () => {
      const a = await recoveryFixture();
      if (reserved)
        await Tanker.updateOne(
          { _id: tanker._id },
          { $set: { status: "ASSIGNED", activeAllocationId: a.id } },
        );
      if (invalidation === "operator")
        await User.updateOne(
          { _id: operator._id },
          { $set: { disabled: true } },
        );
      if (invalidation === "event")
        await ShortageEvent.updateOne(
          { _id: hero },
          { $set: { status: "HISTORICAL" } },
        );
      if (invalidation === "reject")
        await call("post", `allocations/${a.id}/reject`, {
          reason: "Withdraw interrupted intent",
        }).expect(200);
      else await call("post", `allocations/${a.id}/assign`, {}).expect(409);
      const saved = await Allocation.findById(a.id);
      assert.equal(saved.status, "REJECTED");
      assert.equal(saved.active, false);
      assert.ok(saved.audit.some((e) => e.action === "ALLOCATION_RECONCILED"));
      assert.equal((await Tanker.findById(tanker.id)).activeAllocationId, null);
      await call("post", `allocations/${a.id}/reject`, {
        reason: "Repeated reconciliation",
      }).expect(200);
      await call("post", `allocations/${a.id}/assign`, {}).expect(409);
    });
}

test("F2 generic and operations allocation advice share fairness, assignment and reservation evidence", async () => {
  await seedOperations(config, actor, { reset: true });
  await User.updateOne({ _id: operator._id }, { $set: { disabled: false } });
  app = createApp({ ...config, AI_FAIRNESS_MAX_ADJUSTMENT: 30 });
  await AllocationEvidence.updateOne(
    { eventId: hero },
    { $set: { recentDeliveredLitres: 10000 } },
  );
  const context = (await call("get", "allocation-context").expect(200)).body
    .data;
  const aiCall = () =>
    request(app)
      .post("/api/ai/allocate")
      .set("Authorization", `Bearer ${token}`)
      .send({ demo: true });
  const advice = (await aiCall().expect(200)).body.data;
  assert.equal(
    advice.facts.zones.find((z) => z.ref === advice.facts.priorityRef).eventId,
    context.rankings[0].eventId,
  );
  assert.notEqual(context.rankings[0].eventId, hero);
  const rec = (
    await recommend({
      eventId: context.rankings[0].eventId,
      useAi: true,
    }).expect(200)
  ).body.data.allocation;
  assert.equal(rec.ai.facts.priorityRef, advice.facts.priorityRef);
  assert.deepEqual(rec.ai.facts.zones, advice.facts.zones);
  await call("post", `allocations/${rec.id}/approve`, {}).expect(200);
  await call("post", `allocations/${rec.id}/assign`, {}).expect(200);
  const next = (await aiCall().expect(200)).body.data.facts;
  assert.equal(
    next.zones.some((z) => z.eventId === rec.eventId),
    false,
  );
  assert.equal(
    next.fleet.some((t) => t.id === rec.tankerId),
    false,
  );
  assert.ok(next.allocationContext.excludedFleet.length);
});

test("F7 dashboard eligibility and timestamp metadata match the operations engine", async () => {
  await seedOperations(config, actor, { reset: true });
  app = createApp(config);
  await User.updateOne({ _id: operator._id }, { $set: { disabled: false } });
  for (const patch of [
    {
      observedAt: new Date(),
      availableLitres: 8000,
      status: "AVAILABLE",
      activeAllocationId: null,
    },
    { observedAt: new Date(Date.now() - 86400000) },
    { observedAt: null },
    { observedAt: new Date(), availableLitres: null },
    {
      availableLitres: 8000,
      activeAllocationId: new mongoose.Types.ObjectId(),
    },
    { activeAllocationId: null, status: "UNAVAILABLE" },
  ]) {
    await Tanker.updateOne({ _id: tanker._id }, { $set: patch });
    const context = (await call("get", "tankers").expect(200)).body.data;
    const get = (path) =>
      request(app)
        .get(`/api/dashboard/${path}?demo=true`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    const summary = (await get("summary")).body.data;
    assert.equal(
      summary.metrics.availableTankers.value,
      context.tankers.filter((t) => t.eligibility.eligible).length,
    );
    assert.equal(
      summary.recordedAvailableTankers,
      context.tankers.filter((t) => t.status === "AVAILABLE").length,
    );
    const map = (await get("map")).body.data;
    const mapped = map.tankers.find((t) => t.id === tanker.id);
    assert.ok(
      ["UNKNOWN", "STALE", "RECENT"].includes(mapped.observationStatus),
    );
    assert.deepEqual(
      mapped.eligibility,
      context.tankers.find((t) => t.id === tanker.id).eligibility,
    );
  }
  await Tanker.updateOne(
    { _id: tanker._id },
    { $set: { status: "AVAILABLE", observedAt: new Date() } },
  );
  await User.updateOne({ _id: operator._id }, { $set: { disabled: true } });
  const response = await request(app)
    .get("/api/dashboard/summary?demo=true")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(response.body.data.metrics.availableTankers.value, 0);
});

test("F4 competing rejection/assignment converges without releasing another intent's reservation", async () => {
  const a = await recoveryFixture();
  const otherReservation = new mongoose.Types.ObjectId();
  await Tanker.updateOne(
    { _id: tanker._id },
    { $set: { status: "ASSIGNED", activeAllocationId: otherReservation } },
  );
  await call("post", `allocations/${a.id}/reject`, {
    reason: "Withdraw obsolete intent",
  }).expect(200);
  assert.equal(
    String((await Tanker.findById(tanker.id)).activeAllocationId),
    String(otherReservation),
  );
  // This synthetic reservation belongs only to this verified test database.
  await Tanker.updateOne(
    { _id: tanker._id, activeAllocationId: otherReservation },
    { $set: { status: "AVAILABLE", activeAllocationId: null } },
  );
  const b = await recoveryFixture();
  const results = await Promise.all([
    call("post", `allocations/${b.id}/assign`, {}),
    call("post", `allocations/${b.id}/reject`, {
      reason: "Concurrent administrator withdrawal",
    }),
  ]);
  assert.ok(results.every((r) => [200, 409].includes(r.status)));
  const final = await Allocation.findById(b.id);
  const fleet = await Tanker.findById(tanker.id);
  assert.ok(["ASSIGNED", "REJECTED"].includes(final.status));
  assert.equal(
    String(fleet.activeAllocationId),
    final.status === "ASSIGNED" ? b.id : "null",
  );
});

test("F4 interrupted cancellation holds uniqueness until its conditional release can be retried", async () => {
  const a = await recoveryFixture();
  await Tanker.updateOne(
    { _id: tanker._id },
    { $set: { status: "ASSIGNED", activeAllocationId: a.id } },
  );
  const original = Tanker.updateOne;
  Tanker.updateOne = () => {
    throw new Error("Simulated local write interruption");
  };
  try {
    await call("post", `allocations/${a.id}/reject`, {
      reason: "Withdraw interrupted assignment",
    }).expect(500);
  } finally {
    Tanker.updateOne = original;
  }
  const pending = await Allocation.findById(a.id);
  assert.equal(pending.status, "RECONCILING");
  assert.equal(pending.active, true);
  await call("post", `allocations/${a.id}/reject`, {
    reason: "Resume interrupted cancellation",
  }).expect(200);
  assert.equal((await Allocation.findById(a.id)).active, false);
  assert.equal((await Tanker.findById(tanker.id)).activeAllocationId, null);
});
