import { Link, useSearchParams } from "react-router-dom";
import {
  PROBLEM_OPTIONS,
  optionLabel,
} from "../../../../packages/shared/reportOptions.js";
import useReportData from "../hooks/useReportData.js";
import ReportFeedback from "../components/ReportFeedback.jsx";
import CitizenAccess from "../components/CitizenAccess.jsx";
import { useEnvironment } from "../lib/environment.js";

export default function ReportHistoryPage() {
  const [params] = useSearchParams();
  const environment = useEnvironment();
  return !environment.demonstration && params.get("demo") === "true" ? (
    <ReportHistory />
  ) : (
    <CitizenAccess>
      <ReportHistory />
    </CitizenAccess>
  );
}
function ReportHistory() {
  const [params, setParams] = useSearchParams();
  const environment = useEnvironment();
  const demo = !environment.demonstration && params.get("demo") === "true";
  const candidatePage = Number(params.get("page") || 1);
  const page =
    Number.isInteger(candidatePage) &&
    candidatePage > 0 &&
    candidatePage <= 10000
      ? candidatePage
      : 1;
  const state = useReportData({ page, demo });
  function goToPage(value) {
    setParams({ page: String(value), ...(demo ? { demo: "true" } : {}) });
  }
  return (
    <div className="page report-page">
      <p className="eyebrow">Citizen reporting</p>
      <h1 className="page-title">{demo ? "Demo reports" : "My reports"}</h1>
      <p className="page-intro">
        {demo
          ? "Fictional reports for exploring the citizen reporting flow. No real shortage or response is represented."
          : "Reports belonging to your citizen account. Sign in again to revisit your saved history."}
      </p>
      <div className="history-toolbar">
        <Link className="button" to="/report">
          Report water shortage
        </Link>
        {!environment.demonstration && (
          <Link to={demo ? "/my-reports" : "/my-reports?demo=true"}>
            {demo ? "View my reports" : "View simulated demo reports"}
          </Link>
        )}
      </div>
      <ReportFeedback {...state} />
      {state.data &&
        (state.data.reports.length ? (
          <>
            <ul className="report-list">
              {state.data.reports.map((report) => (
                <li key={report.id}>
                  <article className="report-card">
                    <div className="card-top">
                      <span>{new Date(report.createdAt).toLocaleString()}</span>
                      <span className="status-badge degraded">
                        {report.verificationStatus === "VERIFIED"
                          ? report.isDemo
                            ? "Verified (simulated)"
                            : "Verified"
                          : report.verificationStatus === "REJECTED"
                            ? "Rejected"
                            : "Pending verification"}
                      </span>
                    </div>
                    <h2>{report.locality}</h2>
                    <p>
                      {optionLabel(PROBLEM_OPTIONS, report.problem)} · Household
                      size: {report.householdSize}
                    </p>
                    {report.responseStatus && (
                      <p>
                        Municipal response:{" "}
                        {report.responseStatus.status === "ASSIGNED"
                          ? "Tanker assigned to area"
                          : report.responseStatus.status === "EN_ROUTE"
                            ? "Tanker en route to area"
                            : report.responseStatus.status === "ARRIVED"
                              ? "Tanker arrived at area"
                              : report.responseStatus.status === "DELIVERED"
                                ? "Water delivery recorded for area"
                                : report.responseStatus.status === "UNKNOWN"
                                  ? "Unknown"
                                  : "Area response approved"}
                        . This does not confirm household delivery or report
                        verification.
                      </p>
                    )}
                    {report.isDemo && (
                      <span className="phase-badge">Simulated demo</span>
                    )}
                    <Link to={`/report/${report.id}`}>
                      View report <span aria-hidden="true">↗</span>
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
            <div className="pagination">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {state.data.pagination.pages}
              </span>
              <button
                className="button button-secondary"
                disabled={page >= state.data.pagination.pages}
                onClick={() => goToPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <section className="empty-card">
            <h2>{demo ? "No demo reports yet." : "No reports here yet."}</h2>
            <p>
              {demo
                ? "No simulated reports match this view. Submit a report through the normal reporting form; existing records are preserved."
                : "When you submit a water problem, your report will appear here."}
            </p>
            <Link className="button button-secondary" to="/report">
              Submit your first report
            </Link>
          </section>
        ))}
    </div>
  );
}
