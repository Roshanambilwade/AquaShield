import { useEffect, useRef, useState } from "react";
import { adminRequest } from "../lib/adminApi.js";

const roles = {
  detect: "Crisis Detection",
  allocate: "Resource Allocation",
  logistics: "Logistics",
  predict: "Early Warning",
};
const actions = {
  VERIFY_REPORTS: "Arrange field verification",
  REVIEW_PRIORITY: "Review priority area",
  COLLECT_LOGISTICS_DATA: "Complete logistics evidence",
  COLLECT_RISK_INPUTS: "Gather early-warning inputs",
};
export default function AiRecommendationPanel({ demo, event, configuration }) {
  const [role, setRole] = useState("allocate");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const active = useRef(null);
  useEffect(() => () => active.current?.abort(), []);
  async function generate() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await adminRequest(
        `/ai/${role === "allocate" ? "recommend-allocation" : role}`,
        {
          method: "POST",
          body: { demo, eventId: event.id },
          signal: controller.signal,
          timeoutMs: 65000,
        },
      );
      if (!controller.signal.aborted) setResult(data);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const focus = result?.facts.zones.find(
    (z) => z.ref === (result.advice.priorityRef || result.facts.selectedRef),
  );
  return (
    <section
      className="admin-panel ai-panel"
      aria-label="AquaShield AI recommendation"
    >
      <div className="ai-heading">
        <div>
          <p className="eyebrow">Evidence → recommendation → human review</p>
          <h2>AquaShield AI recommendation</h2>
        </div>
        <span className="phase-badge">
          {result
            ? result.execution.isDemo
              ? "Demo simulation"
              : "Gemini via Strands"
            : configuration?.status === "DEMO"
              ? "Demo mode"
              : configuration?.status === "READY"
                ? "Gemini ready"
                : "Not configured"}
        </span>
      </div>
      <p>{configuration?.message || "Loading agent configuration…"}</p>
      <div className="ai-controls">
        <label>
          Agent role
          <select
            value={role}
            disabled={loading}
            onChange={(e) => {
              setRole(e.target.value);
              setResult(null);
              setError("");
            }}
          >
            {Object.entries(roles).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          disabled={loading || !event}
          onClick={generate}
        >
          {loading ? "Assessing evidence…" : "Generate recommendation"}
        </button>
      </div>
      <p className="evidence-note">
        {role === "allocate"
          ? "Compares all current zones using backend severity and duration. Fairness remains partial where demand or delivery evidence is missing."
          : `Selected area: ${event?.areaName || "No current evidence"}`}
      </p>
      {loading && (
        <p role="status">
          {roles[role]} is assessing the evidence. No action will be approved
          automatically.
        </p>
      )}
      {error && (
        <div role="alert" className="report-error">
          <p>{error}</p>
          <button className="button button-secondary" onClick={generate}>
            Retry recommendation
          </button>
        </div>
      )}
      {!result && !loading && !error && (
        <p>
          No AI recommendation has been generated.{" "}
          {event
            ? "Choose an agent to review the evidence."
            : "Submit a report or load a simulated scenario to begin."}
        </p>
      )}
      {result && (
        <div className="ai-result" aria-live="polite">
          <p
            className={result.execution.isDemo ? "demo-note" : "evidence-note"}
          >
            {result.execution.isDemo
              ? "Demo AI simulation — no Gemini execution."
              : `Actual Google Gemini execution through Strands · ${result.execution.model}`}
            {result.facts.dataIsDemo
              ? " Source evidence is fictional demo data."
              : " Source: current recorded evidence."}
          </p>
          <h3>
            {result.agent} · {actions[result.advice.recommendedAction]}
          </h3>
          <p className="ai-summary">{result.advice.summary}</p>
          <p>{result.advice.explanation}</p>
          {focus && (
            <>
              <h3>Backend evidence · {focus.area}</h3>
              <dl className="ai-facts">
                <div>
                  <dt>Severity</dt>
                  <dd>
                    {focus.severity}/100 · {focus.severityLevel}
                    {focus.partialSeverity ? " (partial)" : ""}
                  </dd>
                </div>
                <div>
                  <dt>Shortage confidence</dt>
                  <dd>{focus.shortageConfidence}%</dd>
                </div>
                <div>
                  <dt>Estimated affected population</dt>
                  <dd>
                    {focus.estimatedPopulation == null
                      ? "Unknown"
                      : `~${focus.estimatedPopulation.toLocaleString()}`}
                  </dd>
                </div>
                <div>
                  <dt>Verified / total reports</dt>
                  <dd>
                    {focus.verifiedReportCount} / {focus.reportCount}
                  </dd>
                </div>
              </dl>
            </>
          )}
          <h3>Supporting reasons</h3>
          {result.facts.route && (
            <section aria-label="Backend logistics evidence">
              <h3>Recorded trip and estimated route</h3>
              <p>Trip status: {result.facts.route.tripStatus}</p>
              <p>
                {result.facts.route.distanceMethod === "ROAD_ROUTE"
                  ? "Road distance"
                  : "Straight-line distance"}
                :{" "}
                {result.facts.route.distanceKm == null
                  ? "Unknown"
                  : `${result.facts.route.distanceKm} km`}
              </p>
              <p>
                Estimated ETA:{" "}
                {result.facts.route.etaMinutes == null
                  ? "Unknown"
                  : `${result.facts.route.etaMinutes} min`}{" "}
                · {result.facts.route.etaMethod}
              </p>
              <p>{result.facts.route.note}</p>
            </section>
          )}
          <ul>
            {result.advice.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p>{result.advice.confidenceExplanation}</p>
          <p>{result.advice.verificationRecommendation}</p>
          <h3>Fairness considerations</h3>
          <p>{result.advice.fairnessConsiderations}</p>
          <h3>Missing information</h3>
          <ul>
            {result.advice.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <details>
            <summary>Source evidence and calculation method</summary>
            <p>{result.facts.rankingMethod}</p>
            <ul>
              {result.advice.evidenceRefs.map((ref) => {
                const zone = result.facts.zones.find((z) => z.ref === ref);
                return (
                  <li key={ref}>
                    {zone.area} · {zone.reportCount} reports · calculated{" "}
                    {new Date(zone.calculatedAt).toLocaleString()}
                  </li>
                );
              })}
            </ul>
            <small>
              Evidence version: {result.facts.evidenceVersion}
              <br />
              Rule: {result.facts.ruleVersion} · Prompt:{" "}
              {result.execution.promptVersion}
            </small>
          </details>
          <p className="ai-review">
            Human review required · Recommendation only · No allocation approved
          </p>
          <small>
            Generated {new Date(result.generatedAt).toLocaleString()}.
            Recommendation confidence is uncalibrated and is not shown as a
            percentage. Refresh the assessment when evidence changes.
          </small>
        </div>
      )}
    </section>
  );
}
