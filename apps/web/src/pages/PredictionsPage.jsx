import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import useAdminData from "../hooks/useAdminData.js";
import { adminRequest } from "../lib/adminApi.js";
import { useEnvironment } from "../lib/environment.js";
import PredictionChart from "../components/PredictionChart.jsx";
const time = (value) => (value ? new Date(value).toLocaleString() : "Unknown");
export default function PredictionsPage() {
  const [params] = useSearchParams(),
    env = useEnvironment();
  const demo = env.demonstration || params.get("demo") === "true";
  const [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [backtest, setBacktest] = useState(null),
    [history, setHistory] = useState(null),
    [page, setPage] = useState(1),
    [status, setStatus] = useState("");
  const summary = useAdminData(`/predictions?demo=${demo}`, refresh);
  const alerts = useAdminData(
    `/predictions/alerts?demo=${demo}&page=${page}&limit=10${status ? `&status=${status}` : ""}`,
    refresh,
  );
  const results = summary.data?.results || [];
  const result = results.find((r) => r.areaId === selected) || results[0];
  const current = result?.retrievalStatus === "CURRENT";
  async function perform(fn, message) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      setRefresh((n) => n + 1);
      setSuccess(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page shortage-page prediction-page">
      <p className="eyebrow">Municipal early warning · deterministic backend</p>
      <h1 className="page-title">Report activity forecasts</h1>
      <p>
        Identify changes in recorded water-problem reports. Predictions estimate
        reporting activity; they do not predict physical water depletion.
      </p>
      {demo && (
        <p className="demo-note">
          Simulated demonstration evidence. These results are not real-world
          forecast validation.
        </p>
      )}
      <div className="prediction-actions">
        <button
          className="button button-primary"
          disabled={busy || summary.loading}
          onClick={() =>
            perform(
              () =>
                adminRequest(`/predictions/evaluate?demo=${demo}`, {
                  method: "POST",
                  body: {},
                }),
              "Numerical evaluation completed and saved. No AI provider was requested.",
            )
          }
        >
          {busy ? "Working…" : "Evaluate current evidence"}
        </button>
        <span>Manual evaluation · no automatic monitoring or dispatch</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
      {summary.loading && <p role="status">Loading numerical predictions…</p>}
      {summary.error && (
        <div role="alert">
          <p>{summary.error}</p>
          <button onClick={summary.refresh}>Retry predictions</button>
        </div>
      )}
      {summary.data && (
        <>
          <div className="prediction-overview">
            <article className="prediction-stat">
              <span>Current high-risk areas</span>
              <strong>{summary.data.highRiskAreas}</strong>
              <small>HIGH or CRITICAL, with current evidence</small>
            </article>
            <article className="prediction-stat">
              <span>Forecast horizon</span>
              <strong>{summary.data.supportedHorizonHours} hours</strong>
              <small>One complete observation window</small>
            </article>
            <article className="prediction-stat">
              <span>Calculation method</span>
              <strong>Rule based</strong>
              <small>Available independently of Gemini</small>
            </article>
          </div>
          {!results.length && <p>No service areas are available.</p>}
          <div className="prediction-grid">
            <aside className="prediction-area-list" aria-label="Forecast areas">
              <h2>Service areas</h2>
              {results.map((r) => (
                <button
                  key={r.areaId}
                  className={r.areaId === result?.areaId ? "selected" : ""}
                  onClick={() => {
                    setSelected(r.areaId);
                    setHistory(null);
                    setBacktest(null);
                  }}
                >
                  <strong>{r.areaName}</strong>
                  <span>{r.riskLevel.replaceAll("_", " ")}</span>
                  <small>{r.retrievalStatus}</small>
                </button>
              ))}
            </aside>
            {result && (
              <article
                className="prediction-detail"
                aria-label={`Prediction for ${result.areaName}`}
              >
                <h2>{result.areaName}</h2>
                <p
                  className={`risk-label risk-${result.riskLevel.toLowerCase()}`}
                >
                  {result.riskLevel.replaceAll("_", " ")}
                  {result.riskScore != null &&
                    ` · ${result.riskScore}/100 index`}
                </p>
                <p>
                  Risk is an uncalibrated activity index, not a shortage
                  probability.
                </p>
                {result.retrievalStatus !== "CURRENT" && (
                  <p role="status">
                    {result.retrievalStatus === "NOT_EVALUATED"
                      ? "No evaluation has been saved. Evaluate current evidence to assess data support."
                      : `${result.retrievalStatus}: this saved assessment is not a current prediction. Run a new evaluation.`}
                  </p>
                )}
                <dl className="prediction-facts">
                  <div>
                    <dt>Observed operational severity</dt>
                    <dd>
                      {result.currentSeverity
                        ? `${result.currentSeverity.level} · ${result.currentSeverity.score}/100`
                        : "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt>Shortage existence confidence</dt>
                    <dd>
                      {result.currentSeverity
                        ? `${result.currentSeverity.shortageConfidence}% (observed evidence)`
                        : "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt>Approximate eligible reports</dt>
                    <dd>
                      {current && result.forecast
                        ? `≈ ${result.forecast.estimatedEligibleReportCount} over ${result.horizonHours} hours`
                        : "INSUFFICIENT_DATA or unavailable current forecast"}
                    </dd>
                  </div>
                  <div>
                    <dt>Generated</dt>
                    <dd>{time(result.generatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Observation period</dt>
                    <dd>
                      {time(result.observationWindow?.start)} →{" "}
                      {time(result.observationWindow?.end)}
                    </dd>
                  </div>
                  <div>
                    <dt>Forecast period</dt>
                    <dd>
                      {time(result.forecast?.start)} →{" "}
                      {time(result.forecast?.end)}
                    </dd>
                  </div>
                  <div>
                    <dt>Freshness / uncertainty</dt>
                    <dd>
                      {result.quality?.freshness || "Unknown"} /{" "}
                      {result.uncertainty?.level || "UNAVAILABLE"}
                    </dd>
                  </div>
                </dl>
                {result.quality && (
                  <p>
                    {result.quality.sampleSize} eligible reports ·{" "}
                    {result.quality.distinctReporters} reporter keys (not
                    verified identities) · {result.quality.verifiedCount}{" "}
                    verified · {result.quality.unverifiedCount} unverified ·{" "}
                    {result.quality.excludedCount} excluded ·{" "}
                    {result.quality.coveredWindows}/
                    {result.quality.totalWindows} sampled windows.
                  </p>
                )}
                {!!result.reasons?.length && (
                  <p>
                    Evidence limits:{" "}
                    {result.reasons.join(", ").replaceAll("_", " ")}
                  </p>
                )}
                {result.observed && <PredictionChart result={result} />}
                {result.factors && (
                  <details>
                    <summary>Calculation factors and uncertainty</summary>
                    <p>
                      Baseline: {result.factors.baselineReportsPerWindow}{" "}
                      reports/window · recent EWMA:{" "}
                      {result.factors.recentEwmaReportsPerWindow} · relative
                      change: {result.factors.relativeChange}
                    </p>
                    <p>
                      Trend × 50 + persistence × 35 + recurrence × 15, bounded
                      to 0–100.
                    </p>
                    <p>
                      Sensitivity range:{" "}
                      {result.forecast?.sensitivityRange.join("–")} reports; not
                      a confidence interval.
                    </p>
                    {result.uncertainty.reasons.map((r) => (
                      <p key={r}>{r}</p>
                    ))}
                    <p>
                      Version: {result.modelVersion} · {result.configVersion}
                    </p>
                  </details>
                )}
                <p>
                  <strong>Rule-based recommendation:</strong>{" "}
                  {result.recommendedAction ||
                    "Collect adequate historical observations before relying on a forecast."}
                </p>
                <p>
                  AI explanation is optional. No provider call is required for
                  this page, evaluation, or alert actions.
                </p>
                <div className="prediction-actions">
                  <button
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        setHistory(
                          await adminRequest(
                            `/predictions/areas/${result.areaId}/history?demo=${demo}&limit=10`,
                          ),
                        );
                      }, "Saved forecast history loaded.")
                    }
                  >
                    View forecast history
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        setBacktest(
                          await adminRequest(
                            `/predictions/backtest?demo=${demo}`,
                            { method: "POST", body: { areaId: result.areaId } },
                          ),
                        );
                      }, "Backtest completed using past-only observations.")
                    }
                  >
                    Backtest report activity
                  </button>
                </div>
                {history && (
                  <div>
                    <h3>Saved forecast history</h3>
                    {history.results.length ? (
                      history.results.map((r) => (
                        <p key={`${r.generatedAt}-${r.configVersion}`}>
                          {time(r.generatedAt)} · {r.riskLevel} ·{" "}
                          {r.riskScore ?? "Unknown"} · {r.retrievalStatus}
                        </p>
                      ))
                    ) : (
                      <p>No saved forecasts.</p>
                    )}
                    {history.hasMore && (
                      <p>
                        Showing the latest ten evaluations; older records remain
                        available through the paginated API.
                      </p>
                    )}
                  </div>
                )}
                {backtest && (
                  <div role="status">
                    <h3>Historical validation</h3>
                    <p>
                      {backtest.validationStatus} · {backtest.sampleCount}{" "}
                      eligible cutoffs · MAE:{" "}
                      {backtest.meanAbsoluteError ?? "Unknown"}
                    </p>
                    <p>
                      {backtest.provenance} · {backtest.limitation}
                    </p>
                  </div>
                )}
              </article>
            )}
          </div>
        </>
      )}
      <section className="prediction-alerts" aria-label="Early warning alerts">
        <h2>Early warning alerts</h2>
        <label>
          Alert status{" "}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {["ACTIVE", "ACKNOWLEDGED", "RESOLVED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {alerts.loading && <p role="status">Loading alerts…</p>}
        {alerts.error && (
          <div role="alert">
            <p>{alerts.error}</p>
            <button onClick={alerts.refresh}>Retry alerts</button>
          </div>
        )}
        {alerts.data && !alerts.data.alerts.length && (
          <p>
            No alerts in this view. Only supported HIGH or CRITICAL activity
            creates a new alert.
          </p>
        )}
        {alerts.data?.alerts.map((a) => (
          <article
            key={a.id}
            className="prediction-alert"
            aria-label={`Alert for ${a.areaName}`}
          >
            <h3>{a.areaName}</h3>
            <p>
              {a.status} · {a.result.riskLevel} · revision {a.revision} · cycle{" "}
              {a.cycle}
            </p>
            <p>
              {a.result.retrievalStatus} · generated{" "}
              {time(a.result.generatedAt)}
            </p>
            <p>{a.result.recommendedAction}</p>
            <AlertControls
              alert={a}
              demo={demo}
              busy={busy}
              perform={perform}
            />
            <details>
              <summary>Alert audit history</summary>
              {a.audit.map((row) => (
                <p key={row.revision}>
                  {time(row.at)} · {row.type} · revision {row.revision}
                  {row.note && ` · ${row.note}`}
                </p>
              ))}
            </details>
          </article>
        ))}
        <div className="prediction-actions">
          <button
            disabled={page === 1 || alerts.loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous alerts
          </button>
          <span>Page {page}</span>
          <button
            disabled={!alerts.data?.hasMore || alerts.loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next alerts
          </button>
        </div>
      </section>
    </div>
  );
}
function AlertControls({ alert, demo, busy, perform }) {
  const [note, setNote] = useState("");
  if (alert.status === "RESOLVED")
    return (
      <p>
        Resolved by municipal review; this is not proof that water supply has
        recovered.
      </p>
    );
  const action = alert.status === "ACTIVE" ? "acknowledge" : "resolve";
  return (
    <div className="prediction-actions">
      {action === "resolve" && (
        <label>
          Resolution reason{" "}
          <input
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}
      <button
        disabled={busy || (action === "resolve" && !note.trim())}
        onClick={() =>
          perform(
            () =>
              adminRequest(
                `/predictions/alerts/${alert.id}/${action}?demo=${demo}`,
                {
                  method: "POST",
                  body: { revision: alert.revision, note: note.trim() },
                },
              ),
            action === "acknowledge"
              ? "Alert acknowledged."
              : "Alert resolved by municipal review. Shortage and tanker states are unchanged.",
          )
        }
      >
        {action === "acknowledge" ? "Acknowledge alert" : "Resolve alert"}
      </button>
    </div>
  );
}
