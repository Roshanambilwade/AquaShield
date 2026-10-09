import { createHash } from "node:crypto";
import { loadEvidence } from "./evidence.js";
import Delivery from "../../models/Delivery.js";
import { tripRoute } from "../routingService.js";

export function attachLogisticsEvidence(facts, delivery, route) {
  const selected = facts.zones.find((z) => z.ref === facts.selectedRef);
  const available = delivery && String(delivery.eventId) === selected.eventId;
  const evidence = {
    ...facts,
    ruleVersion: "phase7-logistics-v1",
    route: available
      ? {
          zoneRef: selected.ref,
          tripStatus: delivery.status,
          distanceKm: route.distanceKm,
          etaMinutes: route.etaMinutes,
          distanceMethod: route.distanceMethod,
          etaMethod: route.etaMethod,
          observationStatus: route.observationStatus,
          routingStatus: route.routingStatus,
          originObservedAt: route.originObservedAt,
          note: route.note,
        }
      : null,
    missingInputs: facts.missingInputs.filter(
      (i) => i !== "Routing/ETA service",
    ),
    limitations: facts.limitations.filter(
      (i) => !i.includes("Trips and verified delivery remain future work."),
    ),
  };
  if (!available)
    evidence.missingInputs.push("Assigned trip for the selected zone");
  else if (route.distanceKm == null)
    evidence.missingInputs.push(
      "Valid recent origin and destination coordinates for route estimates",
    );
  evidence.limitations.push(
    "Recorded trip state and route estimates are backend facts. No live GPS, traffic or independent household receipt is established. The agent cannot dispatch or complete delivery.",
  );
  const { evidenceVersion, ...content } = evidence;
  void evidenceVersion;
  return {
    ...content,
    evidenceVersion: createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex"),
  };
}

export async function loadLogisticsEvidence(config, input) {
  const facts = await loadEvidence(config, input);
  const selected = facts.zones.find((z) => z.ref === facts.selectedRef);
  // Read only: agent assessment must not backfill trip records or repair state.
  const delivery = await Delivery.findOne({
    eventId: selected.eventId,
    isDemo: input.demo,
    status: { $ne: "RESETTING" },
  })
    .sort({ assignedAt: -1 })
    .select("eventId status origin destination originObservedAt")
    .lean();
  const route = delivery ? await tripRoute(delivery, config) : null;
  return attachLogisticsEvidence(facts, delivery, route);
}
