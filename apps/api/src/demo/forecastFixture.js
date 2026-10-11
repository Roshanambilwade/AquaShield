import { assertSeedTarget } from "../config/demonstration.js";
import { ApiError } from "../middleware/errors.js";
import ForecastObservation from "../models/ForecastObservation.js";
import { predictionAreas } from "../services/predictionService.js";
import {
  observationEnd,
  fingerprint,
  predictReportActivity,
} from "../services/predictionEngine.js";
import { predictionConfig } from "../config/prediction.js";

export function assertForecastSource(config, connected = true) {
  if (config.FORECAST_DEMO_ENABLED !== true)
    throw new ApiError(
      403,
      "DEMO_DISABLED",
      "Synthetic forecast history is not explicitly enabled.",
    );
  assertSeedTarget({ ...config, DEMO_SEED_ENABLED: true }, connected);
}
export function buildForecastFixture(areas, config, now = new Date()) {
  const c = predictionConfig(config),
    width = c.PREDICTION_WINDOW_HOURS * 3600000;
  const end = observationEnd(now, c),
    start = +end - c.PREDICTION_HISTORY_WINDOWS * width;
  const batch = `forecast-v1-${end.toISOString()}`;
  // Different activity histories, never desired final scores or classes.
  return areas.flatMap((area, index) => {
    const baseline = Math.max(
      2,
      Math.ceil(
        Math.max(c.PREDICTION_MIN_REPORTS, c.PREDICTION_MIN_REPORTERS) /
          c.PREDICTION_HISTORY_WINDOWS,
      ),
    );
    return Array.from({ length: c.PREDICTION_HISTORY_WINDOWS }, (_, window) => {
      const recent = window >= c.PREDICTION_HISTORY_WINDOWS - 4;
      const count =
        baseline +
        (recent
          ? [4, 2, 0, 1, 3, 0][index % 6]
          : index === 5 && window % 3 === 0
            ? 2
            : 0);
      return Array.from({ length: count }, (_, i) => ({
        key: fingerprint([batch, area.id, window, i]),
        batch,
        scenarioEnd: end,
        areaId: area.id,
        observedAt: new Date(
          start + window * width + ((i + 1) * width) / (count + 1),
        ),
        reporterKey: fingerprint(["synthetic-only", area.id, window, i]),
        location: area.center,
        provenance: "SYNTHETIC_FORECAST_OBSERVATION",
      }));
    }).flat();
  });
}
export async function prepareForecastFixture(config, now = new Date()) {
  assertSeedTarget(config, true);
  assertForecastSource(config);
  const areas = await predictionAreas(true);
  if (areas.length !== 6)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Forecast demonstration requires the six configured service areas.",
    );
  const rows = buildForecastFixture(areas, config, now);
  if (rows.length > 5000)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Fixture exceeds the existing history bound.",
    );
  const evidence = rows.map(observationReport);
  if (
    areas.some(
      (a) =>
        !predictReportActivity(evidence, {
          areaId: a.id,
          isDemo: true,
          now,
          source: config,
        }).forecast,
    )
  )
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Fixture does not satisfy the unchanged current quality settings; no records were written.",
    );
  const existing = await ForecastObservation.find({ batch: rows[0].batch })
    .limit(5001)
    .maxTimeMS(5000)
    .lean();
  const expected = new Map(rows.map((row) => [row.key, row]));
  if (
    existing.some((row) => {
      const original = expected.get(row.key);
      return (
        !original ||
        row.areaId !== original.areaId ||
        +row.observedAt !== +original.observedAt ||
        row.reporterKey !== original.reporterKey ||
        row.location.lat !== original.location.lat ||
        row.location.lng !== original.location.lng
      );
    })
  )
    throw new ApiError(
      409,
      "OPERATION_CONFLICT",
      "This completed-window fixture was prepared with different settings. Preserve its original settings or prepare after the next completed window; no records were written.",
    );
  await ForecastObservation.createIndexes();
  let inserted = 0;
  for (const row of rows) {
    try {
      const result = await ForecastObservation.updateOne(
        { key: row.key },
        { $setOnInsert: { ...row, createdAt: now, updatedAt: now } },
        { upsert: true, runValidators: true, timestamps: false },
      );
      inserted += result.upsertedCount;
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  return {
    batch: rows[0]?.batch,
    inserted,
    counts: areas.map((a) => ({
      areaId: a.id,
      observations: rows.filter((r) => r.areaId === a.id).length,
    })),
    provenance: "SYNTHETIC_FORECAST_OBSERVATION",
  };
}
export async function forecastHistory(config, now) {
  assertForecastSource(config);
  const latest = await ForecastObservation.findOne({
    scenarioEnd: { $lte: observationEnd(now, config) },
  })
    .sort({ scenarioEnd: -1, _id: -1 })
    .maxTimeMS(5000)
    .lean();
  if (!latest) return { reports: [], truncated: false };
  const rows = await ForecastObservation.find({ batch: latest.batch })
    .sort({ observedAt: 1, _id: 1 })
    .limit(5001)
    .maxTimeMS(5000)
    .lean();
  return {
    reports: rows.slice(0, 5000).map(observationReport),
    truncated: rows.length > 5000,
  };
}
function observationReport(r) {
  return {
    _id: r.key,
    areaId: r.areaId,
    createdAt: r.observedAt,
    updatedAt: r.observedAt,
    reporterKeyHash: r.reporterKey,
    location: r.location,
    verificationStatus: "PENDING",
    isDemo: true,
    lastSupplyTime: null,
    reportedDurationHours: null,
  };
}
