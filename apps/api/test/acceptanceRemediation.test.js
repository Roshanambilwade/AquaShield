import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildForecastFixture,
  assertForecastSource,
} from "../src/demo/forecastFixture.js";
import {
  predictReportActivity,
  observationEnd,
} from "../src/services/predictionEngine.js";
import { parseEnv } from "../src/config/env.js";
import {
  LOCALITY_CENTERS,
  DEMO_LOCALITY_CENTERS,
} from "../../../packages/shared/reportOptions.js";
const areas = [...LOCALITY_CENTERS, ...DEMO_LOCALITY_CENTERS].map((a) => ({
  id: a.id,
  center: { lat: a.lat, lng: a.lng },
}));
const now = new Date("2026-10-11T04:00:00Z");
const rows = buildForecastFixture(areas, {}, now);
const reports = rows.map((r) => ({
  _id: r.key,
  areaId: r.areaId,
  location: r.location,
  reporterKeyHash: r.reporterKey,
  createdAt: r.observedAt,
  updatedAt: r.observedAt,
  verificationStatus: "PENDING",
  isDemo: true,
}));
test("forecast fixture is deterministic, bounded, twelve complete UTC windows with diverse sources", () => {
  assert.equal(areas.length, 6);
  assert.deepEqual(rows, buildForecastFixture(areas, {}, now));
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  assert.ok(
    rows.every(
      (r) =>
        r.observedAt < observationEnd(now) &&
        r.provenance === "SYNTHETIC_FORECAST_OBSERVATION",
    ),
  );
  for (const a of areas) {
    const result = predictReportActivity(reports, {
      areaId: a.id,
      isDemo: true,
      now,
    });
    assert.ok(result.forecast);
    assert.equal(result.quality.coveredWindows, 12);
    assert.ok(result.quality.distinctReporters >= 6);
    assert.equal(result.quality.verifiedCount, 0);
  }
  assert.ok(
    new Set(
      areas.map(
        (a) =>
          predictReportActivity(reports, { areaId: a.id, isDemo: true, now })
            .riskLevel,
      ),
    ).size >= 3,
  );
});
test("missing and invalid synthetic observations still fail original quality gates", () => {
  const input = { areaId: areas[0].id, isDemo: true, now };
  assert.equal(
    predictReportActivity(reports.slice(0, 2), input).riskLevel,
    "INSUFFICIENT_DATA",
  );
  const invalid = reports.map((r) => ({
    ...r,
    location: { lat: 120, lng: 1 },
  }));
  assert.equal(predictReportActivity(invalid, input).forecast, null);
});
test("synthetic source requires explicit safe non-production demo configuration", () => {
  for (const config of [
    {},
    { FORECAST_DEMO_ENABLED: true },
    {
      FORECAST_DEMO_ENABLED: true,
      DEMONSTRATION_MODE: true,
      NODE_ENV: "production",
    },
    {
      FORECAST_DEMO_ENABLED: true,
      DEMONSTRATION_MODE: true,
      NODE_ENV: "development",
      DEMO_DATABASE_NAME: "aquashield",
    },
  ])
    assert.throws(() => assertForecastSource(config, false));
  assert.doesNotThrow(() =>
    assertForecastSource(
      {
        FORECAST_DEMO_ENABLED: true,
        DEMONSTRATION_MODE: true,
        NODE_ENV: "development",
        DEMO_DATABASE_NAME: "aquashield_demo",
      },
      false,
    ),
  );
});
test("production configuration refuses forecast demonstration flag", () => {
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: "production",
        FORECAST_DEMO_ENABLED: "true",
        MONGODB_URI:
          "mongodb://synthetic:synthetic@db.example/aquashield_live?tls=true",
        CORS_ORIGIN: "https://frontend.example",
      }),
    /FORECAST_DEMO_ENABLED/,
  );
});
