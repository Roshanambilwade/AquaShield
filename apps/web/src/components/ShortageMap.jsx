const colors = {
  LOW: "#387c60",
  MEDIUM: "#ac7215",
  HIGH: "#c75621",
  CRITICAL: "#aa3543",
};
export default function ShortageMap({ events, selectedId, onSelect }) {
  if (!events.length) return null;
  const lats = events.map((e) => e.center.lat),
    lngs = events.map((e) => e.center.lng);
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
      <svg
        viewBox="0 0 800 460"
        role="group"
        aria-label="Select a shortage zone to inspect its evidence"
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
                {event.areaName}: severity {event.severityScore}/100, confidence{" "}
                {event.confidenceScore}%
              </title>
              <circle
                r={event.id === selectedId ? 29 : 22}
                fill={colors[event.severityLevel]}
                opacity="0.16"
              />
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
        <text x="20" y="440" className="map-score">
          Center: {centerLat.toFixed(4)}° latitude, {centerLng.toFixed(4)}°
          longitude
        </text>
      </svg>
      <p>
        Zone centers are derived from report coordinates. This offline map has
        no street tiles and does not show household locations.
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
