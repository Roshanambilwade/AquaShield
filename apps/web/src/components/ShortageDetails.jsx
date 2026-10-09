export function SeverityBadge({ level }) {
  return (
    <span className={`severity-badge severity-${level.toLowerCase()}`}>
      {level}
    </span>
  );
}

export default function ShortageDetails({ event, compact = false }) {
  return (
    <section
      className="shortage-details"
      aria-label={`Shortage evidence for ${event.areaName}`}
    >
      <div className="shortage-title">
        <h2>{event.areaName}</h2>
        <SeverityBadge level={event.severityLevel} />
      </div>
      {event.isDemo && (
        <p className="demo-note">
          Simulated scenario. Reports, field checks, population assumptions,
          weather and incident signals are fictional.
        </p>
      )}
      <p className="shortage-status">
        {event.status === "EMERGING"
          ? "Emerging risk · limited current evidence"
          : event.status === "HISTORICAL"
            ? "Historical report cluster"
            : "Active shortage evidence"}
      </p>
      <dl className="shortage-metrics">
        <div>
          <dt>Severity</dt>
          <dd>{event.severityScore}/100</dd>
        </div>
        <div>
          <dt>Shortage confidence</dt>
          <dd>{event.confidenceScore}%</dd>
        </div>
        <div>
          <dt>Estimated affected population</dt>
          <dd>~{event.estimatedAffectedPopulation.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Approximate duration</dt>
          <dd>
            {event.durationHours == null
              ? "Unknown"
              : `${event.durationHours} hours`}
          </dd>
        </div>
        <div>
          <dt>Reports / eligible households</dt>
          <dd>
            {event.reportCount} / {event.eligibleReportCount}
          </dd>
        </div>
        <div>
          <dt>Verified reports</dt>
          <dd>
            {event.verifiedReportCount}
            {event.isDemo ? " (simulated)" : ""}
          </dd>
        </div>
      </dl>
      <p className="evidence-note">
        Confidence measures evidence that a genuine shortage exists. It is not
        water remaining. Automated detection does not constitute field
        verification.
      </p>
      {!event.severity.complete && (
        <p className="missing-evidence">
          Partial severity: {event.severity.missingInputs.join(", ")} unknown.
          Possible score range {event.severityScore}–{event.severity.upperBound}
          /100; classification uses known evidence.
        </p>
      )}
      {event.reportHandling && event.reportHandling !== "ELIGIBLE" && (
        <p className="missing-evidence">
          Your report was flagged as {event.reportHandling.toLowerCase()} and
          excluded from numeric scoring pending review.
        </p>
      )}
      {!compact && (
        <>
          <div className="signal-strip">
            <span>
              Temperature:{" "}
              {event.temperatureC == null
                ? "Unknown"
                : `${event.temperatureC}°C${event.isDemo ? " (simulated)" : ""}`}
            </span>
            <span>
              Median household water stress:{" "}
              {event.waterLevelScore == null
                ? "Unknown"
                : `${event.waterLevelScore}/100`}
            </span>
            <span>
              Vulnerable share:{" "}
              {event.vulnerableRatio == null
                ? "Unknown"
                : `~${Math.round(event.vulnerableRatio * 100)}%${event.isDemo ? " (simulated)" : ""}`}
            </span>
          </div>
          <h3>Why this confidence?</h3>
          <ul className="evidence-list">
            {event.evidence.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <ScoreTable
            title="Confidence calculation"
            components={event.confidence.components}
          />
          <ScoreTable
            title="Deterministic severity calculation"
            components={event.severity.components}
          />
          <h3>Population estimate</h3>
          {!event.privacy && (
            <p>
              {event.population.reportedHouseholdPopulation} citizen-reported
              household members across {event.population.householdCount}{" "}
              eligible reporter keys (accounts or legacy browser keys). Average
              household size {event.population.averageHouseholdSize}; assumed
              reporting coverage{" "}
              {Math.round(event.population.assumedReportCoverage * 100)}
              %.
            </p>
          )}
          <p className="evidence-note">
            {event.population.method} Anonymous keys may represent the same
            household across devices.
          </p>
          <p className="evidence-note">
            Calculated at {new Date(event.calculatedAt).toLocaleString()}
            {event.isDemo ? " · fixed demo observation clock" : ""}. Duration
            uses the median elapsed time since last supply, or reported duration
            plus report age.
          </p>
        </>
      )}
    </section>
  );
}

const labels = {
  consistency: "Problem consistency",
  geographic: "Geographic concentration",
  independent: "Independent reporter keys",
  infrastructure: "Incident correlation",
  time: "Time concentration",
  duration: "Shortage duration",
  population: "Estimated population",
  waterLevel: "Household water stress",
  environmental: "Environmental stress",
  vulnerability: "Vulnerable population",
  confidence: "Shortage confidence",
};
function ScoreTable({ title, components }) {
  return (
    <div className="score-table-wrap">
      <table className="score-table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Input</th>
            <th scope="col">Normalized score</th>
            <th scope="col">Weight</th>
            <th scope="col">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {components.map((c) => (
            <tr key={c.name}>
              <th scope="row">{labels[c.name]}</th>
              <td>{c.score == null ? "Unknown" : c.score}</td>
              <td>{c.weight}%</td>
              <td>{c.score == null ? "Pending evidence" : c.contribution}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
