import { Link, useParams } from "react-router-dom";
import useReportData from "../hooks/useReportData.js";
import ReportFeedback from "../components/ReportFeedback.jsx";
import ReportDetails from "../components/ReportDetails.jsx";

export default function ReportStatusPage() {
  const { id } = useParams();
  const state = useReportData({ id });
  return (
    <div className="page report-page">
      <p className="eyebrow">Citizen reporting</p>
      <h1 className="page-title">Report status</h1>
      <p className="page-intro">
        Follow the details you shared with AquaShield.
      </p>
      <ReportFeedback {...state} />
      {state.data && (
        <section className="report-detail-card">
          <ReportDetails report={state.data} />
        </section>
      )}
      <div className="form-actions">
        <Link className="button button-secondary" to="/my-reports">
          My reports
        </Link>
        {state.data && (
          <button className="button button-secondary" onClick={state.refresh}>
            Refresh status
          </button>
        )}
      </div>
    </div>
  );
}
