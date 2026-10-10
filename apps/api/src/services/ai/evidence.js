import { createHash } from "node:crypto";
import { listShortages } from "../shortageService.js";
import { operations, dashboardAnalytics } from "../dashboardService.js";
import {
  calculatePreviousDeliveryPenalty,
  calculateAllocationPriority,
} from "../fairnessEngine.js";
import { ApiError } from "../../middleware/errors.js";

// Allowlist only aggregate facts. Never send descriptions, household locations,
// photos, reporter/session keys or raw database documents to a provider.
export function buildEvidence(
  events,
  ops,
  config,
  { eventId, demo = false } = {},
  reportsByHour = [],
) {
  const relevant = events.filter(
    (e) => e.status !== "HISTORICAL" && e.status !== "SUPERSEDED",
  );
  if (relevant.length > 30)
    throw new ApiError(
      503,
      "AI_EVIDENCE_LIMIT",
      "Too many current zones for this assessment. A paginated assessment is required.",
    );
  if (!relevant.length)
    throw new ApiError(
      422,
      "AI_NO_EVIDENCE",
      "No current shortage evidence is available for assessment.",
    );
  if (eventId && !relevant.some((e) => e.id === eventId))
    throw new ApiError(
      404,
      "SHORTAGE_NOT_FOUND",
      "This current shortage event is not available.",
    );
  const zones = relevant
    .map((e, index) => {
      const deliveries =
        e.areaId && ops.deliveries != null
          ? ops.deliveries.filter((d) => d.areaId === e.areaId)
          : null;
      // No demand-per-person assumption is introduced in this phase.
      const clock = new Date(e.calculatedAt).getTime();
      const recentLitres =
        deliveries
          ?.filter(
            (d) =>
              d.deliveredAt.getTime() <= clock &&
              d.deliveredAt.getTime() >= clock - 86400000,
          )
          .reduce((sum, d) => sum + d.litresDelivered, 0) ?? null;
      const penalty = calculatePreviousDeliveryPenalty(recentLitres, null);
      return {
        ref: `zone_${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`,
        eventId: e.id,
        areaId: e.areaId,
        area: e.areaName,
        calculatedAt: e.calculatedAt,
        status: e.status,
        severity: e.severityScore,
        severityLevel: e.severityLevel,
        partialSeverity: e.severity?.complete === false,
        shortageConfidence: e.confidenceScore,
        estimatedPopulation: e.estimatedAffectedPopulation,
        durationHours: e.durationHours,
        reportCount: e.reportCount,
        verifiedReportCount: e.verifiedReportCount,
        eligibleReportCount: e.eligibleReportCount,
        excludedReports: e.duplicateReportCount + e.suspiciousReportCount,
        temperatureC: e.temperatureC,
        vulnerableRatio: e.vulnerableRatio,
        waterLevelScore: e.waterLevelScore,
        diameterKm: e.confidence?.diameterKm ?? null,
        timeSpanHours: e.confidence?.timeSpanHours ?? null,
        infrastructureCorrelated:
          e.confidence?.components?.find((c) => c.name === "infrastructure")
            ?.score === 100,
        previousDelivery: deliveries?.length
          ? deliveries
              .sort((a, b) => b.deliveredAt - a.deliveredAt)
              .map((d) => ({
                litres: d.litresDelivered,
                deliveredAt: d.deliveredAt,
              }))[0]
          : null,
        deliveryHistoryKnown: deliveries != null,
        fairnessPenalty: penalty,
        allocationPriority: calculateAllocationPriority(
          e.severityScore,
          penalty,
          config.AI_FAIRNESS_MAX_ADJUSTMENT,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.severity - a.severity ||
        (b.durationHours ?? -1) - (a.durationHours ?? -1) ||
        a.eventId.localeCompare(b.eventId),
    );
  const selected = zones.find((e) => e.eventId === eventId) || zones[0];
  const fleet =
    ops.tankers?.map((t) => ({
      id: String(t._id),
      status: t.status,
      capacityLitres: t.capacityLitres ?? null,
      location: t.currentLocation
        ? { lat: t.currentLocation.lat, lng: t.currentLocation.lng }
        : null,
    })) ?? null;
  const missingInputs = [
    "Verified demand volume for fairness normalization",
    "Routing/ETA service",
    "Deterministic risk model and historical supply/trend series",
  ];
  if (zones.some((z) => !z.deliveryHistoryKnown))
    missingInputs.push("Complete verified delivery history");
  if (fleet == null || !fleet.length)
    missingInputs.push("Available fleet records");
  if (zones.some((z) => z.temperatureC == null))
    missingInputs.push("Observed environmental data");
  const facts = {
    ruleVersion: "phase5-evidence-v1",
    dataIsDemo: demo,
    selectedRef: selected.ref,
    priorityRef: zones[0].ref,
    rankingMethod:
      "Severity descending; known duration descending; stable event ID. Fairness-adjusted priority is unknown without verified demand volume.",
    zones,
    fleet,
    route: null,
    risk: null,
    missingInputs,
    reportsByHour: reportsByHour.map((row) => ({
      hour: row.hour,
      count: row.count,
    })),
    trendLimitations:
      "Latest reporting-hour buckets include repeats and may have gaps; these counts are not a calibrated forecast.",
    limitations: [
      "Read-only recommendation; human review required.",
      "Emerging evidence is not a forecast.",
      "Approximate population may overlap between zones.",
      "Authorized assignment and recorded trips/deliveries exist; this read-only assessment cannot perform operational actions or establish household receipt.",
    ],
  };
  return {
    ...facts,
    evidenceVersion: createHash("sha256")
      .update(JSON.stringify(facts))
      .digest("hex"),
  };
}

export async function loadEvidence(config, input) {
  const [shortages, ops, analytics] = await Promise.all([
    listShortages(config, input.demo),
    operations(input.demo, config),
    dashboardAnalytics(config, input.demo),
  ]);
  return buildEvidence(
    shortages.events,
    ops,
    config,
    input,
    analytics.reportsByHour,
  );
}

export function modelEvidence(facts) {
  // References rather than user-supplied area names or database identifiers.
  return {
    ...facts,
    zones: facts.zones.map(({ eventId, area, areaId, ...safe }) => {
      void eventId;
      void area;
      void areaId;
      return safe;
    }),
    fleet:
      facts.fleet?.map(({ id, ...safe }, i) => {
        void id;
        return { ref: `fleet_${i}`, ...safe };
      }) ?? null,
  };
}
