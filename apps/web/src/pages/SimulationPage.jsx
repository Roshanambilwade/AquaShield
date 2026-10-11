import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminRequest } from "../lib/adminApi.js";
const date = (value) => (value ? new Date(value).toLocaleString() : "Unknown");
export default function SimulationPage() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [refreshMessage, setRefreshMessage] = useState("");
  async function refresh(signal, manual = false) {
    if (manual) {
      setRefreshing(true);
      setRefreshMessage("");
    }
    try {
      const result = await adminRequest("/simulation", { signal });
      if (signal?.aborted) return;
      setData(result);
      setError("");
      if (manual)
        setRefreshMessage(
          `Saved simulation refreshed at ${new Date().toLocaleTimeString()}. Status: ${result.run.status}; tick ${result.run.tick} / ${result.limits.ticks}. Refresh reloads records; it does not advance or restart the simulation.`,
        );
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      if (manual) setRefreshing(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    adminRequest("/simulation", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  // One bounded read loop only while visible/running; it never triggers ticks.
  useEffect(() => {
    if (data?.run.status !== "RUNNING") return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      if (!document.hidden) await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [data?.run.status]);
  async function command(action, extra = {}) {
    setBusy(true);
    setError("");
    try {
      setData(
        await adminRequest("/simulation/command", {
          method: "POST",
          body: { action, ...extra },
        }),
      );
    } catch (e) {
      setError(
        `${e.message} Refresh saved simulation before issuing another command.`,
      );
    } finally {
      setBusy(false);
    }
  }
  const run = data?.run;
  return (
    <div className="simulation-page">
      <header>
        <p className="eyebrow">Isolated synthetic environment</p>
        <h1>Dynamic simulation</h1>
        <p>
          Observe evolving evidence. Administrator review and operator delivery
          remain explicit human actions.
        </p>
      </header>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      <button
        className="button-secondary"
        disabled={busy || refreshing}
        onClick={() => refresh(undefined, true)}
      >
        {refreshing
          ? "Refreshing saved simulation…"
          : "Refresh saved simulation"}
      </button>
      <p role="status" aria-live="polite">
        {refreshing ? "Loading saved records…" : refreshMessage}
      </p>
      {!data && !error && <p role="status">Loading simulation…</p>}
      {run && (
        <>
          <section className="admin-panel" aria-label="Simulation controls">
            <h2>Scenario controls</h2>
            <p>
              <strong>
                Status:{" "}
                <span data-testid="simulation-status">{run.status}</span>
              </strong>{" "}
              · Tick <span data-testid="simulation-tick">{run.tick}</span> /{" "}
              {data.limits.ticks}
            </p>
            <p>
              Simulated time: {date(run.simulatedAt)} · Scenario: {run.scenario}
            </p>
            <p>
              Clock advances 15 simulated minutes per tick. Real operational
              timestamps and freshness checks remain separate.
            </p>
            {run.errorCode && (
              <p role="status">
                {run.errorCode}: saved evidence is retained. Review before
                continuing.
              </p>
            )}
            {run.status === "STOPPED" && (
              <p role="status">
                {run.tick >= data.limits.ticks
                  ? `Simulation completed its ${data.limits.ticks}-tick limit and stopped automatically.`
                  : "Simulation is already stopped."}{" "}
                All saved records remain available. This run cannot be restarted
                or reset. Refresh reloads saved records only. To run a new
                scenario, prepare a new isolated simulation database using the
                simulation setup guide.
              </p>
            )}
            <div className="simulation-controls">
              <button
                disabled={busy || refreshing || run.status !== "READY"}
                onClick={() => command("start")}
              >
                Start simulation
              </button>
              <button
                disabled={busy || refreshing || run.status !== "RUNNING"}
                onClick={() => command("pause")}
              >
                Pause simulation
              </button>
              <button
                disabled={
                  busy ||
                  refreshing ||
                  run.status !== "PAUSED" ||
                  run.tick >= data.limits.ticks
                }
                onClick={() => command("resume")}
              >
                Resume simulation
              </button>
              <button
                disabled={
                  busy ||
                  refreshing ||
                  !["READY", "PAUSED", "FAILED"].includes(run.status) ||
                  run.tick >= data.limits.ticks
                }
                onClick={() => command("step", { tick: run.tick + 1 })}
              >
                Advance one tick
              </button>
              <button
                disabled={busy || refreshing || run.status === "STOPPED"}
                onClick={() => command("stop")}
              >
                Stop simulation
              </button>
              <label>
                Simulation speed
                <select
                  value={run.speed}
                  disabled={
                    busy ||
                    refreshing ||
                    ["FAILED", "STOPPED"].includes(run.status)
                  }
                  onChange={(e) =>
                    command("speed", { speed: Number(e.target.value) })
                  }
                >
                  {data.limits.speed.map((s) => (
                    <option key={s} value={s}>
                      {s}× · {Math.max(5, data.limits.intervalMs / s / 1000)}s
                      between ticks
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p aria-live="polite">
              {busy
                ? "Saving command…"
                : "Controls use saved backend state. Stop retains all records; there is no reset."}
            </p>
          </section>
          <section className="admin-panel">
            <h2>Pending human decisions</h2>
            <p>
              {data.pendingReviews} reports awaiting review.{" "}
              {data.advisorySuggestion ||
                "No advisory suggestion yet; insufficient forecast evidence remains visible."}
            </p>
            <nav className="simulation-links" aria-label="Connected workflows">
              <Link to="/admin/reports">Review reports</Link>
              <Link to="/admin/allocations">Review fairness and allocate</Link>
              <Link to="/admin/tankers">Inspect fleet observations</Link>
              <Link to="/admin/deliveries">Inspect trip verification</Link>
              <Link to="/admin/advisories">Publish an advisory</Link>
              <Link to="/admin/analytics">Analytics</Link>
              <Link to="/admin/audit">Audit history</Link>
            </nav>
            <p>
              Use the linked operator account for Start trip → Mark arrived →
              authorized simulation OTP → verification → actual simulated litres
              → Complete delivery. No physical household receipt is claimed.
            </p>
          </section>
          <section className="admin-panel">
            <h2>Current shortage assessments</h2>
            {!data.events.length ? (
              <p>
                No shortage clusters yet. Advance a tick to introduce pending
                synthetic reports.
              </p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Severity</th>
                      <th>Confidence</th>
                      <th>Reports / verified</th>
                      <th>Approximate people</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <Link to={`/admin/shortages/${e.id}`}>
                            {e.areaName}
                          </Link>
                        </td>
                        <td>
                          {e.severityLevel} · {e.severityScore ?? "Unknown"}
                        </td>
                        <td>{e.confidenceScore ?? "Unknown"}%</td>
                        <td>
                          {e.reportCount} / {e.verifiedReportCount}
                        </td>
                        <td>~{e.estimatedAffectedPopulation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="admin-panel">
            <h2>New synthetic reports</h2>
            {!data.reports.length ? (
              <p>No generated reports yet.</p>
            ) : (
              <ul>
                {data.reports.map((r) => (
                  <li key={r.id}>
                    <Link to={`/admin/reports/${r.id}`}>
                      {r.locality} · {r.problem}
                    </Link>{" "}
                    · {r.verificationStatus} · household {r.householdSize} ·
                    simulated {date(r.simulation?.eventAt)} · received{" "}
                    {date(r.createdAt)}
                  </li>
                ))}
              </ul>
            )}
            <p>
              Latest 24 records; full authorized history is available in Citizen
              reports.
            </p>
          </section>
          <section className="admin-panel">
            <h2>Fleet eligibility</h2>
            {data.fleet.map((t) => (
              <article key={t.id}>
                <h3>
                  {t.identifier} · {t.status}
                </h3>
                <p>
                  {t.availableLitres ?? "Unknown"} L available /{" "}
                  {t.capacityLitres} L capacity · observed {date(t.observedAt)}
                </p>
                <p>
                  {t.eligibility.eligible
                    ? "Eligible under current backend rules"
                    : t.eligibility.reasons.join(" ")}
                </p>
              </article>
            ))}
            <p>
              Recorded synthetic locations are not live GPS. New observations
              require explicit administrator action.
            </p>
          </section>
          <section className="admin-panel">
            <h2>Allocations and saved deliveries</h2>
            {!data.allocations.length && <p>No allocation decisions yet.</p>}
            <ul>
              {data.allocations.map((a) => (
                <li key={a.id}>Allocation: {a.status}</li>
              ))}
            </ul>
            {!data.deliveries.length && (
              <p>
                No trips yet. Recommendation, approval and assignment are
                separate administrator actions.
              </p>
            )}
            <ul>
              {data.deliveries.map((d) => (
                <li key={d.id}>
                  {d.areaName} · {d.status} ·{" "}
                  {d.litresDelivered == null
                    ? "No accepted quantity"
                    : `${d.litresDelivered} recorded simulated L`}
                </li>
              ))}
            </ul>
          </section>
          <section className="admin-panel">
            <h2>Numerical early warning</h2>
            <p>
              Source: separate synthetic forecast observations. Report activity,
              not physical water depletion. No Gemini request is required.
            </p>
            <ul>
              {data.predictions.results.map((p) => (
                <li key={p.areaId}>
                  {p.areaName} · {p.riskLevel} ·{" "}
                  {p.riskScore == null
                    ? "Unknown index"
                    : `index ${p.riskScore}`}{" "}
                  · {p.retrievalStatus}
                </li>
              ))}
            </ul>
            <Link to="/admin/predictions">
              Inspect prediction sources and uncertainty
            </Link>
          </section>
          <section className="admin-panel">
            <h2>Area advisories</h2>
            {!data.advisories.length ? (
              <p>
                Nothing published. An administrator must explicitly publish a
                supported or labeled simulated advisory.
              </p>
            ) : (
              <ul>
                {data.advisories.map((a) => (
                  <li key={a.id}>
                    {a.areaName} · {a.title} · {a.status} · expires{" "}
                    {date(a.expiresAt)}
                  </li>
                ))}
              </ul>
            )}
            <p>
              Citizens choose their service area in My Alerts. Read state is
              personal; no SMS or push send is implied.
            </p>
          </section>
          <section className="admin-panel">
            <h2>Scenario event timeline</h2>
            {!run.audit.length ? (
              <p>Ready for the first command.</p>
            ) : (
              <ol>
                {run.audit
                  .slice(-30)
                  .reverse()
                  .map((a, i) => (
                    <li key={a._id || i}>
                      {a.action
                        .replaceAll("SIMULATION_", "")
                        .replaceAll("_", " ")}{" "}
                      · tick {a.tick ?? "Unknown"} · saved {date(a.at)}
                      {a.simulationAt && ` · simulated ${date(a.simulationAt)}`}
                    </li>
                  ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
