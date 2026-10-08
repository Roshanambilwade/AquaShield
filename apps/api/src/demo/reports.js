import { createHash } from "node:crypto";

export function demoReports() {
  const base = new Date("2026-10-08T06:00:00.000Z");
  return Array.from({ length: 12 }, (_, index) => ({
    reporterKeyHash: createHash("sha256")
      .update("aquashield-fictional-demo-citizen")
      .digest("hex"),
    submissionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    location: { lat: 20.011 + index * 0.0001, lng: 73.79 + index * 0.0001 },
    locationSource: "MANUAL",
    accuracyMeters: null,
    areaId: "AREA_01",
    locality: "Panchavati",
    problem: ["NO_WATER", "LOW_PRESSURE", "PIPELINE_FAILURE"][index % 3],
    lastSupplyTime: new Date(base.getTime() - (index + 8) * 3600000),
    reportedDurationHours: index + 8,
    waterLevel: index % 2 ? "LESS_THAN_25" : "EMPTY",
    householdSize: 3 + (index % 4),
    description: `Simulated household report ${index + 1}. Fictional data for testing the reporting flow.`,
    verificationStatus: "PENDING",
    isDemo: true,
    hasPhoto: false,
    createdAt: new Date(base.getTime() + index * 60000),
    updatedAt: new Date(base.getTime() + index * 60000),
  }));
}
