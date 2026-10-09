import { detectionConfig } from "../config/detection.js";
import { round } from "./geography.js";

export function estimateAffectedPopulation(
  reports,
  area,
  config = detectionConfig(),
) {
  // One contribution per reporter key. Never treat repeated reports as people.
  const households = [
    ...new Map(reports.map((r) => [r.reporterKeyHash, r])).values(),
  ];
  const reportedHouseholdPopulation = households.reduce(
    (sum, r) => sum + r.householdSize,
    0,
  );
  const coverage =
    area?.reportCoverageEstimate ?? config.POPULATION_REPORT_COVERAGE;
  const extrapolated = Math.round(reportedHouseholdPopulation / coverage);
  const estimate =
    area?.populationEstimate != null
      ? Math.max(
          reportedHouseholdPopulation,
          Math.min(extrapolated, area.populationEstimate),
        )
      : extrapolated;
  return {
    estimate,
    reportedHouseholdPopulation,
    householdCount: households.length,
    averageHouseholdSize: households.length
      ? round(reportedHouseholdPopulation / households.length)
      : null,
    assumedReportCoverage: coverage,
    method:
      "Unique reporting households divided by assumed reporting coverage; bounded by area population estimate when available. This is approximate, not a census or verified total.",
    range: {
      lower: reportedHouseholdPopulation,
      upper:
        area?.populationEstimate == null
          ? null
          : Math.max(reportedHouseholdPopulation, area.populationEstimate),
    },
  };
}
