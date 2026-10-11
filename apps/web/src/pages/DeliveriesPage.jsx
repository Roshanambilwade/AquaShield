import { useSearchParams } from "react-router-dom";
import useAdminData from "../hooks/useAdminData.js";
import TripCard from "../components/TripCard.jsx";
import { useEnvironment } from "../lib/environment.js";
export default function DeliveriesPage() {
  const [params] = useSearchParams();
  const demo = useEnvironment().demonstration || params.get("demo") === "true";
  const { data, error, refresh } = useAdminData(`/deliveries?demo=${demo}`);
  return (
    <div className="page operations-page">
      <p className="eyebrow">Municipal operations</p>
      <h1 className="page-title">Trips and deliveries</h1>
      <section
        className="admin-panel"
        aria-labelledby="delivery-verification-heading"
      >
        <h2 id="delivery-verification-heading">Delivery verification</h2>
        <p>
          ADMIN inspects trips and recorded verification here. Only the assigned
          OPERATOR can verify a delivery from Your assignments. Sign out and
          sign in with the operator account linked to the assigned tanker.
        </p>
        <details>
          <summary>How delivery verification works</summary>
          <p>
            Start trip → Mark arrived → Verify delivery OTP → Record actual
            litres and Complete delivery. Verification controls appear after
            ARRIVED; completed trips show their saved verification and audit
            history.
          </p>
        </details>
        <p>
          {demo
            ? "In the fictional demonstration, the operator selects Generate demo OTP after arrival. This is simulated evidence, not independent delivery proof."
            : "After arrival, the designated citizen opens their own report and selects Get recipient delivery code. The assigned operator enters that code; external messaging requires a configured recipient adapter."}
        </p>
      </section>
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
