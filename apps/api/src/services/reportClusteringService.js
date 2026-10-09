import { createHash } from "node:crypto";
import { detectionConfig } from "../config/detection.js";
import { distanceKm, median, round } from "./geography.js";
import { calculateEventConfidence } from "./confidenceEngine.js";
import { estimateAffectedPopulation } from "./populationEngine.js";
import {
  calculateSeverityScore,
  calculateWaterLevelScore,
} from "./severityEngine.js";

const time = (report) => new Date(report.createdAt).getTime();
const id = (report) => String(report._id);
export function calculateShortageDuration(reports, now) {
  const durations = reports.flatMap((r) => {
    const hours =
      r.lastSupplyTime != null
        ? (now.getTime() - new Date(r.lastSupplyTime).getTime()) / 3600000
        : r.reportedDurationHours != null
          ? r.reportedDurationHours +
            Math.max(0, (now.getTime() - time(r)) / 3600000)
          : null;
    return hours == null ? [] : [Math.max(0, hours)];
  });
  return durations.length ? round(median(durations)) : null;
}

export function detectDuplicatesAndSuspicious(
  reports,
  config = detectionConfig(),
) {
  const accepted = [],
    duplicates = [],
    suspicious = [];
  for (const r of [...reports].sort(
    (a, b) => time(a) - time(b) || id(a).localeCompare(id(b)),
  )) {
    const earlier = accepted.filter(
      (a) => a.reporterKeyHash === r.reporterKeyHash && a.isDemo === r.isDemo,
    );
    const duplicate = earlier.find(
      (a) =>
        (time(r) - time(a)) / 3600000 <= config.DUPLICATE_WINDOW_HOURS &&
        distanceKm(a.location, r.location) <= config.DUPLICATE_RADIUS_KM,
    );
    if (duplicate) {
      duplicates.push({
        reportId: id(r),
        duplicateOf: id(duplicate),
        reason:
          "Repeated reporter key near the same location within the duplicate window.",
      });
      continue;
    }
    let reason = null;
    if (
      r.lastSupplyTime &&
      r.reportedDurationHours != null &&
      Math.abs(
        (time(r) - new Date(r.lastSupplyTime).getTime()) / 3600000 -
          r.reportedDurationHours,
      ) > config.DURATION_CONFLICT_HOURS
    )
      reason =
        "Supply timestamp and reported duration conflict; review needed.";
    if (
      earlier.some((a) => {
        const hours = (time(r) - time(a)) / 3600000;
        return (
          hours <= config.DUPLICATE_WINDOW_HOURS &&
          distanceKm(a.location, r.location) > config.CLUSTER_RADIUS_KM &&
          distanceKm(a.location, r.location) / Math.max(hours, 1 / 60) >
            config.SUSPICIOUS_SPEED_KMH
        );
      })
    )
      reason =
        "Same reporter key moved an implausible distance; review needed.";
    if (reason) {
      suspicious.push({ reportId: id(r), reason });
      continue;
    }
    accepted.push(r);
  }
  return { accepted, duplicates, suspicious };
}

export function clusterReports(reports, config = detectionConfig()) {
  const clusters = [];
  // Complete-link grouping prevents a long chain bridging separate places or days.
  for (const r of [...reports].sort(
    (a, b) => time(a) - time(b) || id(a).localeCompare(id(b)),
  )) {
    const cluster = clusters.find((group) =>
      group.every(
        (a) =>
          Boolean(a.isDemo) === Boolean(r.isDemo) &&
          Math.abs(time(a) - time(r)) <=
            config.CLUSTER_TIME_WINDOW_HOURS * 3600000 &&
          distanceKm(a.location, r.location) <= config.CLUSTER_RADIUS_KM,
      ),
    );
    if (cluster) cluster.push(r);
    else clusters.push([r]);
  }
  return clusters;
}

export function buildShortageEvents(
  reports,
  areas = [],
  config = detectionConfig(),
  now = new Date(),
) {
  const handling = detectDuplicatesAndSuspicious(reports, config);
  const clusters = clusterReports(handling.accepted, config);
  // Assign review evidence once even when separate clusters overlap in space/time.
  const suspiciousCluster = new Map(
    handling.suspicious.map((entry) => {
      const report = reports.find((r) => id(r) === entry.reportId);
      const index = clusters.findIndex((group) =>
        group.some(
          (member) =>
            Boolean(member.isDemo) === Boolean(report.isDemo) &&
            distanceKm(member.location, report.location) <=
              config.CLUSTER_RADIUS_KM &&
            Math.abs(time(member) - time(report)) <=
              config.CLUSTER_TIME_WINDOW_HOURS * 3600000,
        ),
      );
      return [entry.reportId, index];
    }),
  );
  const demoTimes = reports.filter((r) => r.isDemo).map(time);
  // Fixed demo observation clock keeps seed outputs reproducible on any date.
  const demoNow = demoTimes.length ? new Date(Math.max(...demoTimes)) : now;
  return clusters.map((members, clusterIndex) => {
    const isDemo = Boolean(members[0].isDemo);
    const clock = isDemo ? demoNow : now;
    const excludedDuplicateIds = handling.duplicates
      .filter((d) => members.some((r) => id(r) === d.duplicateOf))
      .map((d) => d.reportId);
    const suspiciousIds = handling.suspicious
      .filter((s) => suspiciousCluster.get(s.reportId) === clusterIndex)
      .map((s) => s.reportId);
    const contributors = members.filter(
      (r, index) =>
        members.findIndex((a) => a.reporterKeyHash === r.reporterKeyHash) ===
        index,
    );
    const repeatedMemberIds = members
      .filter((r) => !contributors.includes(r))
      .map(id);
    const center = {
      lat:
        contributors.reduce((sum, r) => sum + r.location.lat, 0) /
        contributors.length,
      lng:
        contributors.reduce((sum, r) => sum + r.location.lng, 0) /
        contributors.length,
    };
    // Citizen-selected area IDs are not evidence of environmental conditions.
    // Only matched demo area records supply simulated context in this phase.
    const area = areas
      .filter((a) => Boolean(a.isDemo) === isDemo)
      .find((a) => distanceKm(a.center, center) <= config.CLUSTER_RADIUS_KM);
    const incident = area?.infrastructureIncident;
    const infrastructureCorrelated = Boolean(
      incident &&
      distanceKm(incident.location, center) <= config.CLUSTER_RADIUS_KM &&
      new Date(incident.startedAt) <= clock &&
      (!incident.endedAt || new Date(incident.endedAt) >= clock),
    );
    const confidence = calculateEventConfidence(
      contributors,
      { infrastructureCorrelated },
      config,
    );
    const population = estimateAffectedPopulation(contributors, area, config);
    const durationHours = calculateShortageDuration(contributors, clock);
    const waterScores = contributors
      .map((r) => calculateWaterLevelScore(r.waterLevel))
      .filter((v) => v != null);
    const waterLevelScore = median(waterScores);
    const temperatureC = area?.temperatureC ?? null;
    const vulnerableRatio =
      area?.populationEstimate && area?.vulnerablePopulationEstimate != null
        ? area.vulnerablePopulationEstimate / area.populationEstimate
        : null;
    const severity = calculateSeverityScore(
      {
        durationHours,
        estimatedAffectedPopulation: population.estimate,
        waterLevelScore,
        temperatureC,
        vulnerableRatio,
        confidenceScore: confidence.score,
      },
      config,
    );
    const latest = new Date(Math.max(...members.map(time)));
    const status =
      clock.getTime() - latest.getTime() > config.CLUSTER_ACTIVE_HOURS * 3600000
        ? "HISTORICAL"
        : contributors.length < config.CLUSTER_MIN_REPORTS ||
            confidence.score < config.CONFIDENCE_CONFIRMED_THRESHOLD
          ? "EMERGING"
          : "ACTIVE";
    const verifiedReportCount = contributors.filter(
      (r) => r.verificationStatus === "VERIFIED",
    ).length;
    return {
      eventKey: createHash("sha256")
        .update(`${isDemo}:${id(members[0])}`)
        .digest("hex"),
      isDemo,
      areaId: area?._id ?? members[0].areaId ?? null,
      areaName: area?.name ?? members[0].locality,
      center,
      reportIds: members.map(id),
      duplicateReportIds: [...excludedDuplicateIds, ...repeatedMemberIds],
      suspiciousReportIds: suspiciousIds,
      reportCount:
        members.length + excludedDuplicateIds.length + suspiciousIds.length,
      eligibleReportCount: contributors.length,
      verifiedReportCount,
      duplicateReportCount:
        excludedDuplicateIds.length + members.length - contributors.length,
      suspiciousReportCount: suspiciousIds.length,
      confidenceScore: confidence.score,
      confidence,
      estimatedAffectedPopulation: population.estimate,
      population,
      durationHours,
      temperatureC,
      vulnerableRatio,
      waterLevelScore,
      severityScore: severity.score,
      severityLevel: severity.level,
      severity,
      status,
      firstReportAt: new Date(Math.min(...members.map(time))),
      lastReportAt: latest,
      calculatedAt: clock,
      evidence: [
        `${contributors.length} independent reporter keys (citizen accounts or legacy browser keys); these are not verified identities.`,
        `${verifiedReportCount} explicitly verified reports${isDemo ? " (simulated verification)" : ""}.`,
        `Geographic diameter approximately ${confidence.diameterKm} km; report span ${confidence.timeSpanHours} hours.`,
        `${excludedDuplicateIds.length + members.length - contributors.length} repeats and ${suspiciousIds.length} suspicious reports excluded from scores.`,
        infrastructureCorrelated
          ? `Correlated ${isDemo ? "simulated " : ""}infrastructure incident: ${incident.description}`
          : "No correlated infrastructure incident is available.",
        "Confidence measures evidence that a shortage exists, not water remaining.",
      ],
    };
  });
}
