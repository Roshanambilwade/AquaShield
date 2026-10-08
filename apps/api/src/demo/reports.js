import { createHash } from "node:crypto";
import { LOCALITY_CENTERS } from "../../../../packages/shared/reportOptions.js";

export const DEMO_OBSERVED_AT = new Date("2026-10-08T06:00:00.000Z");
const scenarios = [
  {
    count: 37,
    duration: 24,
    size: 3,
    level: "LESS_THAN_25",
    problem: "NO_WATER",
    verified: 31,
  },
  {
    count: 12,
    duration: 16,
    size: 4,
    level: "LESS_THAN_25",
    problem: "NO_WATER",
    verified: 8,
  },
  {
    count: 8,
    duration: 8,
    size: 3,
    level: "BETWEEN_25_50",
    problem: "LOW_PRESSURE",
    verified: 3,
  },
  {
    count: 4,
    duration: 1,
    size: 2,
    level: "ABOVE_50",
    problem: "LOW_PRESSURE",
    verified: 0,
  },
  {
    count: 2,
    duration: 3,
    size: 5,
    level: "BETWEEN_25_50",
    problem: "LOW_PRESSURE",
    verified: 0,
  },
];
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function demoReports() {
  const reports = scenarios.flatMap((s, areaIndex) =>
    Array.from({ length: s.count }, (_, index) => {
      const area = LOCALITY_CENTERS[areaIndex];
      const key = `${area.id}:${index}`;
      const createdAt = new Date(
        DEMO_OBSERVED_AT.getTime() - (s.count - 1 - index) * 60000,
      );
      return {
        _id: hash(`aquashield-phase3-report:${key}`).slice(0, 24),
        reporterKeyHash: hash(`aquashield-fictional-household:${key}`),
        submissionId: `00000000-0000-4000-8000-${String(areaIndex * 100 + index + 1).padStart(12, "0")}`,
        location: {
          lat: area.lat + ((index % 5) - 2) * 0.0002,
          lng: area.lng + ((index % 7) - 3) * 0.0002,
        },
        locationSource: "MANUAL",
        accuracyMeters: null,
        areaId: area.id,
        locality: area.name,
        problem: s.problem,
        lastSupplyTime: new Date(
          createdAt.getTime() - (s.duration + (index % 3) * 0.5) * 3600000,
        ),
        reportedDurationHours: s.duration + (index % 3) * 0.5,
        waterLevel: areaIndex === 0 && index % 6 === 0 ? "EMPTY" : s.level,
        householdSize: s.size + (index % 3),
        description: `Simulated household ${index + 1} in ${area.name}. All conditions and verification evidence are fictional.`,
        verificationStatus: index < s.verified ? "VERIFIED" : "PENDING",
        verificationSource: index < s.verified ? "SIMULATED_FIELD_CHECK" : null,
        isDemo: true,
        hasPhoto: false,
        createdAt,
        updatedAt: createdAt,
      };
    }),
  );
  for (let index = 0; index < 2; index += 1)
    reports.push({
      ...reports[index],
      _id: hash(`aquashield-phase3-repeat:${index}`).slice(0, 24),
      submissionId: `00000000-0000-4000-8000-${String(900 + index).padStart(12, "0")}`,
      verificationStatus: "PENDING",
      verificationSource: null,
      createdAt: DEMO_OBSERVED_AT,
      updatedAt: DEMO_OBSERVED_AT,
      description: "Simulated repeated submission from an existing household.",
    });
  reports.push({
    ...reports[36],
    _id: hash("aquashield-phase3-suspicious").slice(0, 24),
    reporterKeyHash: hash("aquashield-fictional-conflicting-household"),
    submissionId: "00000000-0000-4000-8000-000000000999",
    reportedDurationHours: 1,
    verificationStatus: "PENDING",
    verificationSource: null,
    description:
      "Simulated conflicting duration for review, excluded from scores.",
  });
  return reports;
}
