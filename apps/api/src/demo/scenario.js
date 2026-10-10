import { createHash } from "node:crypto";
import {
  LOCALITY_CENTERS,
  DEMO_LOCALITY_CENTERS,
} from "../../../../packages/shared/reportOptions.js";
export const SEED_VERSION = "aquashield-faculty-v1";
export function seedRequestId(key) {
  const hex = createHash("sha256")
    .update(`${SEED_VERSION}:${key}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export const seedId = (key) =>
  createHash("sha256")
    .update(`${SEED_VERSION}:${key}`)
    .digest("hex")
    .slice(0, 24);
export const accountDefinitions = [
  { key: "admin", role: "ADMIN", name: "Faculty municipal administrator" },
  ...Array.from({ length: 16 }, (_, i) => ({
    key: `citizen-${String(i + 1).padStart(2, "0")}`,
    role: "CITIZEN",
    name: `Scenario citizen ${i + 1}`,
  })),
  ...Array.from({ length: 9 }, (_, i) => ({
    key: `operator-${String(i + 1).padStart(2, "0")}`,
    role: "OPERATOR",
    name: `Scenario operator ${i + 1}`,
  })),
].map((a) => ({
  ...a,
  email: `${a.key}@aquashield-demo.example.test`,
  seedKey: `${SEED_VERSION}:${a.key}`,
}));
export function scenarioAreas(anchor) {
  return [...LOCALITY_CENTERS, ...DEMO_LOCALITY_CENTERS].map((a, i) => ({
    _id: a.id,
    name: a.name,
    center: { lat: a.lat, lng: a.lng },
    isDemo: true,
    seedKey: SEED_VERSION,
    populationEstimate: [12000, 5000, 3500, 4500, 2000, null][i],
    averageHouseholdSize: 4.5,
    reportCoverageEstimate: 0.2,
    vulnerablePopulationEstimate: [2400, 500, 175, null, 400, null][i],
    temperatureC: [43, 39, 32, 27, 37, null][i],
    ...(i < 2
      ? {
          infrastructureIncident: {
            location: { lat: a.lat, lng: a.lng },
            startedAt: new Date(+anchor - 48 * 3600000),
            endedAt: null,
            description:
              "Simulated municipal pipeline incident; demonstration evidence only.",
          },
        }
      : {}),
  }));
}
export function scenarioReports(anchor, citizens) {
  const counts = [12, 10, 8, 8, 8, 2],
    verified = [9, 7, 4, 3, 5, 0];
  return scenarioAreas(anchor).flatMap((a, area) =>
    Array.from({ length: counts[area] }, (_, index) => {
      const person = citizens[(area * 5 + index) % citizens.length];
      const repeated = area === 0 && index === 11;
      const owner = repeated ? citizens[0] : person;
      const historyHours =
        index >= 6 ? (area === 2 ? 30 : area === 3 ? 12 : 0) : 0;
      const createdAt = new Date(
        +anchor - historyHours * 3600000 - (area * 30 + index * 3 + 1) * 60000,
      );
      const duration = [36, 18, 10, 2, 12, null][area];
      const key = `${a._id}:${index}`;
      const conflicting = area === 1 && index === 9;
      return {
        _id: seedId(`report:${key}`),
        seedKey: `${SEED_VERSION}:report:${key}`,
        ownerId: owner.id,
        submissionId: `00000000-0000-4000-8000-${String(area * 100 + index + 1).padStart(12, "0")}`,
        location: a.center,
        locationSource: "LOCALITY_CENTER",
        accuracyMeters: null,
        areaId: a._id,
        locality: a.name,
        problem: area < 2 ? "NO_WATER" : "LOW_PRESSURE",
        lastSupplyTime:
          duration == null ? null : new Date(+createdAt - duration * 3600000),
        reportedDurationHours: conflicting ? 1 : duration,
        waterLevel: [
          "EMPTY",
          "LESS_THAN_25",
          "BETWEEN_25_50",
          "ABOVE_50",
          "LESS_THAN_25",
          "UNKNOWN",
        ][area],
        householdSize: 3 + (index % 5),
        description: repeated
          ? "Simulated repeated submission; review duplicate handling."
          : conflicting
            ? "Simulated inconsistent duration; requires investigation."
            : "Fictional household conditions at an approximate scenario locality center.",
        verificationStatus:
          index < verified[area] && !repeated ? "VERIFIED" : "PENDING",
        verificationSource:
          index < verified[area] && !repeated ? "SIMULATED_FIELD_CHECK" : null,
        sourceType: "DEMO_SEED",
        isDemo: true,
        hasPhoto: false,
        createdAt,
        updatedAt: createdAt,
      };
    }),
  );
}
export const tripScenarios = [
  { key: "rejected-1", stage: "REJECTED" },
  { key: "rejected-2", stage: "REJECTED" },
  ...Array.from({ length: 6 }, (_, i) => ({
    key: `completed-${i + 1}`,
    stage: "DELIVERED",
  })),
  { key: "assigned", stage: "ASSIGNED" },
  { key: "en-route", stage: "EN_ROUTE" },
  { key: "arrived", stage: "ARRIVED" },
  { key: "recommended", stage: "RECOMMENDED" },
];
