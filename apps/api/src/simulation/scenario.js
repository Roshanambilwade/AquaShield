import { createHash } from "node:crypto";
import { scenarioAreas } from "../demo/scenario.js";
export const MAX_TICKS = 24;
export const VIRTUAL_TICK_MS = 15 * 60000;
export const simulationAccounts = [
  { key: "admin", role: "ADMIN" },
  ...Array.from({ length: 2 }, (_, i) => ({
    key: `operator-${i + 1}`,
    role: "OPERATOR",
  })),
  ...Array.from({ length: 72 }, (_, i) => ({
    key: `citizen-${i + 1}`,
    role: "CITIZEN",
  })),
].map((a) => ({
  ...a,
  email: `${a.key}@aquashield-simulation.example.test`,
  name: `Simulation ${a.key}`,
}));
export const areasForSimulation = scenarioAreas;
export function tickReports(run, tick, users) {
  const areas = areasForSimulation(run.anchorAt);
  const eventAt = new Date(+run.anchorAt + tick * VIRTUAL_TICK_MS);
  // Each new fictional household submits once. Area one grows first; the
  // following areas emerge progressively. No outcome scores are supplied.
  return Array.from({ length: 3 }, (_, i) => {
    const ordinal = (tick - 1) * 3 + i;
    const areaIndex = tick <= 4 ? 0 : (Math.floor((tick - 5) / 2) + i) % 6;
    const area = areas[areaIndex];
    const hex = createHash("sha256")
      .update(`${run.runId}:${tick}:${i}`)
      .digest("hex");
    return {
      citizen: users[`citizen-${ordinal + 1}`],
      eventAt,
      input: {
        submissionId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
        areaId: area._id,
        locality: area.name,
        location: area.center,
        locationSource: "LOCALITY_CENTER",
        accuracyMeters: null,
        problem: ["NO_WATER", "LOW_PRESSURE", "PIPELINE_FAILURE"][
          areaIndex % 3
        ],
        lastSupplyTime: null,
        reportedDurationHours: [30, 18, 8, 3, 12, null][areaIndex],
        waterLevel: [
          "EMPTY",
          "LESS_THAN_25",
          "BETWEEN_25_50",
          "ABOVE_50",
          "LESS_THAN_25",
          "UNKNOWN",
        ][areaIndex],
        householdSize: 3 + (ordinal % 5),
        description:
          "Synthetic household evidence at an approximate locality center; no field verification.",
      },
    };
  });
}
