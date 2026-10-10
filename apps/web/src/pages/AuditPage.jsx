import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import useAdminData from "../hooks/useAdminData.js";
import { useEnvironment } from "../lib/environment.js";
import { DataFeedback } from "../components/AdminDashboardPanels.jsx";
import HistoryFilters from "../components/HistoryFilters.jsx";
import { initialWindow, windowQuery } from "../lib/historyWindow.js";
const targetTypes = [
  "REPORT",
  "ALLOCATION",
  "TANKER",
  "DELIVERY",
  "ALLOCATION_EVIDENCE",
  "EARLY_WARNING_ALERT",
];
function EventContext({ event }) {
  const paths = {
    REPORT: `/admin/reports/${event.targetId}`,
    ALLOCATION: "/admin/allocations",
    TANKER: "/admin/tankers",
    DELIVERY: "/admin/deliveries",
    ALLOCATION_EVIDENCE: "/admin/allocations",
    EARLY_WARNING_ALERT: "/admin/predictions",
  };
  return (
    <section className="admin-panel" aria-label="Audit event detail">
      <h2>{event.eventType}</h2>
      <dl className="audit-context">
        {[
          ["Event ID", event.id],
          [
            "Timestamp",
            event.timestamp
              ? new Date(event.timestamp).toISOString()
              : "Unknown",
          ],
          ["Actor ID", event.actorId],
          ["Authorized role at action", event.actorRole],
          ["Target type", event.targetType],
          ["Target ID", event.targetId],
          ["Correlation ID", event.correlationId],
          ["Outcome", event.outcome],
          [
            "Provenance",
            event.isDemo ? "Fictional demonstration" : "Operational",
          ],
        ].map(([label, v]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{v || "Unknown"}</dd>
          </div>
        ))}
      </dl>
      <div className="history-grid">
        {[
          ["Previous state", event.before],
          ["Resulting state", event.after],
        ].map(([label, v]) => (
          <section key={label}>
            <h3>{label}</h3>
            {Object.keys(v).length ? (
              <dl>
                {Object.entries(v).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>Unknown — not recorded.</p>
            )}
          </section>
        ))}
      </div>
      <p>{event.note}</p>
      <Link
        to={`${paths[event.targetType]}${event.isDemo ? "?demo=true" : ""}`}
      >
        Open authorized target records
      </Link>
    </section>
  );
}
export default function AuditPage() {
  const { id } = useParams(),
    [params] = useSearchParams();
  const demo = useEnvironment().demonstration || params.get("demo") === "true";
  const [values, setValues] = useState(() => ({
    ...initialWindow(),
    eventType: "",
    actorId: "",
    targetType: "",
    targetId: "",
    outcome: "",
    correlationId: "",
  }));
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  const state = useAdminData(
    id
      ? `/audit/${encodeURIComponent(id)}?demo=${demo}`
      : `/audit?demo=${demo}&limit=20&page=${page}${query}`,
  );
  const suffix = demo ? "?demo=true" : "";
  return (
    <div className="page shortage-page">
      <p className="eyebrow">Municipal accountability</p>
      <h1 className="page-title">{id ? "Audit event" : "Audit history"}</h1>
      {demo && (
        <p className="demo-note">
          Fictional demonstration journal; not real municipal activity.
        </p>
      )}
      {id ? (
        <Link to={`/admin/audit${suffix}`}>Back to audit history</Link>
      ) : (
        <form
          className="admin-panel history-filters"
          aria-label="Audit search"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const q = new URLSearchParams(windowQuery(values));
              for (const key of [
                "eventType",
                "actorId",
                "targetType",
                "targetId",
                "outcome",
                "correlationId",
              ])
                if (values[key].trim()) q.set(key, values[key].trim());
              setQuery(`&${q}`);
              setPage(1);
              setError("");
              state.refresh();
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <HistoryFilters values={values} setValues={setValues} />
          {["eventType", "actorId", "targetId", "correlationId"].map((key) => (
            <label key={key}>
              {
                {
                  eventType: "Event type",
                  actorId: "Actor ID",
                  targetId: "Target ID",
                  correlationId: "Correlation ID",
                }[key]
              }
              <input
                value={values[key]}
                maxLength={
                  key === "eventType" ? 64 : key === "correlationId" ? 36 : 24
                }
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            Target type
            <select
              aria-label="Target type"
              value={values.targetType}
              onChange={(e) =>
                setValues({ ...values, targetType: e.target.value })
              }
            >
              <option value="">All targets</option>
              {targetTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Outcome
            <select
              aria-label="Outcome"
              value={values.outcome}
              onChange={(e) =>
                setValues({ ...values, outcome: e.target.value })
              }
            >
              <option value="">All outcomes</option>
              {["SUCCESS", "FAILURE", "PENDING", "RECOVERED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button type="submit">Search audit history</button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
      <DataFeedback state={state} label="audit history" />
      {state.data &&
        (id ? (
          <EventContext event={state.data} />
        ) : (
          <section className="admin-panel" aria-label="Audit search results">
            <h2>Recorded events</h2>
            <p>
              Server-side page {state.data.page}. UTC window:{" "}
              {new Date(state.data.window.from).toISOString()} to{" "}
              {new Date(state.data.window.to).toISOString()} (end excluded).
            </p>
            {!state.data.events.length ? (
              <p role="status">No audit events match these filters.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp (UTC)</th>
                      <th>Event</th>
                      <th>Actor / role</th>
                      <th>Target</th>
                      <th>Outcome</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.events.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.timestamp
                            ? new Date(e.timestamp).toISOString()
                            : "Unknown"}
                        </td>
                        <td>
                          <Link
                            to={`/admin/audit/${encodeURIComponent(e.id)}${suffix}`}
                          >
                            {e.eventType}
                          </Link>
                        </td>
                        <td className="audit-id">
                          {e.actorId || "Unknown"}
                          <br />
                          {e.actorRole || "Unknown role"}
                        </td>
                        <td className="audit-id">
                          {e.targetType}
                          <br />
                          {e.targetId}
                        </td>
                        <td>{e.outcome || "Unknown"}</td>
                        <td>{e.isDemo ? "Demo" : "Operational"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous audit page
              </button>
              <span>Page {page}</span>
              <button
                disabled={!state.data.hasMore || page === 100}
                onClick={() => setPage(page + 1)}
              >
                Next audit page
              </button>
            </div>
            <p>
              Historic journals may lack actor roles, correlation IDs or state
              transitions. They remain unknown. This view excludes free-text
              reasons, private report evidence and OTP material. Authentication
              events follow the existing safe operational logging policy.
            </p>
          </section>
        ))}
    </div>
  );
}
