import { useSearchParams } from "react-router-dom";
import useAdminData from "../hooks/useAdminData.js";
import TripCard from "../components/TripCard.jsx";
export default function DeliveriesPage() {
  const [params] = useSearchParams(),
    demo = params.get("demo") === "true";
  const { data, error, refresh } = useAdminData(`/deliveries?demo=${demo}`);
  return (
    <div className="page operations-page">
      <p className="eyebrow">Municipal operations</p>
      <h1 className="page-title">Trips and deliveries</h1>
      {demo && (
        <p className="demo-note">
          Fictional demo operations. OTP acceptance is simulated evidence, not
          independent delivery proof.
        </p>
      )}
      <button className="button button-secondary" onClick={refresh}>
        Refresh deliveries
      </button>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading delivery history…</p>}
      {data && (
        <>
          <p>
            Latest up to 200 trips. Counts below cover the displayed history.
          </p>
          <div className="trip-metrics">
            {["ASSIGNED", "EN_ROUTE", "ARRIVED", "COMPLETING", "DELIVERED"].map(
              (status) => (
                <p key={status}>
                  {status}:{" "}
                  {data.deliveries.filter((d) => d.status === status).length}
                </p>
              ),
            )}
            <p>
              Recorded actual water delivered:{" "}
              {data.deliveries
                .filter((d) => d.status === "DELIVERED" && d.otpVerified)
                .reduce((sum, d) => sum + d.litresDelivered, 0)
                .toLocaleString()}{" "}
              L (displayed history)
            </p>
          </div>
          {!data.deliveries.length && (
            <p>No assigned trips or recorded deliveries yet.</p>
          )}
          <div className="operations-cards">
            {data.deliveries.map((d) => (
              <TripCard key={d.id} delivery={d} admin onChange={refresh} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
