import { useState } from "react";
import { SeverityBadge } from "./ShortageDetails.jsx";
export default function ShortageTable({ events, onSelect }) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const visible = events.filter(
    (e) =>
      (filter === "ALL" || e.severityLevel === filter) &&
      e.areaName.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="admin-panel" aria-label="Shortage event table">
      <div className="table-heading">
        <h2>Shortage events</h2>
        <label>
          Search area
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Severity filter
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="score-table-wrap">
        <table className="score-table">
          <caption className="sr-only">Shortage event evidence</caption>
          <thead>
            <tr>
              {[
                "Area",
                "Severity",
                "Confidence",
                "Approx. people",
                "Duration",
                "Reports / verified",
                "Status",
              ].map((v) => (
                <th key={v} scope="col">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id}>
                <th scope="row">
                  <button
                    className="table-area-link"
                    onClick={() => onSelect(e.id)}
                  >
                    {e.areaName}
                  </button>
                </th>
                <td>
                  <SeverityBadge level={e.severityLevel} /> {e.severityScore}
                  /100
                </td>
                <td>{e.confidenceScore}%</td>
                <td>~{e.estimatedAffectedPopulation.toLocaleString()}</td>
                <td>
                  {e.durationHours == null
                    ? "Unknown"
                    : `~${e.durationHours} h`}
                </td>
                <td>
                  {e.reportCount} / {e.verifiedReportCount}
                  {e.isDemo ? " simulated" : ""}
                </td>
                <td>{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && <p>No events match these filters.</p>}
    </section>
  );
}
