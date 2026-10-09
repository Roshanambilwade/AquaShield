import ShortageEvent from "../models/ShortageEvent.js";
import Allocation from "../models/Allocation.js";

// Input reports have already passed owner authorization. Never expose allocation
// IDs, staff details, tanker details or internal notes in a citizen response.
export async function reportResponses(reports) {
  const result = new Map();
  for (const demo of [false, true]) {
    const ids = reports.filter((r) => r.isDemo === demo).map((r) => r.id);
    if (!ids.length) continue;
    const events = await ShortageEvent.find({
      isDemo: demo,
      status: { $ne: "SUPERSEDED" },
      $or: ["reportIds", "duplicateReportIds", "suspiciousReportIds"].map(
        (key) => ({ [key]: { $in: ids } }),
      ),
    })
      .select("reportIds duplicateReportIds suspiciousReportIds")
      .lean();
    const allocations = await Allocation.find({
      isDemo: demo,
      active: true,
      eventId: { $in: events.map((e) => e._id) },
      status: { $in: ["APPROVED", "ASSIGNING", "ASSIGNED"] },
    })
      .select("eventId status approvedAt assignedAt")
      .lean();
    for (const event of events) {
      const allocation = allocations.find(
        (a) => String(a.eventId) === String(event._id),
      );
      if (!allocation) continue;
      for (const id of [
        ...event.reportIds,
        ...event.duplicateReportIds,
        ...event.suspiciousReportIds,
      ]) {
        if (!ids.includes(String(id))) continue;
        result.set(String(id), {
          status:
            allocation.status === "ASSIGNING" ? "APPROVED" : allocation.status,
          approvedAt: allocation.approvedAt ?? null,
          assignedAt: allocation.assignedAt ?? null,
        });
      }
    }
  }
  return result;
}
