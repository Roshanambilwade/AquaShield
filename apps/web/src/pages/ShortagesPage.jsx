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
  DecisionQueue,
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
  const [selectedId, setSelectedId] = useState(undefined);
  const [areaFilter, setAreaFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [running, setRunning] = useState(false);
  const [actionError, setActionError] = useState("");
  const visibleEvents = (state.data?.events || []).filter(
    (event) =>
      event.areaName.toLowerCase().includes(areaFilter.trim().toLowerCase()) &&
      (!severityFilter || event.severityLevel === severityFilter) &&
      (!statusFilter || event.status === statusFilter),
  );
  const selected =
    selectedId === null
      ? null
      : visibleEvents.find((event) => event.id === selectedId) ||
        visibleEvents[0];
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
            Locate urgent needs, assess evidence and coordinate the response.
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
          Simulated reports and municipal observations · calculated from
          recorded inputs.
        </p>
      )}
      {!admin && (
        <p className="evidence-note">
          Public evidence protects small household groups. Population estimates
          are approximate; an assignment does not confirm delivery.
        </p>
      )}
      {admin && (
        <div className="dashboard-context">
          <nav className="context-links" aria-label="Municipal next steps">
            {[
              ["reports", "Review evidence"],
              ["allocations", "Review fair allocation"],
              ["deliveries", "Inspect trips"],
              ["predictions", "Explore report-activity forecasts"],
            ].map(([path, label]) => (
              <Link key={path} to={`/admin/${path}${demo ? "?demo=true" : ""}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
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
                Review incoming household reports and their verification status.
                A shortage zone appears when enough supported evidence is
                available.
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
              <section
                className="map-filters"
                aria-label="Shortage map filters"
              >
                <label>
                  Map area
                  <input
                    aria-label="Map area"
                    value={areaFilter}
                    placeholder="Search an area"
                    onChange={(e) => {
                      setAreaFilter(e.target.value);
                      setSelectedId(undefined);
                    }}
                  />
                </label>
                <label>
                  Map severity
                  <select
                    aria-label="Map severity"
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                      setSelectedId(undefined);
                    }}
                  >
                    <option value="">All severities</option>
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Map event status
                  <select
                    aria-label="Map event status"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setSelectedId(undefined);
                    }}
                  >
                    <option value="">All statuses</option>
                    {[
                      ...new Set(
                        state.data.events.map((event) => event.status),
                      ),
                    ].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="button button-secondary"
                  onClick={() => setSelectedId(null)}
                  disabled={!selected}
                >
                  Clear selection
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    setAreaFilter("");
                    setSeverityFilter("");
                    setStatusFilter("");
                    setSelectedId(undefined);
                  }}
                >
                  Reset map filters
                </button>
                <p role="status">
                  {visibleEvents.length} of {state.data.events.length} shortage
                  zones shown. Filters apply to zones; report and tanker layers
                  show recorded locations.
                </p>
              </section>
              <div className="detection-grid">
                <div>
                  {admin && <DataFeedback state={map} label="map layers" />}
                  <ShortageMap
                    events={visibleEvents}
                    selectedId={selected?.id}
                    onSelect={setSelectedId}
                    admin={admin}
                    layers={map.data}
                  />
                </div>
                <div className="zone-list" aria-label="Shortage zones">
                  {!visibleEvents.length && (
                    <p className="empty-card">
                      No shortage zones match these filters. Reset the map
                      filters to see available evidence.
                    </p>
                  )}
                  {visibleEvents.map((e) => (
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
                  <ShortageDetails event={selected} compact={admin} />
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
                  events={visibleEvents}
                  onSelect={setSelectedId}
                />
              )}
            </>
          )}
          <p className="evidence-note">
            Emerging zones indicate limited evidence of a current problem.
            Numerical report-activity forecasts are evaluated separately on the
            early-warning dashboard. Population totals are approximate and may
            overlap across separate time-window events.
          </p>
        </>
      )}
      {admin && <DecisionQueue state={analytics} demo={demo} />}
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
