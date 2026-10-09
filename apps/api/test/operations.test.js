import test from "node:test";
import assert from "node:assert/strict";
import Tanker from "../src/models/Tanker.js";
import { parseEnv } from "../src/config/env.js";
import {
  tankerEligibility,
  rankAllocationEvents,
  selectCandidates,
} from "../src/services/allocationEngine.js";
import { tankerInput } from "../src/validation/operations.js";
const config = parseEnv({ NODE_ENV: "test" });
const now = new Date("2026-10-09T10:00:00Z");
const tanker = {
  _id: "t1",
  identifier: "T01",
  name: "Unit",
  status: "AVAILABLE",
  capacityLitres: 10000,
  availableLitres: 8000,
  operatorId: "operator",
  observedAt: now,
  currentLocation: null,
};
const events = [
  {
    id: "a",
    areaName: "A",
    status: "ACTIVE",
    severityScore: 90,
    durationHours: 24,
    estimatedAffectedPopulation: 600,
  },
  {
    id: "b",
    areaName: "B",
    status: "ACTIVE",
    severityScore: 85,
    durationHours: 20,
    estimatedAffectedPopulation: null,
  },
];
test("tanker model rejects invalid capacities, coordinates and invented status", async () => {
  for (const override of [
    { availableLitres: 11000 },
    { capacityLitres: 0 },
    { currentLocation: { lat: 91, lng: 0 } },
    { status: "DELIVERED" },
  ])
    await assert.rejects(
      new Tanker({
        ...tanker,
        _id: undefined,
        operatorId: null,
        isDemo: false,
        ...override,
      }).validate(),
    );
  assert.equal(
    tankerInput.safeParse({ ...tanker, role: "ADMIN" }).success,
    false,
  );
});
test("eligibility excludes stale, assigned, missing water and missing operator records", () => {
  assert.equal(tankerEligibility(tanker, config, now).eligible, true);
  for (const override of [
    { availableLitres: null },
    { availableLitres: 0 },
    { capacityLitres: undefined },
    { capacityLitres: 0 },
    { observedAt: "invalid" },
    { operatorId: null },
    { status: "UNAVAILABLE" },
    { activeAllocationId: "a" },
    { observedAt: new Date(now - 13 * 3600000) },
    { observedAt: new Date(+now + 1) },
  ])
    assert.equal(
      tankerEligibility({ ...tanker, ...override }, config, now).eligible,
      false,
    );
});
test("existing fairness penalty can promote an underserved area without inventing missing evidence", () => {
  const evidence = [
    {
      eventId: "a",
      demandLitres: 10000,
      recentDeliveredLitres: 10000,
      observedAt: now,
      source: "verified ledger",
    },
    {
      eventId: "b",
      demandLitres: 8000,
      recentDeliveredLitres: 0,
      observedAt: now,
    },
  ];
  const ranked = rankAllocationEvents(events, evidence, config, now);
  assert.equal(ranked[0].eventId, "b");
  assert.equal(ranked[1].priority, 75);
  assert.equal(ranked[0].estimatedPopulation, null);
  const missing = rankAllocationEvents(events, [], config, now);
  assert.equal(missing[0].priority, null);
  assert.equal(missing[0].recentDeliveredLitres, null);
  assert.equal(missing[0].orderingScore, 90);
  assert.equal(
    rankAllocationEvents(
      events,
      evidence,
      config,
      new Date(+now + 25 * 3600000),
    )[0].priority,
    null,
  );
});
test("candidate selection chooses smallest sufficient load or explicitly partial largest load", () => {
  const fleet = [
    tanker,
    { ...tanker, _id: "t2", identifier: "T02", availableLitres: 6000 },
  ];
  assert.equal(
    selectCandidates(fleet, { demandLitres: 5000 }, config, now).candidates[0]
      .id,
    "t2",
  );
  const partial = selectCandidates(fleet, { demandLitres: 10000 }, config, now);
  assert.equal(partial.candidates[0].id, "t1");
  assert.equal(partial.proposedLitres, 8000);
  assert.equal(
    selectCandidates(fleet, { demandLitres: null }, config, now).proposedLitres,
    null,
  );
  assert.equal(selectCandidates([], {}, config, now).candidates.length, 0);
});
