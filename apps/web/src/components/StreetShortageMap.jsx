import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";

const colors = {
  LOW: "#387c60",
  MEDIUM: "#ac7215",
  HIGH: "#c75621",
  CRITICAL: "#aa3543",
};
const pair = (point) => [point.lat, point.lng];
function Controls({ points }) {
  const map = useMap();
  const key = JSON.stringify(points);
  const bounds = useMemo(() => latLngBounds(JSON.parse(key)), [key]);
  useEffect(() => {
    map.fitBounds(bounds, { padding: [45, 55], maxZoom: 14 });
  }, [map, bounds]);
  useEffect(() => {
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(map.getContainer());
    return () => resize.disconnect();
  }, [map]);
  return (
    <div className="street-map-controls">
      <button aria-label="Zoom in" onClick={() => map.zoomIn()}>
        +
      </button>
      <button aria-label="Zoom out" onClick={() => map.zoomOut()}>
        −
      </button>
      <button
        onClick={() =>
          map.fitBounds(latLngBounds(points), {
            padding: [45, 55],
            maxZoom: 14,
          })
        }
      >
        Fit all zones
      </button>
    </div>
  );
}
function icon(event) {
  const content = document.createElement("div");
  const dot = document.createElement("span");
  dot.className = "street-zone-dot";
  dot.style.backgroundColor = colors[event.severityLevel];
  const label = document.createElement("strong");
  label.textContent = event.areaName;
  content.append(dot, label);
  return divIcon({
    html: content,
    className: "street-zone-icon",
    iconSize: [100, 46],
    iconAnchor: [50, 14],
  });
}
export default function StreetShortageMap({
  events,
  selectedId,
  onSelect,
  layers,
  reportsVisible,
  tankersVisible,
  risksVisible,
  onTileFailure,
}) {
  const points = [
    ...events.map((e) => pair(e.center)),
    ...(reportsVisible
      ? (layers?.reports || []).map((r) => pair(r.location))
      : []),
    ...(tankersVisible
      ? (layers?.tankers || []).map((t) => pair(t.location))
      : []),
  ];
  if (!points.length)
    return <p className="empty-card">No geographic records are available.</p>;
  return (
    <MapContainer
      center={points[0]}
      zoom={12}
      zoomControl={false}
      className="street-map"
      scrollWheelZoom={false}
      aria-label="Street map of shortage evidence"
    >
      <Controls points={points} />
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        eventHandlers={{ tileerror: onTileFailure }}
      />
      {events.map((event) => (
        <Marker
          key={event.id}
          position={pair(event.center)}
          icon={icon(event)}
          title={`Inspect ${event.areaName}, ${event.severityLevel}`}
          eventHandlers={{
            add: (e) =>
              e.target
                .getElement()
                ?.setAttribute(
                  "aria-label",
                  `Inspect ${event.areaName}, ${event.severityLevel}`,
                ),
            click: () => onSelect(event.id),
          }}
        >
          <Popup>
            <strong>{event.areaName}</strong>
            <p>
              {event.severityLevel} · {event.severityScore}/100
            </p>
            <p>Shortage confidence: {event.confidenceScore}%</p>
            <p>
              Approximate affected population: ~
              {event.estimatedAffectedPopulation}
            </p>
            <p>
              {event.isDemo ? "Simulated evidence" : "Reported evidence"}
              {event.status === "EMERGING"
                ? " · emerging; limited current evidence"
                : ""}
            </p>
            <button
              className="table-area-link"
              onClick={() => onSelect(event.id)}
            >
              Inspect evidence
            </button>
          </Popup>
        </Marker>
      ))}
      {events
        .filter(
          (e) =>
            e.id === selectedId || (risksVisible && e.status === "EMERGING"),
        )
        .map((e) => (
          <CircleMarker
            key={`halo-${e.id}`}
            center={pair(e.center)}
            radius={e.status === "EMERGING" ? 23 : 18}
            pathOptions={{
              color: colors[e.severityLevel],
              weight: 2,
              fillOpacity: 0.12,
              dashArray: e.status === "EMERGING" ? "4 4" : undefined,
            }}
            interactive={false}
          />
        ))}
      {reportsVisible &&
        layers?.reports.map((r) => (
          <CircleMarker
            key={r.id}
            center={pair(r.location)}
            radius={4}
            pathOptions={{ color: "#326aa0", weight: 1, fillOpacity: 0.7 }}
          >
            <Popup>
              <strong>Citizen report</strong>
              <p>
                {r.problem} · {r.verificationStatus}
              </p>
              <p>
                {r.locationSource === "LOCALITY_CENTER"
                  ? "Approximate locality center"
                  : "Citizen-reported coordinates"}
                {r.isDemo ? " · simulated" : ""}
              </p>
            </Popup>
          </CircleMarker>
        ))}
      {tankersVisible &&
        layers?.tankers.map((t) => (
          <CircleMarker
            key={t.id}
            center={pair(t.location)}
            radius={7}
            pathOptions={{ color: "#235579", weight: 3, fillOpacity: 0.9 }}
          >
            <Popup>
              <strong>Tanker {t.id}</strong>
              <p>
                Observation: {t.observationStatus ?? "UNKNOWN"}
                {t.observedAt
                  ? ` · ${new Date(t.observedAt).toLocaleString()}`
                  : ""}
                .{" "}
                {t.eligibility?.eligible
                  ? "Eligible for allocation"
                  : "Not eligible for allocation"}
              </p>
              <p>{t.status}</p>
              <p>
                {t.capacityLitres == null
                  ? "Capacity unknown"
                  : `${t.capacityLitres} L recorded capacity`}
              </p>
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
