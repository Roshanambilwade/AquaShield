import { Link, useParams } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../lib/authContext.js";
import { portalHome } from "../lib/portalAccess.js";
import useReportData from "../hooks/useReportData.js";
import ReportFeedback from "../components/ReportFeedback.jsx";
import ReportDetails from "../components/ReportDetails.jsx";

export default function ReportStatusPage() {
  const auth = useContext(AuthContext);
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
        {state.code !== "CITIZEN_REQUIRED" && (
          <Link
            className="button button-secondary"
            to={
              auth.user && auth.user.role !== "CITIZEN"
                ? portalHome(auth.user.role)
                : "/my-reports"
            }
          >
            {auth.user && auth.user.role !== "CITIZEN"
              ? "Return to your portal"
              : "My reports"}
          </Link>
        )}
        {state.data && (
          <button className="button button-secondary" onClick={state.refresh}>
            Refresh status
          </button>
        )}
      </div>
    </div>
  );
}
