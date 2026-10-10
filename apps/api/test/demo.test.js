import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demonstrationSchema,
  assertSeedTarget,
  datasetDemo,
} from "../src/config/demonstration.js";
import {
  accountDefinitions,
  scenarioAreas,
  scenarioReports,
  seedRequestId,
} from "../src/demo/scenario.js";
import { reportInputSchema, validate } from "../src/validation/report.js";
test("demonstration requires explicit flags, safe database name and non-production mode", () => {
  const config = {
    NODE_ENV: "development",
    ...demonstrationSchema.parse({
      DEMONSTRATION_MODE: "true",
      DEMO_SEED_ENABLED: "true",
    }),
  };
  assert.doesNotThrow(() => assertSeedTarget(config));
  for (const overrides of [
    { NODE_ENV: "production" },
    { DEMONSTRATION_MODE: false },
    { DEMO_SEED_ENABLED: false },
    { DEMO_DATABASE_NAME: "production" },
    { MONGODB_TEST_DB_NAME: "production" },
  ])
    assert.throws(() => assertSeedTarget({ ...config, ...overrides }));
  assert.throws(() => assertSeedTarget(config, true));
  assert.equal(datasetDemo(config, false), true);
  assert.equal(datasetDemo({ DEMONSTRATION_MODE: false }, false), false);
});
test("stable scenario contains six areas, 48 valid owned reports and dedicated role accounts", () => {
  const anchor = new Date();
  const citizens = accountDefinitions
    .filter((a) => a.role === "CITIZEN")
    .map((a, i) => ({ id: String(i + 1).padStart(24, "0") }));
  const reports = scenarioReports(anchor, citizens);
  assert.equal(accountDefinitions.length, 26);
  assert.equal(scenarioAreas(anchor).length, 6);
  assert.equal(reports.length, 48);
  assert.equal(new Set(reports.map((r) => r._id)).size, 48);
  assert.deepEqual(reports, scenarioReports(anchor, citizens));
  assert.ok(reports.some((r) => r.verificationStatus === "PENDING"));
  assert.ok(reports.some((r) => r.waterLevel === "UNKNOWN"));
  // Activity differs across areas; this is observed scenario history, not a
  // numerical forecast or evidence of a future shortage.
  const activity = (areaId, minHours, maxHours) =>
    reports.filter(
      (r) =>
        r.areaId === areaId &&
        +anchor - +r.createdAt >= minHours * 3600000 &&
        +anchor - +r.createdAt < maxHours * 3600000,
    ).length;
  assert.ok(activity("AREA_01", 0, 1) > activity("AREA_01", 1, 2));
  assert.ok(activity("AREA_03", 0, 1) < activity("AREA_03", 1, 2));
  for (const r of reports) {
    const {
      _id,
      seedKey,
      ownerId,
      createdAt,
      updatedAt,
      verificationStatus,
      verificationSource,
      sourceType,
      isDemo,
      hasPhoto,
      ...input
    } = r;
    void [
      _id,
      seedKey,
      ownerId,
      createdAt,
      updatedAt,
      verificationStatus,
      verificationSource,
      sourceType,
      isDemo,
      hasPhoto,
    ];
    validate(reportInputSchema, {
      ...input,
      lastSupplyTime: input.lastSupplyTime?.toISOString() ?? null,
    });
  }
  assert.match(
    seedRequestId("scene"),
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/,
  );
});
