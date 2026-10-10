export default function PredictionChart({ result }) {
  const rows = result.observed || [];
  const values = rows.map((r) => r.count ?? 0);
  const forecast = result.forecast?.estimatedEligibleReportCount;
  const max = Math.max(1, ...values, forecast ?? 0);
  return (
    <figure className="prediction-chart">
      <figcaption>
        Observed eligible reports and approximate next-window activity
      </figcaption>
      <div className="prediction-bars" aria-hidden="true">
        {rows.map((r, i) => (
          <div key={r.start} className="prediction-bar-column">
            <span
              className={
                r.count == null ? "prediction-bar missing" : "prediction-bar"
              }
              style={{ height: `${Math.max(2, (values[i] / max) * 100)}%` }}
            />
            <small>{r.count ?? "?"}</small>
          </div>
        ))}
        {forecast != null && (
          <div className="prediction-bar-column">
            <span
              className="prediction-bar forecast"
              style={{ height: `${Math.max(2, (forecast / max) * 100)}%` }}
            />
            <small>≈{forecast}</small>
          </div>
        )}
      </div>
      <p>
        Solid: recorded activity · Dashed: estimate · ?: unknown observation
        window
      </p>
      <details>
        <summary>Accessible chart data</summary>
        <div className="table-scroll">
          <table>
            <caption>Non-overlapping observation windows</caption>
            <thead>
              <tr>
                <th>Window start (UTC)</th>
                <th>Eligible reports</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.start}>
                  <td>{r.start}</td>
                  <td>{r.count ?? "Unknown"}</td>
                  <td>Observed</td>
                </tr>
              ))}
              {forecast != null && (
                <tr>
                  <td>{result.forecast.start}</td>
                  <td>Approximately {forecast}</td>
                  <td>Predicted</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
