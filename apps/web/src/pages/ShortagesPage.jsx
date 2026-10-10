import { useContext, useState } from "react";
import { AuthContext } from "../lib/authContext.js";
import { portalHome } from "../lib/portalAccess.js";
import { Link, useSearchParams } from "react-router-dom";
import useShortages from "../hooks/useShortages.js";
import ShortageMap from "../components/ShortageMap.jsx";
import ShortageDetails, {
  SeverityBadge,
} from "../components/ShortageDetails.jsx";
import { shortageRequest } from "../lib/shortages.js";
import useAdminData from "../hooks/useAdminData.js";
import {
  AdminMetrics,
  AdminPanels,
  DataFeedback,
  OperationalDetails,
} from "../components/AdminDashboardPanels.jsx";
import ShortageTable from "../components/ShortageTable.jsx";
import { useEnvironment } from "../lib/environment.js";

export default function ShortagesPage({ admin = false }) {
  const auth = useContext(AuthContext);
  const [params] = useSearchParams();
  const environment = useEnvironment();
  const demo = environment.demonstration || params.get("demo") === "true";
  const state = useShortages(demo, undefined, admin);
  const [revision, setRevision] = useState(0);
  const summary = useAdminData(
    admin ? `/dashboard/summary?demo=${demo}` : null,
    revision,
  );
  const map = useAdminData(
    admin ? `/dashboard/map?demo=${demo}` : null,
    revision,
  );
  const analytics = useAdminData(
    admin ? `/dashboard/analytics?demo=${demo}` : null,
    revision,
  );
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
      setRevision((n) => n + 1);
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
          <p className="eyebrow">
            {admin
              ? "Municipal water crisis command center"
              : "Public aggregate evidence"}
          </p>
          <h1 className="page-title">Water crisis overview</h1>
          <p className="page-intro">
            Local evidence, transparent confidence, and deterministic severity.
          </p>
        </div>
        <div className="dashboard-actions">
          {!environment.demonstration && (
            <Link
              className="button button-secondary"
              to={`/${admin ? "admin" : "alerts"}${demo ? "" : "?demo=true"}`}
            >
              {demo ? "View citizen evidence" : "View simulated scenarios"}
            </Link>
          )}
          {admin && (
            <button
              className="button"
              onClick={detect}
              disabled={running || state.loading}
            >
              {running ? "Detecting…" : "Run detection"}
            </button>
          )}
        </div>
      </div>
      {demo && (
        <p className="demo-note">
          Demo environment · simulated reports and municipal observations.
          Scores are calculated from persisted inputs; unknown evidence remains
          unknown.
        </p>
      )}
      <p className="evidence-note">
        Public evidence protects small household groups. Authorized municipal
        staff can review private evidence and manage approved tanker
        assignments. An assignment does not confirm delivery or field
        verification.
      </p>
      {admin && <AdminMetrics state={summary} />}
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
          {!admin && (
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
          )}
          {!state.data.events.length ? (
            <div className="empty-card">
              <h2>No shortage evidence yet.</h2>
              <p>
                Submit household reports to build a local evidence cluster, or
                seed the simulated scenarios with npm run seed:demo.
              </p>
              <Link
                className="button button-secondary"
                to={
                  admin
                    ? `/admin/reports${demo ? "?demo=true" : ""}`
                    : auth.user && auth.user.role !== "CITIZEN"
                      ? portalHome(auth.user.role)
                      : "/report"
                }
              >
                {admin
                  ? "Review citizen reports"
                  : auth.user && auth.user.role !== "CITIZEN"
                    ? "Return to your portal"
                    : "Report water shortage"}
              </Link>
              {admin &&
                map.data &&
                (map.data.reports.length > 0 ||
                  map.data.tankers.length > 0) && (
                  <ShortageMap
                    events={[]}
                    admin
                    layers={map.data}
                    onSelect={setSelectedId}
                  />
                )}
            </div>
          ) : (
            <>
              <div className="detection-grid">
                <div>
                  {admin && <DataFeedback state={map} label="map layers" />}
                  <ShortageMap
                    events={state.data.events}
                    selectedId={selected?.id}
                    onSelect={setSelectedId}
                    admin={admin}
                    layers={map.data}
                  />
                </div>
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
                  {admin && (
                    <OperationalDetails
                      id={selected.id}
                      demo={demo}
                      revision={revision}
                    />
                  )}
                  <Link
                    className="button button-secondary"
                    to={`/${admin ? "admin/shortages" : "alerts"}/${selected.id}?demo=${demo}`}
                  >
                    Open event details
                  </Link>
                </div>
              )}
              {admin && (
                <ShortageTable
                  events={state.data.events}
                  onSelect={setSelectedId}
                />
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
      {admin && (
        <AdminPanels
          summary={summary}
          analytics={analytics}
          demo={demo}
          event={selected}
        />
      )}
    </div>
  );
}
