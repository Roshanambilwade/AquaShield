import { Link } from "react-router-dom";
const value = (n) => (n == null ? "Unknown" : n.toLocaleString());
function Timing({ label, data }) {
  return (
    <article className="metric-explanation">
      <h3>{label}</h3>
      <p>
        {data?.averageMinutes == null
          ? "Unknown"
          : `${data.averageMinutes} min`}{" "}
        · {value(data?.count)} valid recorded timings
      </p>
      {data && (
        <ul>
          {data.distribution.map((b) => (
            <li key={b.label}>
              {b.label.replaceAll("_", " ")}: {b.count}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
function Counts({ rows, field = "status" }) {
  return rows.length ? (
    <ul>
      {rows.map((s) => (
        <li key={s[field]}>
          {s[field] || "Unknown"}: {s.count}
        </li>
      ))}
    </ul>
  ) : (
    <p>No records in this window.</p>
  );
}
export default function MunicipalAnalytics({ data }) {
  const suffix = data.isDemo ? "?demo=true" : "",
    r = data.reports,
    d = data.deliveries,
    o = data.operational;
  return (
    <section className="admin-panel" aria-label="Observed municipal activity">
      <h2>Observed municipal activity</h2>
      <p>
        {new Date(data.window.from).toISOString()} to{" "}
        {new Date(data.window.to).toISOString()} · UTC · end excluded
      </p>
      {!r.total && <p role="status">No report submissions in this window.</p>}
      <dl className="analytics-evidence">
        {[
          ["Reports submitted", r.total],
          ["Verified submissions", r.verified],
          ["Pending verification", r.pendingVerification],
          ["Rejected submissions", r.rejected],
          ["Unverified submissions (including rejected)", r.unverified],
          ["Recorded completed deliveries", d.completed],
          ["Recorded delivered litres", d.litres],
          ["Current active cases", data.current.activeCases],
          ["Current emerging cases", data.current.emergingCases],
        ].map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value(n)}</dd>
          </div>
        ))}
      </dl>
      <p>
        Unverified submissions are not confirmed shortages. Physical case
        resolution and report review time: Unknown — these timestamps are not
        recorded.
      </p>
      <div className="history-grid">
        <section>
          <h3>Allocation actions in this window</h3>
          <dl>
            {[
              "recommended",
              "approved",
              "rejected",
              "assigned",
              "conflicts",
            ].map((key) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{data.allocations[key]}</dd>
              </div>
            ))}
          </dl>
          <h4>Current states of recommendations created in window</h4>
          <Counts rows={data.allocations.states} />
          <Link to={`/admin/allocations${suffix}`}>
            View allocation records
          </Link>
        </section>
        <section>
          <h3>Delivery outcomes</h3>
          <Counts rows={d.states} />
          <p>
            Completed but synchronization pending: {d.pendingSynchronization}.
            Invalid completion records excluded: {d.excludedCompletedRecords}.
            Recorded recoveries: {d.recovered}.
          </p>
          <Counts rows={d.failedOtpEvents} field="eventType" />
          <Link to={`/admin/deliveries${suffix}`}>View delivery records</Link>
        </section>
        <section>
          <h3>Fleet — current global snapshot</h3>
          <p>
            {value(o.availableTankers)} eligible available ·{" "}
            {value(o.busyTankers)} busy/reserved · {value(o.fleetCount)} total.
          </p>
          <p>
            Busy / all fleet:{" "}
            {o.utilizationPercent == null
              ? "Unknown"
              : `${o.utilizationPercent}%`}
            . This is not utilization over time.
          </p>
          <Link to={`/admin/tankers${suffix}`}>View fleet records</Link>
        </section>
        <section>
          <h3>Early-warning alert activity</h3>
          <p>{data.alerts.created} alerts created in window.</p>
          <h4>Current status of window cohort</h4>
          <Counts rows={data.alerts.states} />
          <h4>Current risk of window cohort</h4>
          <Counts rows={data.alerts.risks} field="riskLevel" />
          <h4>Created by area</h4>
          <Counts
            rows={data.alerts.areas.map((a) => ({
              area:
                data.areas.find((ar) => ar.id === a.areaId)?.name ||
                "Unknown service area",
              count: a.count,
            }))}
            field="area"
          />
          <h4>Journal events in window</h4>
          <Counts rows={data.alerts.activity} field="eventType" />
          <Link to={`/admin/predictions${suffix}`}>Review alert records</Link>
        </section>
      </div>
      <h3>Recorded timing distributions</h3>
      <p>
        Means exclude missing or reversed timestamps. Each panel shows its own
        valid denominator. Delivery milestones refer to an associated area, not
        verified household receipt.
      </p>
      <div className="history-grid">
        <Timing
          label="Report → recommendation"
          data={r.timings.reportToRecommendation}
        />
        <Timing
          label="Report → assignment"
          data={r.timings.reportToAssignment}
        />
        <Timing
          label="Report → accepted area delivery"
          data={r.timings.reportToDelivery}
        />
        <Timing
          label="Still pending — elapsed to window end"
          data={r.timings.pendingElapsed}
        />
        <Timing
          label="Completed delivery response (request → delivery)"
          data={d.response}
        />
        <Timing
          label="Completed trip duration (start → delivery)"
          data={d.completion}
        />
      </div>
      <p>
        {r.timings.note ||
          `Report linkage timings unavailable: ${r.timings.status}. Narrow the window.`}
      </p>
      <h3>Report activity by area</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Submissions</th>
              <th>Completed deliveries</th>
              <th>Valid response timings</th>
            </tr>
          </thead>
          <tbody>
            {o.areas.map((a) => (
              <tr key={a.areaId || "unknown"}>
                <td>{a.area}</td>
                <td>{a.reports}</td>
                <td>{a.completedDeliveries}</td>
                <td>{a.timedDeliveries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Report submissions by UTC day</h3>
      {r.byDay.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>UTC day</th>
                <th>Submitted reports</th>
              </tr>
            </thead>
            <tbody>
              {r.byDay.map((day) => (
                <tr key={day.day}>
                  <td>{day.day}</td>
                  <td>{day.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No historical activity to chart.</p>
      )}
      <Link to={`/admin/reports${suffix}`}>View authorized report records</Link>
      <section
        className="metric-explanation"
        aria-label="Separate saved activity forecasts"
      >
        <h3>Predicted report activity — separate from observed metrics</h3>
        <p>
          {data.predictions.status === "AVAILABLE"
            ? `${data.predictions.supportedAreas} areas have current supported saved forecasts.`
            : `${data.predictions.status}: no current supported saved forecast for this selection. An area may be unevaluated, insufficient or stale.`}{" "}
          Forecasts estimate approximate report activity, not physical water
          depletion. No AI request was made.
        </p>
        <Link to={`/admin/predictions${suffix}`}>
          View saved forecast evidence and availability
        </Link>
      </section>
      <details>
        <summary>Metric definitions and limitations</summary>
        <p>
          Reports: creations in the selected window; verification is their
          current state. Allocation counts use each recorded action timestamp,
          so actions can belong to recommendations created earlier. Delivery
          totals require DELIVERED, verified OTP, positive integer litres and a
          delivery timestamp in the window; each record counts once. Delivery
          state counts use the creation cohort. Alert status/risk use the
          current state of alerts created in window; journal activity uses event
          timestamps.
        </p>
        <p>
          Report timings use the earliest valid milestone from current event
          associations, once per non-rejected report. Missing links are excluded
          from completed means; pending elapsed includes non-rejected reports
          without an accepted linked delivery before the end. Fleet eligibility
          uses the existing allocation rules. Severity and report evidence are
          stored current assessments, with oldest assessment timestamp{" "}
          {data.current.calculatedAt
            ? new Date(data.current.calculatedAt).toISOString()
            : "Unknown"}
          .
        </p>
        <p>
          Audit coverage: {r.withoutCreationAudit} submissions in this window
          have no creation journal. Historic actor roles and correlation IDs are
          not reconstructed. Counts are observations, not prediction accuracy or
          a measure of households physically served.
        </p>
      </details>
    </section>
  );
}
