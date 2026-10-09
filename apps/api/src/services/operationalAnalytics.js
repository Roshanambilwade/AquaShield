// Recorded operational totals only; delivery does not resolve a shortage or
// establish exact people served. Snapshot utilization is not time utilization.
export function operationalAnalytics(events, ops, allocations) {
  const areas = new Map();
  const row = (key, name) => {
    if (!areas.has(key))
      areas.set(key, {
        area: name,
        allocations: 0,
        deliveredLitres: ops.deliveries == null ? null : 0,
        timedDeliveries: 0,
        totalResponseMinutes: 0,
      });
    return areas.get(key);
  };
  const keys = new Map(events.map((e) => [e.id, e.areaId || e.id]));
  for (const e of events) row(keys.get(e.id), e.areaName);
  if (allocations)
    for (const a of allocations) {
      if (!["ASSIGNED", "COMPLETED"].includes(a.status)) continue;
      row(keys.get(String(a.eventId)) || `event:${a.eventId}`, "Unknown area")
        .allocations++;
    }
  for (const d of ops.deliveries || []) {
    const entry = row(
      d.areaId || keys.get(String(d.eventId)) || "unknown",
      "Unknown area",
    );
    entry.deliveredLitres += d.litresDelivered;
    if (d.requestedAt && d.deliveredAt >= d.requestedAt) {
      entry.timedDeliveries++;
      entry.totalResponseMinutes += (d.deliveredAt - d.requestedAt) / 60000;
    }
  }
  const busy =
    ops.tankers?.filter((t) =>
      ["ASSIGNED", "EN_ROUTE", "ARRIVED"].includes(t.status),
    ).length ?? null;
  return {
    areas: [...areas.values()].map(({ totalResponseMinutes, ...entry }) => ({
      ...entry,
      allocations: allocations == null ? null : entry.allocations,
      averageResponseMinutes: entry.timedDeliveries
        ? Math.round((totalResponseMinutes / entry.timedDeliveries) * 10) / 10
        : null,
    })),
    fleetCount: ops.tankers?.length ?? null,
    busyTankers: busy,
    utilizationPercent: ops.tankers?.length
      ? Math.round((busy / ops.tankers.length) * 1000) / 10
      : null,
    unservedHighPriorityAreas: events
      .filter(
        (e) =>
          e.status === "ACTIVE" &&
          ["HIGH", "CRITICAL"].includes(e.severityLevel),
      )
      .map((e) => ({
        area: e.areaName,
        severity: e.severityLevel,
        deliveryRecorded:
          ops.deliveries == null
            ? null
            : ops.deliveries.some(
                (d) =>
                  String(d.eventId) === e.id ||
                  (e.areaId && d.areaId === e.areaId),
              ),
      }))
      .filter((e) => e.deliveryRecorded !== true),
    estimatedPeopleServed: null,
    note: "Allocation counts include assigned/completed records. Water totals use OTP-accepted delivery records; recipient identity and physical litres are not independently measured. Utilization is the current recorded fleet snapshot. No recorded delivery is not proof of no delivery; high-priority zones without recorded support require review. People served and shortage resolution remain unknown without additional evidence.",
  };
}
