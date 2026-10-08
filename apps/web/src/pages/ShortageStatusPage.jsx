import { Link, useParams, useSearchParams } from "react-router-dom";
import useShortages from "../hooks/useShortages.js";
import ShortageDetails from "../components/ShortageDetails.jsx";

export default function ShortageStatusPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const demo = params.get("demo") === "true";
  const state = useShortages(demo, id);
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
        </div>
      )}
      <Link className="button button-secondary" to={`/admin?demo=${demo}`}>
        Back to shortage overview
      </Link>
    </div>
  );
}
