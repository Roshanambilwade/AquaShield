// Explicit synthetic calculation fixtures; never imported by production services.
export function activityReports({
  now = new Date("2026-10-10T12:00:00Z"),
  counts = [...Array(8).fill(2), ...Array(4).fill(6)],
  areaId = "AREA_01",
  isDemo = false,
  key = "synthetic",
  location = { lat: 20.011, lng: 73.79 },
} = {}) {
  const end = Math.floor(+now / 21600000) * 21600000,
    start = end - counts.length * 21600000;
  return counts.flatMap((count, window) =>
    Array.from({ length: count }, (_, i) => ({
      _id: `${key}-${window}-${i}`,
      areaId,
      location,
      isDemo,
      reporterKeyHash: `${key}-person-${window}-${i}`,
      verificationStatus: i % 2 ? "PENDING" : "VERIFIED",
      createdAt: new Date(start + window * 21600000 + (i + 1) * 60000),
      updatedAt: new Date(start + window * 21600000 + (i + 1) * 60000),
      lastSupplyTime: null,
      reportedDurationHours: null,
    })),
  );
}
