import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
function Fit({ positions }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(positions, { padding: [30, 30], maxZoom: 15 });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, positions]);
  return null;
}
export default function TripMap({ route }) {
  const origin = [route.origin.lat, route.origin.lng],
    destination = [route.destination.lat, route.destination.lng];
  const positions = route.geometry
    ? route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
    : [origin, destination];
  return (
    <div>
      <div className="trip-map" aria-label="Trip map">
        <MapContainer center={origin} zoom={13} style={{ height: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <CircleMarker center={origin}>
            <Popup>Stored origin observation; not live GPS.</Popup>
          </CircleMarker>
          <CircleMarker center={destination} pathOptions={{ color: "#aa3543" }}>
            <Popup>Approximate shortage-zone destination.</Popup>
          </CircleMarker>
          <Polyline
            positions={positions}
            pathOptions={{
              color: "#236757",
              dashArray: route.geometry ? undefined : "8 8",
            }}
          />
          <Fit positions={positions} />
        </MapContainer>
      </div>
      <p>
        {route.geometry
          ? "Routing-service road geometry"
          : "Dashed straight-line connector; not a road route"}
        . Background tiles need network access; recorded coordinates and
        estimates remain available without tiles.
      </p>
    </div>
  );
}
