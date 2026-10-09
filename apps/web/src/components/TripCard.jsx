import { lazy, Suspense, useEffect, useState } from "react";
import { adminRequest } from "../lib/adminApi.js";
const TripMap = lazy(() => import("./TripMap.jsx"));
export default function TripCard({ delivery, admin = false, onChange }) {
  const [detail, setDetail] = useState(null),
    [issuedDelivery, setIssuedDelivery] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [demoCode, setDemoCode] = useState(""),
    [litres, setLitres] = useState(""),
    [streetMap, setStreetMap] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    adminRequest(`/deliveries/${delivery.id}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setDetail(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [delivery.id, delivery.status, delivery.otpVerified]);
  async function act(action, body = {}) {
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest(
        `/deliveries/${delivery.id}/${action}`,
        { method: "POST", body },
      );
      if (result.demoOtp) setDemoCode(result.demoOtp);
      if (action === "verify") {
        setCode("");
        setDemoCode("");
        setIssuedDelivery(null);
      }
      if (["otp", "demo-otp"].includes(action))
        setIssuedDelivery(result.delivery);
      else await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const d =
      delivery.status === "ARRIVED" && !delivery.otpVerified
        ? issuedDelivery || delivery
        : delivery,
    route = detail?.route;
  return (
    <article className="operation-card trip-card" aria-label={`Trip ${d.id}`}>
      <p className="eyebrow">
        {d.isDemo ? "Fictional demo trip" : "Recorded trip"}
      </p>
      <h3>{d.areaName || "Unknown area"} delivery</h3>
      <p className="status-badge degraded">{d.status}</p>
      <p>Delivery {d.id}</p>
      <p>
        Planned water:{" "}
        {d.plannedLitres == null ? "Unknown" : `${d.plannedLitres} L`} · Actual
        delivered:{" "}
        {d.litresDelivered == null ? "Unknown" : `${d.litresDelivered} L`}
      </p>
      <p>
        Destination zone center:{" "}
        {d.destination
          ? `${d.destination.lat}, ${d.destination.lng} (approximate)`
          : "Unknown"}
      </p>
      {!route && !error && <p role="status">Loading route information…</p>}
      {route && (
        <div className="trip-route">
          <p>
            {route.distanceMethod === "ROAD_ROUTE"
              ? "Road distance"
              : "Straight-line distance"}
            : {route.distanceKm == null ? "Unknown" : `${route.distanceKm} km`}
          </p>
          <p>
            Estimated ETA:{" "}
            {route.etaMinutes == null ? "Unknown" : `${route.etaMinutes} min`}{" "}
            {route.etaMethod === "AVERAGE_SPEED_ESTIMATE"
              ? `(assumes ${route.averageSpeedKph} km/h; not road navigation)`
              : route.etaMethod === "ROUTING_SERVICE_ESTIMATE"
                ? "(routing estimate; no live traffic)"
                : ""}
          </p>
          <p>{route.note}</p>
          <p>
            Observation: {route.observationStatus} · Routing:{" "}
            {route.routingStatus}
          </p>
          {route.origin &&
            route.destination &&
            route.observationStatus === "RECENT_RECORDED" && (
              <>
                <svg
                  className="trip-schematic"
                  viewBox="0 0 360 90"
                  role="img"
                  aria-label="Stored origin and approximate destination; schematic, not navigation"
                >
                  <circle cx="25" cy="45" r="8" />
                  <path
                    d="M35 45 H325"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                  />
                  <circle cx="335" cy="45" r="8" />
                  <text x="15" y="80">
                    Recorded origin
                  </text>
                  <text x="225" y="80">
                    Destination zone
                  </text>
                </svg>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setStreetMap((v) => !v)}
                >
                  {streetMap ? "Hide street map" : "Show street map"}
                </button>
                {streetMap && (
                  <Suspense fallback={<p role="status">Loading map…</p>}>
                    <TripMap route={route} />
                  </Suspense>
                )}
              </>
            )}
        </div>
      )}
      <p>
        Verification:{" "}
        {d.otpVerified
          ? d.verificationMethod === "DEMO_OTP"
            ? "Demo OTP verified; simulated evidence"
            : d.verificationMethod === "RECIPIENT_OTP"
              ? "Recipient OTP accepted; not independent field proof"
              : "Recorded verification; method unknown"
          : "Not verified"}
      </p>
      {error && <p role="alert">{error}</p>}
      {!admin && (
        <div className="trip-actions">
          {d.status === "ASSIGNED" && (
            <button
              className="button"
              disabled={busy}
              onClick={() => act("start")}
            >
              Start trip
            </button>
          )}
          {d.status === "EN_ROUTE" && (
            <button
              className="button"
              disabled={busy}
              onClick={() => act("arrive")}
            >
              Mark arrived
            </button>
          )}
          {d.status === "ARRIVED" && !d.otpVerified && (
            <>
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => act(d.isDemo ? "demo-otp" : "otp")}
              >
                {d.isDemo ? "Generate demo OTP" : "Request recipient OTP"}
              </button>
              {demoCode && (
                <p className="demo-note" role="status">
                  Demo-only OTP: <strong>{demoCode}</strong>. No SMS sent;
                  simulated verification only.
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act("verify", { code });
                }}
              >
                <label>
                  Delivery OTP
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                  />
                </label>
                <button className="button" disabled={busy}>
                  Verify delivery OTP
                </button>
              </form>
            </>
          )}
          {d.status === "ARRIVED" && d.otpVerified && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act("complete", { litresDelivered: Number(litres) });
              }}
            >
              <label>
                Actual litres delivered
                <input
                  type="number"
                  min="1"
                  max={Math.min(
                    d.capacityLitres,
                    d.startingAvailableLitres,
                    d.plannedLitres ?? Infinity,
                  )}
                  step="1"
                  value={litres}
                  onChange={(e) => setLitres(e.target.value)}
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                Complete delivery
              </button>
            </form>
          )}
        </div>
      )}
      {d.syncPending && (
        <p role="status">
          Completion synchronization pending. Ask the municipal administrator to
          recover this recorded completion.
        </p>
      )}
      {admin && d.syncPending && (
        <button
          className="button"
          disabled={busy}
          onClick={() => act("recover")}
        >
          Recover completion
        </button>
      )}
      <details>
        <summary>Trip timestamps and audit history</summary>
        <dl>
          {[
            "assignedAt",
            "startedAt",
            "arrivedAt",
            "verifiedAt",
            "deliveredAt",
          ].map((key) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{d[key] ? new Date(d[key]).toLocaleString() : "Unknown"}</dd>
            </div>
          ))}
        </dl>
        <p>
          Failed OTP attempts in current issuance: {d.otpAttempts || 0} · Code
          expiry:{" "}
          {d.otpExpiresAt
            ? new Date(d.otpExpiresAt).toLocaleString()
            : "Unknown"}
        </p>
        <ol>
          {(d.audit || []).map((item, i) => (
            <li key={i}>
              {item.action} · {new Date(item.at).toLocaleString()}
              {admin ? ` · actor ${item.actorId}` : ""}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}
