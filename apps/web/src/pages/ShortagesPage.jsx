import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useShortages from "../hooks/useShortages.js";
import ShortageMap from "../components/ShortageMap.jsx";
import ShortageDetails, {
  SeverityBadge,
} from "../components/ShortageDetails.jsx";
import { shortageRequest } from "../lib/shortages.js";

export default function ShortagesPage() {
  const [params] = useSearchParams();
  const demo = params.get("demo") === "true";
  const state = useShortages(demo);
  const [selectedId, setSelectedId] = useState(null);
  const [running, setRunning] = useState(false);
  const [actionError, setActionError] = useState("");
  const selected =
    state.data?.events.find((e) => e.id === selectedId) ||
    state.data?.events[0];
  async function detect() {
    setRunning(true);
    setActionError("");
    try {
      await shortageRequest(demo, { method: "POST" });
      state.refresh();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="page shortage-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Municipal team · shortage detection</p>
          <h1 className="page-title">Water crisis overview</h1>
          <p className="page-intro">
            Local evidence, transparent confidence, and deterministic severity.
          </p>
        </div>
        <div className="dashboard-actions">
          <Link
            className="button button-secondary"
            to={demo ? "/admin" : "/admin?demo=true"}
          >
            {demo ? "View citizen evidence" : "View simulated scenarios"}
          </Link>
          <button
            className="button"
            onClick={detect}
            disabled={running || state.loading}
          >
            {running ? "Detecting…" : "Run detection"}
          </button>
        </div>
      </div>
      {demo && (
        <p className="demo-note">
          Demo environment · fictional data across five areas, observed on 8
          October 2026. Scores are calculated from the seeded inputs.
        </p>
      )}
      <p className="evidence-note">
        Aggregate evidence is visible here. Field verification and authorized
        response operations will be added in later phases.
      </p>
      {state.loading && (
        <p role="status" className="empty-card">
          Loading shortage evidence…
        </p>
      )}
      {(state.error || actionError) && (
        <div role="alert" className="report-error">
          <p>{state.error || actionError}</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setActionError("");
              state.refresh();
            }}
          >
            Try again
          </button>
        </div>
      )}
      {state.data && (
        <>
          <div className="dashboard-kpis">
            {[
              ["Active shortages", state.data.summary.activeShortages],
              ["Critical areas", state.data.summary.criticalAreas],
              [
                "Estimated people affected",
                `~${state.data.summary.estimatedPeopleAffected.toLocaleString()}`,
              ],
              ["Emerging zones", state.data.summary.emergingAreas],
            ].map(([label, value]) => (
              <div className="metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {!state.data.events.length ? (
            <div className="empty-card">
              <h2>No shortage evidence yet.</h2>
              <p>
                Submit household reports to build a local evidence cluster, or
                seed the simulated scenarios with npm run seed:demo.
              </p>
              <Link className="button button-secondary" to="/report">
                Report water shortage
              </Link>
            </div>
          ) : (
            <>
              <div className="detection-grid">
                <ShortageMap
                  events={state.data.events}
                  selectedId={selected?.id}
                  onSelect={setSelectedId}
                />
                <div className="zone-list" aria-label="Shortage zones">
                  {state.data.events.map((e) => (
                    <button
                      className={`zone-card ${selected?.id === e.id ? "selected" : ""}`}
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      aria-pressed={selected?.id === e.id}
                    >
                      <span>
                        <strong>{e.areaName}</strong>
                        <SeverityBadge level={e.severityLevel} />
                      </span>
                      <span>
                        Severity {e.severityScore}/100 · confidence{" "}
                        {e.confidenceScore}%
                      </span>
                      <span>
                        ~{e.estimatedAffectedPopulation} estimated people ·{" "}
                        {e.durationHours ?? "Unknown"} hours
                      </span>
                      <small>
                        {e.status === "EMERGING"
                          ? "Emerging risk · limited current evidence"
                          : e.status}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
              {selected && (
                <div className="event-panel">
                  <ShortageDetails event={selected} />
                  <Link
                    className="button button-secondary"
                    to={`/admin/shortages/${selected.id}?demo=${demo}`}
                  >
                    Open event details
                  </Link>
                </div>
              )}
            </>
          )}
          <p className="evidence-note">
            Emerging zones indicate limited evidence of a current problem; no
            future risk score or forecast is calculated in this phase.
            Population totals are approximate and may overlap across separate
            time-window events.
          </p>
        </>
      )}
    </div>
  );
}
