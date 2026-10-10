import useAdminData from "../hooks/useAdminData.js";
import AiRecommendationPanel from "./AiRecommendationPanel.jsx";
import { Link } from "react-router-dom";

export function AdminMetrics({ state }) {
  const labels = {
    activeShortages: "Active Shortages",
    criticalAreas: "Critical Areas",
    estimatedPeopleAffected: "Estimated People Affected",
    availableTankers: "Available Tankers",
    tankersEnRoute: "Tankers En Route",
    waterDelivered: "Water Delivered",
    averageResponseTime: "Average Response Time",
    highRiskAreas: "High-Risk Areas",
  };
  return (
    <section aria-label="Command center metrics">
      <DataFeedback state={state} label="dashboard summary" />
      <div className="dashboard-kpis admin-kpis">
        {Object.entries(labels).map(([key, label]) => {
          const metric = state.data?.metrics[key];
          const value = metric?.value;
          return (
            <article className="metric-card" key={key} aria-label={label}>
              <span>{label}</span>
              <strong>
                {state.loading
                  ? "…"
                  : value == null
                    ? "Unknown"
                    : `${metric.kind === "ESTIMATE" ? "~" : ""}${value.toLocaleString()}${key === "waterDelivered" ? " L" : key === "averageResponseTime" ? " min" : ""}`}
              </strong>
              <small>
                {metric?.note ||
                  (value == null
                    ? "Data unavailable"
                    : state.data?.isDemo
                      ? "Simulated records"
                      : "Recorded evidence")}
              </small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function DataFeedback({ state, label }) {
  if (state.loading)
    return (
      <p className="evidence-note" role="status">
        Loading {label}…
      </p>
    );
  if (state.error)
    return (
      <div role="alert" className="report-error">
        <p>{state.error}</p>
        <button className="button button-secondary" onClick={state.refresh}>
          Retry {label}
        </button>
      </div>
    );
  return null;
}

export function AdminPanels({ summary, analytics, demo, event }) {
  return (
    <div className="admin-panels">
      <AiRecommendationPanel
        key={`${demo}:${event?.id}:${event?.calculatedAt}`}
        demo={demo}
        event={event}
        configuration={summary.data?.ai}
      />
      <section className="admin-panel">
        <h2>Areas requiring attention</h2>
        <p>
          {summary.data
            ? `${summary.data.emergingAreas} emerging zone${summary.data.emergingAreas === 1 ? "" : "s"} require independent evidence and field assessment.`
            : "Emerging evidence is being loaded."}
        </p>
        <p className="evidence-note">
          Emerging reports describe current evidence. Numerical report-activity
          forecasts require sufficient historical observations.
        </p>
        <Link
          className="button button-secondary"
          to={`/admin/predictions${demo ? "?demo=true" : ""}`}
        >
          Review early warning
        </Link>
      </section>
      <section
        className="admin-panel activity-panel"
        aria-label="Recent activity"
      >
        <h2>Recent activity</h2>
        <DataFeedback state={summary} label="recent activity" />
        {summary.data && !summary.data.activity.length && (
          <p>No recorded report activity yet.</p>
        )}
        <ol>
          {summary.data?.activity.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>Report received · {entry.area}</strong>
                <span>
                  {entry.verificationStatus}
                  {entry.isDemo ? " · simulated" : ""}
                </span>
              </div>
              <time dateTime={entry.timestamp}>
                {new Date(entry.timestamp).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      </section>
      <AnalyticsPanel state={analytics} />
    </div>
  );
}

export function AnalyticsPanel({ state }) {
  return (
    <section
      className="admin-panel analytics-panel"
      aria-label="Shortage analytics"
    >
      <h2>Evidence analytics</h2>
      <DataFeedback state={state} label="analytics" />
      {state.data && (
        <>
          <h3>Severity distribution</h3>
          <div className="severity-bars">
            {state.data.severityDistribution.map((entry) => (
              <div key={entry.level}>
                <span>{entry.level}</span>
                <meter
                  min="0"
                  max={Math.max(
                    1,
                    ...state.data.severityDistribution.map((r) => r.count),
                  )}
                  value={entry.count}
                  aria-label={`${entry.level} events`}
                />
                <strong>{entry.count}</strong>
              </div>
            ))}
          </div>
          <h3>Reports by hour</h3>
          {!state.data.reportsByHour.length ? (
            <p>No submissions available.</p>
          ) : (
            <div
              className="hourly-chart"
              role="img"
              aria-label="Report counts for the latest reporting hours"
            >
              {state.data.reportsByHour.map((entry) => (
                <div key={entry.hour}>
                  <span
                    style={{
                      height: `${Math.max(4, (entry.count / Math.max(...state.data.reportsByHour.map((r) => r.count))) * 100)}%`,
                    }}
                  />
                  <strong>{entry.count}</strong>
                  <small>
                    {new Date(entry.hour).toLocaleString(undefined, {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                    })}
                  </small>
                </div>
              ))}
            </div>
          )}
          <dl className="analytics-evidence">
            {Object.entries(state.data.evidence).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {
                    {
                      eligibleHouseholds: "Eligible household submissions",
                      verifiedReports: "Verified reports",
                      duplicateReports: "Repeated reports excluded",
                      suspiciousReports: "Suspicious reports excluded",
                    }[key]
                  }
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="evidence-note">
            {state.data.note}
            {state.data.isDemo ? " All records shown are simulated." : ""}
          </p>
          {state.data.operational && (
            <section aria-label="Operational fairness analytics">
              <h3>Recorded water response by area</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Assignments</th>
                      <th>Recorded water delivered</th>
                      <th>Average response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.operational.areas.map((a, i) => (
                      <tr key={i}>
                        <td>{a.area}</td>
                        <td>{a.allocations ?? "Unknown"}</td>
                        <td>
                          {a.deliveredLitres == null
                            ? "Unknown"
                            : `${a.deliveredLitres.toLocaleString()} L`}
                        </td>
                        <td>
                          {a.averageResponseMinutes == null
                            ? "Unknown"
                            : `${a.averageResponseMinutes} min`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Recorded fleet utilization:{" "}
                {state.data.operational.utilizationPercent == null
                  ? "Unknown"
                  : `${state.data.operational.utilizationPercent}%`}{" "}
                (current snapshot).
              </p>
              <h3>High-priority areas requiring support review</h3>
              {state.data.operational.unservedHighPriorityAreas.length ? (
                <ul>
                  {state.data.operational.unservedHighPriorityAreas.map(
                    (a, i) => (
                      <li key={i}>
                        {a.area} · {a.severity} ·{" "}
                        {a.deliveryRecorded == null
                          ? "Delivery history unknown"
                          : "No accepted delivery recorded"}
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p>No such areas in the current evidence.</p>
              )}
              <p className="evidence-note">{state.data.operational.note}</p>
            </section>
          )}
        </>
      )}
    </section>
  );
}

export function OperationalDetails({ id, demo, revision = 0 }) {
  const state = useAdminData(
    `/dashboard/shortages/${id}?demo=${demo}`,
    revision,
  );
  return (
    <section
      className="operational-detail"
      aria-label="Municipal assessment context"
    >
      <DataFeedback state={state} label="assessment context" />
      {state.data && (
        <>
          <h3>Current household water levels</h3>
          <p>
            Citizen-reported categories across cluster submissions; these are
            not sensor measurements.
          </p>
          <div className="water-categories">
            {Object.entries(state.data.waterLevels).map(([level, count]) => (
              <span key={level}>
                {level.replaceAll("_", " ")}: {count} reports
              </span>
            ))}
          </div>
          <h3>Previous delivery</h3>
          <p>
            {state.data.previousDelivery
              ? `${state.data.previousDelivery.litres.toLocaleString()} L recorded, verification complete · ${new Date(state.data.previousDelivery.deliveredAt).toLocaleString()}${state.data.previousDelivery.isDemo ? " (simulated)" : ""}`
              : state.data.deliveryDataAvailable
                ? "No verified delivery recorded for this area."
                : "Unknown — delivery records are not configured."}
          </p>
          <h3>Recommended assessment action</h3>
          <p>{state.data.recommendedAction.text}</p>
          <p className="evidence-note">
            Deterministic assessment guidance; this is not an AI recommendation
            or an allocation decision.
          </p>
        </>
      )}
    </section>
  );
}
