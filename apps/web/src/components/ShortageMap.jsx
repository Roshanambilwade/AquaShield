import { useState, useRef, lazy, Suspense } from "react";
const StreetShortageMap = lazy(() => import("./StreetShortageMap.jsx"));
const colors = {
  LOW: "#387c60",
  MEDIUM: "#ac7215",
  HIGH: "#c75621",
  CRITICAL: "#aa3543",
};
export default function ShortageMap({
  events,
  selectedId,
  onSelect,
  admin = false,
  layers,
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [reportsVisible, setReportsVisible] = useState(false);
  const [tankersVisible, setTankersVisible] = useState(true);
  const [risksVisible, setRisksVisible] = useState(true);
  const [street, setStreet] = useState(admin);
  const [tileFailed, setTileFailed] = useState(false);
  const drag = useRef(null);
  if (!events.length && !layers?.reports.length && !layers?.tankers.length)
    return <p className="empty-card">No geographic evidence is available.</p>;
  if (street)
    return (
      <section className="zone-map" aria-label="Geographic shortage map">
        <div className="map-heading">
          <strong>Geographic overview</strong>
          <span>Street map · OpenStreetMap</span>
        </div>
        <div className="map-controls">
          <button onClick={() => setStreet(false)}>Coordinate view</button>
          <label>
            <input
              type="checkbox"
              checked={reportsVisible}
              onChange={(e) => setReportsVisible(e.target.checked)}
            />
            Citizen reports
          </label>
          <label>
            <input
              type="checkbox"
              checked={tankersVisible}
              onChange={(e) => setTankersVisible(e.target.checked)}
            />
            Tankers
          </label>
          <label>
            <input
              type="checkbox"
              checked={risksVisible}
              onChange={(e) => setRisksVisible(e.target.checked)}
            />
            Emerging evidence
          </label>
        </div>
        <p className="map-layer-note">
          {layers
            ? `${layers.reports.length} report locations available${layers.reportsTruncated ? " (latest 500; truncated)" : ""}. ${layers.tankerDataAvailable ? `${layers.tankers.length} tanker locations recorded.` : "Tanker locations unknown."} Forecast layers are not configured.`
            : "Loading authorized map layers…"}
        </p>
        <Suspense fallback={<p role="status">Loading street map…</p>}>
          <StreetShortageMap
            events={events}
            selectedId={selectedId}
            onSelect={onSelect}
            layers={layers}
            reportsVisible={reportsVisible}
            tankersVisible={tankersVisible}
            risksVisible={risksVisible}
            onTileFailure={() => {
              setTileFailed(true);
              setStreet(false);
            }}
          />
        </Suspense>
        <p>
          Zone centers come from report coordinates; markers do not define
          verified outage boundaries. Report locations are visible only to
          administrators when enabled.
        </p>
        <div className="map-legend">
          {Object.entries(colors).map(([level, color]) => (
            <span key={level}>
              <i style={{ background: color }} />
              {level}
            </span>
          ))}
        </div>
      </section>
    );
  const points = [
    ...events.map((e) => e.center),
    ...(admin && (reportsVisible || !events.length)
      ? (layers?.reports || []).map((r) => r.location)
      : []),
    ...(admin && tankersVisible
      ? (layers?.tankers || []).map((t) => t.location)
      : []),
  ];
  const lats = points.map((e) => e.lat),
    lngs = points.map((e) => e.lng);
  const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const cos = Math.max(0.01, Math.cos((centerLat * Math.PI) / 180));
  const latSpan = Math.max(0.02, Math.max(...lats) - Math.min(...lats));
  const lngSpan = Math.max(0.02, Math.max(...lngs) - Math.min(...lngs));
  const scale = Math.min(300 / latSpan, 620 / (lngSpan * cos));
  const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
  return (
    <section className="zone-map" aria-label="Geographic shortage map">
      <div className="map-heading">
        <strong>Geographic overview</strong>
        <span>North ↑ · coordinate-based map</span>
      </div>
      <div className="map-controls" aria-label="Map controls">
        {admin && (
          <button
            onClick={() => {
              setTileFailed(false);
              setStreet(true);
            }}
          >
            Street view
          </button>
        )}
        <button
          aria-label="Zoom in"
          onClick={() => setZoom((v) => Math.min(5, v + 0.5))}
          disabled={zoom >= 5}
        >
          +
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((v) => Math.max(1, v - 0.5))}
          disabled={zoom <= 1}
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          Fit all zones
        </button>
        <span className="evidence-note">
          {Math.round(zoom * 100)}% · drag to pan
        </span>
        {admin && (
          <>
            <label>
              <input
                type="checkbox"
                checked={reportsVisible}
                onChange={(e) => {
                  setReportsVisible(e.target.checked);
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
              />
              Citizen reports
            </label>
            <label>
              <input
                type="checkbox"
                checked={tankersVisible}
                onChange={(e) => setTankersVisible(e.target.checked)}
              />
              Tankers
            </label>
            <label>
              <input
                type="checkbox"
                checked={risksVisible}
                onChange={(e) => setRisksVisible(e.target.checked)}
              />
              Emerging evidence
            </label>
          </>
        )}
      </div>
      {tileFailed && (
        <p className="map-layer-note" role="status">
          Street tiles are unavailable. The offline coordinate map remains
          interactive.
        </p>
      )}
      {admin && (
        <p className="map-layer-note">
          {layers
            ? `${layers.reports.length} report locations available${layers.reportsTruncated ? " (latest 500; truncated)" : ""}. ${layers.tankerDataAvailable ? `${layers.tankers.length} tanker locations recorded.` : "Tanker locations unknown."} Forecast layers are not configured.`
            : "Loading authorized map layers…"}
        </p>
      )}
      <svg
        viewBox="0 0 800 460"
        role="group"
        aria-label="Select a shortage zone to inspect its evidence"
        className="map-canvas"
        tabIndex="0"
        onKeyDown={(event) => {
          const direction = {
            ArrowLeft: [30, 0],
            ArrowRight: [-30, 0],
            ArrowUp: [0, 30],
            ArrowDown: [0, -30],
          }[event.key];
          if (direction && event.target === event.currentTarget) {
            event.preventDefault();
            setOffset((v) => ({
              x: v.x + direction[0],
              y: v.y + direction[1],
            }));
          }
        }}
        onPointerDown={(event) => {
          if (event.target.closest(".zone-marker")) return;
          const rect = event.currentTarget.getBoundingClientRect();
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            offset,
            scale: 800 / rect.width,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current)
            setOffset({
              x:
                drag.current.offset.x +
                (event.clientX - drag.current.x) * drag.current.scale,
              y:
                drag.current.offset.y +
                (event.clientY - drag.current.y) * drag.current.scale,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <pattern
            id="zone-grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="#d3e3d9"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="800" height="460" fill="#eef5ee" />
        <rect width="800" height="460" fill="url(#zone-grid)" />
        <g
          transform={`translate(${400 + offset.x},${230 + offset.y}) scale(${zoom}) translate(-400,-230)`}
        >
          {admin &&
            reportsVisible &&
            layers?.reports.map((r) => (
              <circle
                key={r.id}
                cx={400 + (r.location.lng - centerLng) * cos * scale}
                cy={230 - (r.location.lat - centerLat) * scale}
                r="3"
                fill="#326aa0"
                opacity="0.7"
              >
                <title>
                  {r.problem} · {r.verificationStatus} ·{" "}
                  {r.locationSource === "LOCALITY_CENTER"
                    ? "Approximate locality center"
                    : "Citizen-reported coordinates"}
                  {r.isDemo ? " · simulated" : ""}
                </title>
              </circle>
            ))}
          {admin &&
            tankersVisible &&
            layers?.tankers.map((t) => (
              <rect
                key={t.id}
                x={394 + (t.location.lng - centerLng) * cos * scale}
                y={224 - (t.location.lat - centerLat) * scale}
                width="12"
                height="12"
                fill="#235579"
                stroke="white"
              >
                <title>
                  Tanker {t.id} · {t.status} · observation{" "}
                  {t.observationStatus ?? "UNKNOWN"}
                </title>
              </rect>
            ))}
          {events.map((event) => {
            const x = 400 + (event.center.lng - centerLng) * cos * scale;
            const y = 230 - (event.center.lat - centerLat) * scale;
            return (
              <g
                key={event.id}
                transform={`translate(${x}, ${y})`}
                role="button"
                tabIndex="0"
                aria-label={`Inspect ${event.areaName}, ${event.severityLevel}`}
                onClick={() => onSelect(event.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(event.id);
                  }
                }}
                className="zone-marker"
              >
                <title>
                  {event.areaName}: severity {event.severityScore}/100,
                  confidence {event.confidenceScore}%
                </title>
                <circle
                  r={event.id === selectedId ? 29 : 22}
                  fill={colors[event.severityLevel]}
                  opacity="0.16"
                />
                {risksVisible && event.status === "EMERGING" && (
                  <circle
                    r="32"
                    stroke="#9c711d"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="4 4"
                  />
                )}
                <circle
                  r="10"
                  fill={colors[event.severityLevel]}
                  stroke="white"
                  strokeWidth="3"
                />
                <text y="-35" textAnchor="middle">
                  {event.areaName}
                </text>
                <text y="44" textAnchor="middle" className="map-score">
                  {event.severityScore}/100
                </text>
              </g>
            );
          })}
        </g>
        <text x="20" y="440" className="map-score">
          Center: {centerLat.toFixed(4)}° latitude, {centerLng.toFixed(4)}°
          longitude
        </text>
      </svg>
      <p>
        Zone centers are derived from report coordinates. This offline map has
        no street tiles
        {admin
          ? "; report locations are visible only to signed-in administrators when the layer is enabled."
          : "; public coordinates are generalized and small live clusters are withheld."}
      </p>
      <div className="map-legend">
        {Object.entries(colors).map(([level, color]) => (
          <span key={level}>
            <i style={{ background: color }} />
            {level}
          </span>
        ))}
      </div>
    </section>
  );
}
