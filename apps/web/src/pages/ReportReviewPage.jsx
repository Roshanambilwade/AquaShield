import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { adminRequest } from "../lib/adminApi.js";
import ReportDetails from "../components/ReportDetails.jsx";
import {
  PROBLEM_OPTIONS,
  optionLabel,
} from "../../../../packages/shared/reportOptions.js";
export default function ReportReviewPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const demo = useEnvironment().demonstration || params.get("demo") === "true";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [state, setState] = useState({}),
    [attempt, setAttempt] = useState(0);
  const path = id
    ? `/dashboard/reports/${id}?demo=${demo}`
    : `/dashboard/reports?demo=${demo}&page=${page}`;
  const key = `${path}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    adminRequest(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setState({ key, error: e.message });
      });
    return () => controller.abort();
  }, [path, key]);
  const current = state.key === key ? state : {};
  return (
    <div className="page report-page">
      <p className="eyebrow">Municipal report assessment</p>
      <h1 className="page-title">
        {id ? "Report source and evidence" : "Citizen reports"}
      </h1>
      <p className="page-intro">
        Account contact and household details are provided by users. Identity
        and residency are not verified.
      </p>
      {demo && (
        <p className="demo-note">
          Fictional demo reports; no real account contact information.
        </p>
      )}
      {!current.data && !current.error && (
        <p role="status">Loading report evidence…</p>
      )}
      {current.error && (
        <p role="alert">
          {current.error}{" "}
          <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </p>
      )}
      {current.data &&
        (id ? (
          <section className="report-detail-card">
            <Reporter reporter={current.data.reporter} />
            <ReportDetails report={current.data} />
            <ReviewControls
              report={current.data}
              demo={demo}
              refresh={() => setAttempt((n) => n + 1)}
            />
          </section>
        ) : (
          <>
            {!current.data.reports.length && (
              <p>No reports for this evidence source.</p>
            )}
            <ul className="report-list">
              {current.data.reports.map((r) => (
                <li key={r.id}>
                  <article className="report-card">
                    <h2>{r.locality}</h2>
                    <p>
                      {optionLabel(PROBLEM_OPTIONS, r.problem)} ·{" "}
                      {new Date(r.createdAt).toLocaleString()} ·{" "}
                      {r.verificationStatus}
                    </p>
                    <Reporter reporter={r.reporter} />
                    <Link to={`/admin/reports/${r.id}?demo=${demo}`}>
                      Review report evidence
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
            <div className="pagination">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() =>
                  setParams({ demo: String(demo), page: String(page - 1) })
                }
              >
                Previous
              </button>
              <span>
                Page {page} · {current.data.pagination.total} reports
              </span>
              <button
                className="button button-secondary"
                disabled={page >= current.data.pagination.pages}
                onClick={() =>
                  setParams({ demo: String(demo), page: String(page + 1) })
                }
              >
                Next
              </button>
            </div>
          </>
        ))}
      {id && (
        <Link to={`/admin/reports?demo=${demo}`}>Back to citizen reports</Link>
      )}
    </div>
  );
}
function Reporter({ reporter }) {
  return (
    <section className="reporter-source">
      <h3>Reporter source</h3>
      <p>{reporter.name || "No linked citizen account"}</p>
      <p>
        {reporter.email
          ? `${reporter.email} · Email ${reporter.emailVerified ? "verified" : "unverified"}`
          : "Contact information unknown"}
      </p>
      <p>
        {reporter.source === "SIMULATED_DEMO"
          ? "Simulated demo"
          : reporter.source === "LEGACY_OR_IMPORTED"
            ? "Legacy / imported report"
            : "Citizen account"}
      </p>
      <p>{reporter.note}</p>
    </section>
  );
}
function ReviewControls({ report, demo, refresh }) {
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function review(status) {
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest(
        `/dashboard/reports/${report.id}/review?demo=${demo}`,
        { method: "POST", body: { status, note } },
      );
      if (result.assessmentRefresh === "PENDING_RETRY")
        setError(
          "Review saved; derived assessment refresh is pending. Refresh the shortage view to retry detection.",
        );
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Administrator evidence review">
      <h2>Evidence review</h2>
      <p>
        Current review state: {report.verificationStatus}. This reviews
        submitted evidence, not a physical field inspection, identity check,
        household receipt or resolution of the shortage.
      </p>
      {demo && (
        <p className="demo-note">
          Simulated administrator review of demonstration evidence.
        </p>
      )}
      {report.verificationStatus === "PENDING" && (
        <>
          <label>
            Review note (required)
            <textarea
              value={note}
              minLength={5}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="prediction-actions">
            <button
              disabled={busy || note.trim().length < 5}
              onClick={() => review("VERIFIED")}
            >
              Verify submitted evidence
            </button>
            <button
              disabled={busy || note.trim().length < 5}
              onClick={() => review("REJECTED")}
            >
              Reject report
            </button>
          </div>
        </>
      )}
      {busy && <p role="status">Saving review…</p>}
      {error && <p role="alert">{error}</p>}
      {report.reviewNote && <p>Recorded review note: {report.reviewNote}</p>}
      {report.reviewHistory?.map((a) => (
        <p key={a._id}>
          {a.action} · {new Date(a.at).toLocaleString()} · {a.reason}
        </p>
      ))}
    </section>
  );
}
import { useEnvironment } from "../lib/environment.js";
