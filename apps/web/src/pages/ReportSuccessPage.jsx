import { Link, useSearchParams } from "react-router-dom";
import useReportData from "../hooks/useReportData.js";
import ReportFeedback from "../components/ReportFeedback.jsx";

function Confirmation({ id }) {
  const state = useReportData({ id });
  return (
    <>
      <ReportFeedback {...state} />
      {state.data && (
        <section className="empty-card">
          <span className="status-badge healthy">Report received</span>
          <h1 className="status-heading">Your report has been received.</h1>
          <p>Your household report is saved in AquaShield.</p>
          <dl className="service-list">
            <div>
              <dt>Report ID</dt>
              <dd className="report-id">{state.data.id}</dd>
            </div>
            <div>
              <dt>Verification status</dt>
              <dd>Pending verification</dd>
            </div>
          </dl>
          <div className="form-actions">
            <Link className="button" to={`/report/${id}`}>
              Track this report
            </Link>
            <Link to="/my-reports">View my reports</Link>
          </div>
        </section>
      )}
    </>
  );
}

export default function ReportSuccessPage() {
  const [params] = useSearchParams();
  const id = params.get("id");
  return (
    <div className="page report-page">
      <p className="eyebrow">Citizen reporting</p>
      {id && /^[a-f0-9]{24}$/i.test(id) ? (
        <Confirmation id={id} />
      ) : (
        <div className="empty-card">
          <h1 className="status-heading">No submission to display.</h1>
          <p>Submit a report or open your report history.</p>
          <Link className="button" to="/my-reports">
            My reports
          </Link>
        </div>
      )}
    </div>
  );
}
