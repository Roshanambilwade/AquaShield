import { Link, useParams } from "react-router-dom";
import RoleGuard from "../components/RoleGuard.jsx";
import TripCard from "../components/TripCard.jsx";
import useAdminData from "../hooks/useAdminData.js";
export default function OperatorAssignmentPage() {
  return (
    <RoleGuard role="OPERATOR">
      <Assignment />
    </RoleGuard>
  );
}
function Assignment() {
  const { id } = useParams();
  const { data, error, refresh } = useAdminData(
    `/operator/assignments/${encodeURIComponent(id)}`,
  );
  return (
    <div className="page operations-page">
      <p className="eyebrow">Tanker operator</p>
      <h1 className="page-title">Assigned job</h1>
      <Link to="/operator">Return to assignments and history</Link>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading assigned job…</p>}
      <button className="button button-secondary" onClick={refresh}>
        Refresh assigned job
      </button>
      {data && <TripCard delivery={data.delivery} onChange={refresh} />}
    </div>
  );
}
