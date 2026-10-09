import { Link, useParams, useSearchParams } from "react-router-dom";
import useShortages from "../hooks/useShortages.js";
import ShortageDetails from "../components/ShortageDetails.jsx";
import { OperationalDetails } from "../components/AdminDashboardPanels.jsx";

export default function ShortageStatusPage({ admin = false }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const demo = params.get("demo") === "true";
  const state = useShortages(demo, id, admin);
  return (
    <div className="page shortage-page">
      <p className="eyebrow">Shortage event</p>
      <h1 className="page-title">Evidence and severity</h1>
      {state.loading && <p role="status">Loading shortage evidence…</p>}
      {state.error && (
        <div role="alert" className="report-error">
          <p>{state.error}</p>
          <button className="button button-secondary" onClick={state.refresh}>
            Try again
          </button>
        </div>
      )}
      {state.data && (
        <div className="event-panel">
          <ShortageDetails event={state.data} />
          {admin && <OperationalDetails id={id} demo={demo} />}
        </div>
      )}
      <Link
        className="button button-secondary"
        to={`/${admin ? "admin" : "alerts"}?demo=${demo}`}
      >
        Back to shortage overview
      </Link>
    </div>
  );
}
