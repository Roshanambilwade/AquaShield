import { distanceKm } from "./geography.js";
export function validPoint(p) {
  return (
    p != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}
export async function tripRoute(
  delivery,
  config,
  { fetchRoute = fetch, now = new Date() } = {},
) {
  const origin = delivery.origin,
    destination = delivery.destination;
  const result = {
    origin: validPoint(origin) ? origin : null,
    destination: validPoint(destination) ? destination : null,
    distanceKm: null,
    etaMinutes: null,
    geometry: null,
    distanceMethod: "UNKNOWN",
    etaMethod: "UNKNOWN",
    originObservedAt: delivery.originObservedAt ?? null,
    observationStatus: "UNKNOWN",
    routingStatus: "NOT_CONFIGURED",
    note: "Stored observations only; no live GPS or traffic feed. Destination is an approximate shortage-zone center.",
  };
  if (!validPoint(origin) || !validPoint(destination))
    return { ...result, routingStatus: "MISSING_COORDINATES" };
  const age = now - new Date(delivery.originObservedAt);
  if (
    !delivery.originObservedAt ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > config.OPERATIONS_STALE_HOURS * 3600000
  )
    return {
      ...result,
      observationStatus: "STALE_OR_UNKNOWN",
      routingStatus: "STALE_ORIGIN",
    };
  result.observationStatus = "RECENT_RECORDED";
  result.distanceKm = Math.round(distanceKm(origin, destination) * 100) / 100;
  result.distanceMethod = "STRAIGHT_LINE";
  result.etaMinutes = Math.ceil(
    (distanceKm(origin, destination) / config.ROUTING_AVERAGE_SPEED_KPH) * 60,
  );
  result.etaMethod = "AVERAGE_SPEED_ESTIMATE";
  result.averageSpeedKph = config.ROUTING_AVERAGE_SPEED_KPH;
  if (!config.ROUTING_BASE_URL) return result;
  try {
    const url = new URL(
      `route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
      config.ROUTING_BASE_URL.endsWith("/")
        ? config.ROUTING_BASE_URL
        : `${config.ROUTING_BASE_URL}/`,
    );
    url.search = "overview=full&geometries=geojson";
    const response = await fetchRoute(url, {
      signal: AbortSignal.timeout(config.ROUTING_TIMEOUT_MS),
      redirect: "error",
    });
    if (!response.ok) throw Error("unavailable");
    const reader = response.body.getReader();
    let size = 0,
      content = "";
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1000000) throw Error("oversized");
        content += decoder.decode(value, { stream: true });
      }
    } finally {
      await reader.cancel();
    }
    content += decoder.decode();
    const route = JSON.parse(content).routes?.[0];
    const points = route?.geometry?.coordinates;
    if (
      !route ||
      !Number.isFinite(route.distance) ||
      route.distance < 0 ||
      route.distance > 10000000 ||
      !Number.isFinite(route.duration) ||
      route.duration < 0 ||
      route.duration > 604800 ||
      route.geometry.type !== "LineString" ||
      !Array.isArray(points) ||
      points.length < 2 ||
      points.length > 10000 ||
      points.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          !validPoint({ lat: p[1], lng: p[0] }),
      ) ||
      distanceKm(origin, { lat: points[0][1], lng: points[0][0] }) > 1 ||
      distanceKm(destination, {
        lat: points.at(-1)[1],
        lng: points.at(-1)[0],
      }) > 1
    )
      throw Error("invalid");
    return {
      ...result,
      distanceKm: Math.round(route.distance / 10) / 100,
      etaMinutes: Math.ceil(route.duration / 60),
      geometry: { type: "LineString", coordinates: points },
      distanceMethod: "ROAD_ROUTE",
      etaMethod: "ROUTING_SERVICE_ESTIMATE",
      routingStatus: "AVAILABLE",
    };
  } catch {
    return { ...result, routingStatus: "UNAVAILABLE_FALLBACK" };
  }
}
