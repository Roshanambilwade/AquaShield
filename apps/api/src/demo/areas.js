import { LOCALITY_CENTERS } from "../../../../packages/shared/reportOptions.js";
import { DEMO_OBSERVED_AT } from "./reports.js";

export function demoAreas() {
  const populations = [12000, 5000, 3500, 4500, 2000];
  const vulnerable = [2100, 500, 175, null, 400];
  const temperatures = [43, 38, 31, 25, 39];
  return LOCALITY_CENTERS.map((area, index) => ({
    _id: area.id,
    name: area.name,
    center: { lat: area.lat, lng: area.lng },
    populationEstimate: populations[index],
    vulnerablePopulationEstimate: vulnerable[index],
    averageHouseholdSize: 4.2,
    reportCoverageEstimate: 0.25,
    temperatureC: temperatures[index],
    isDemo: true,
    ...(index < 2
      ? {
          infrastructureIncident: {
            location: { lat: area.lat, lng: area.lng },
            startedAt: new Date(DEMO_OBSERVED_AT.getTime() - 30 * 3600000),
            endedAt: null,
            description:
              "Fictional pipeline disruption for the deterministic demo.",
          },
        }
      : {}),
  }));
}
