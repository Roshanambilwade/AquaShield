import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminRequest } from "../lib/adminApi.js";

const quantity = (value) =>
  value == null ? "Unknown" : `${value.toLocaleString()} L`;
const readNumber = (form, name) =>
  form.get(name) === "" ? null : Number(form.get(name));
export default function OperationsPage({ fleetOnly = false }) {
  const [params, setParams] = useSearchParams();
  const demo = params.get("demo") === "true";
  const suffix = `?demo=${demo}`;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState(null);
  const [useAi, setUseAi] = useState(false);
  const requestId = useRef(null);
  const load = useCallback(
    async (signal) => {
      const [fleet, context, history] = await Promise.all([
        adminRequest(`/operations/tankers${suffix}`, { signal }),
        adminRequest(`/operations/allocation-context${suffix}`, { signal }),
        adminRequest(`/operations/allocations${suffix}`, { signal }),
      ]);
      return { ...fleet, context, ...history };
    },
    [suffix],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [load]);
  async function mutate(path, body, message, method = "POST") {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await adminRequest(`/operations/${path}${suffix}`, {
        method,
        body,
        timeoutMs: 75000,
      });
      setSuccess(result.blocked ? result.message : message);
      setData(await load());
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const rankings = data?.context.rankings || [];
  const focus = rankings.find((r) => r.eventId === selected) || rankings[0];
  async function saveTanker(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lat = readNumber(form, "lat"),
      lng = readNumber(form, "lng");
    if ((lat == null) !== (lng == null)) {
      setError("Supply both coordinates or leave both blank.");
      return;
    }
    const tanker = {
      identifier: form.get("identifier"),
      name: form.get("name"),
      capacityLitres: Number(form.get("capacityLitres")),
      availableLitres: readNumber(form, "availableLitres"),
      status: form.get("status"),
      operatorId: form.get("operatorId") || null,
      currentLocation: lat == null ? null : { lat, lng },
      observedAt: form.get("confirm")
        ? new Date().toISOString()
        : editing?.observedAt || null,
    };
    const result = await mutate(
      editing ? `tankers/${editing.id}` : "tankers",
      editing ? { tanker, revision: editing.revision } : tanker,
      "Tanker information saved.",
      editing ? "PATCH" : "POST",
    );
    if (result) setEditing(null);
  }
  async function recommend() {
    requestId.current ||= crypto.randomUUID();
    const result = await mutate(
      "allocations/recommend",
      {
        eventId: focus.eventId,
        requestId: requestId.current,
        useAi,
        notes:
          "Municipal emergency water support. Confirm household needs before operations.",
      },
      "Recommendation saved. Review the evidence before approval.",
    );
    if (result) requestId.current = null;
  }
  return (
    <div className="page operations-page">
      <p className="eyebrow">Municipal resource coordination</p>
      <h1 className="page-title">
        {fleetOnly ? "Tanker management" : "Fair allocation"}
      </h1>
      <p className="page-intro">
        Review evidence, approve a response and explicitly assign an eligible
        tanker.
      </p>
      <label className="operations-source">
        Evidence source{" "}
        <select
          value={demo ? "demo" : "live"}
          disabled={busy}
          onChange={(e) => {
            setData(null);
            setSelected("");
            setEditing(null);
            requestId.current = null;
            setParams(e.target.value === "demo" ? { demo: "true" } : {});
          }}
        >
          <option value="live">Live records</option>
          <option value="demo">Simulated demo records</option>
        </select>
      </label>
      {demo && (
        <div className="demo-note">
          Simulated fleet, demand and delivery context. These are fictional
          records.
          <details>
            <summary>Prepare or reset the demo</summary>
            <p>
              Reset affects only AquaShield-owned demo operations. Link a
              provisioned operator to the demo tanker afterwards.
            </p>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() =>
                mutate(
                  "demo/reset",
                  { confirm: "RESET_DEMO_OPERATIONS" },
                  "Demo operations reset; real records preserved.",
                )
              }
            >
              Reset demo operations
            </button>
          </details>
        </div>
      )}
      {error && (
        <div role="alert" className="report-error">
          {error}{" "}
          <button
            disabled={busy}
            onClick={() => {
              setError("");
              load()
                .then(setData)
                .catch((e) => setError(e.message));
            }}
          >
            Refresh records
          </button>
        </div>
      )}
      {success && (
        <p role="status" className="demo-note">
          {success}
        </p>
      )}
      {busy && <p role="status">Saving and checking current records…</p>}
      {!data ? (
        <p role="status">Loading operational records…</p>
      ) : fleetOnly ? (
        <>
          <section className="admin-panel">
            <h2>Fleet and current assignments</h2>
            {!data.tankers.length && (
              <p>No tankers registered for this evidence source.</p>
            )}
            <div className="operations-cards">
              {data.tankers.map((t) => (
                <article className="operation-card" key={t.id}>
                  <h3>
                    {t.identifier} · {t.name}
                  </h3>
                  <p>
                    <strong>{t.status}</strong>
                    {t.isDemo ? " · Simulated" : ""}
                  </p>
                  <p>
                    Capacity {quantity(t.capacityLitres)} · Available{" "}
                    {quantity(t.availableLitres)}
                  </p>
                  <p>
                    Operator:{" "}
                    {data.operators.find((o) => o.id === t.operatorId)?.name ||
                      "Not linked / inactive"}
                  </p>
                  <p>
                    Location:{" "}
                    {t.currentLocation
                      ? `${t.currentLocation.lat}, ${t.currentLocation.lng}`
                      : "Unknown; routing is unavailable"}
                  </p>
                  <p>
                    Last confirmed:{" "}
                    {t.observedAt
                      ? new Date(t.observedAt).toLocaleString()
                      : "Unknown"}
                  </p>
                  {t.activeAllocationId && (
                    <p>
                      Assignment: <code>{t.activeAllocationId}</code>
                    </p>
                  )}
                  <ul>
                    {t.eligibility.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <button
                    className="button button-secondary"
                    disabled={busy || t.status === "ASSIGNED"}
                    onClick={() => setEditing(t)}
                  >
                    Edit {t.identifier}
                  </button>
                </article>
              ))}
            </div>
          </section>
          <section className="admin-panel">
            <h2>
              {editing ? `Update ${editing.identifier}` : "Register tanker"}
            </h2>
            <form
              key={`${editing?.id || "new"}:${editing?.revision || 0}`}
              className="operations-form"
              onSubmit={saveTanker}
            >
              <label>
                Identifier
                <input
                  name="identifier"
                  required
                  pattern="[A-Za-z0-9-]{2,40}"
                  defaultValue={editing?.identifier || ""}
                />
              </label>
              <label>
                Display name
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editing?.name || ""}
                />
              </label>
              <label>
                Total capacity (L)
                <input
                  name="capacityLitres"
                  type="number"
                  min="1"
                  max="100000"
                  required
                  defaultValue={editing?.capacityLitres || ""}
                />
              </label>
              <label>
                Available water (L, blank if unknown)
                <input
                  name="availableLitres"
                  type="number"
                  min="0"
                  max="100000"
                  defaultValue={editing?.availableLitres ?? ""}
                />
              </label>
              <label>
                Operational status
                <select
                  name="status"
                  defaultValue={editing?.status || "UNAVAILABLE"}
                >
                  <option>UNAVAILABLE</option>
                  <option>AVAILABLE</option>
                </select>
              </label>
              <label>
                Operator account
                <select
                  name="operatorId"
                  defaultValue={editing?.operatorId || ""}
                >
                  <option value="">Not linked</option>
                  {data.operators.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Latitude (optional)
                <input
                  name="lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  defaultValue={editing?.currentLocation?.lat ?? ""}
                />
              </label>
              <label>
                Longitude (optional)
                <input
                  name="lng"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  defaultValue={editing?.currentLocation?.lng ?? ""}
                />
              </label>
              <label className="operations-check">
                <input name="confirm" type="checkbox" />I have confirmed these
                operational facts now
              </label>
              <div>
                <button className="button" disabled={busy}>
                  Save tanker
                </button>
                {editing && (
                  <button type="button" onClick={() => setEditing(null)}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="admin-panel">
            <h2>Provision operator access</h2>
            <p>
              Create an individual operator account. Existing accounts are never
              overwritten.
            </p>
            <form
              className="operations-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const formElement = event.currentTarget;
                const form = new FormData(formElement);
                const result = await mutate(
                  "operators",
                  Object.fromEntries(form),
                  "Operator account created. Link it to a tanker.",
                );
                if (result) formElement.reset();
              }}
            >
              <label>
                Operator name
                <input name="name" required maxLength={120} />
              </label>
              <label>
                Operator email
                <input name="email" type="email" required />
              </label>
              <label>
                Initial password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={256}
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                Create operator
              </button>
            </form>
          </section>
        </>
      ) : (
        <>
          <section className="admin-panel">
            <h2>Priority queue</h2>
            <p>
              Documented delivery history adjusts allocation priority; severity
              is unchanged. Unknown history remains unknown; the baseline
              severity is shown for partial assessments.
            </p>
            {!rankings.length ? (
              <p>No unassigned active shortages.</p>
            ) : (
              <>
                <label>
                  Inspect shortage
                  <select
                    value={focus?.eventId || ""}
                    disabled={busy}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      requestId.current = null;
                    }}
                  >
                    {rankings.map((r, i) => (
                      <option key={r.eventId} value={r.eventId}>
                        {i + 1}. {r.area} · {r.severityLevel}
                      </option>
                    ))}
                  </select>
                </label>
                <dl className="ai-facts">
                  <div>
                    <dt>Severity</dt>
                    <dd>
                      {focus.severity}/100 · {focus.severityLevel}
                    </dd>
                  </div>
                  <div>
                    <dt>Shortage confidence</dt>
                    <dd>{focus.confidence}%</dd>
                  </div>
                  <div>
                    <dt>Estimated affected population</dt>
                    <dd>
                      {focus.estimatedPopulation == null
                        ? "Unknown"
                        : `~${focus.estimatedPopulation}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Priority</dt>
                    <dd>
                      {focus.priority == null
                        ? `${focus.orderingScore} (partial; severity only)`
                        : focus.priority}
                    </dd>
                  </div>
                  <div>
                    <dt>Verified demand</dt>
                    <dd>{quantity(focus.demandLitres)}</dd>
                  </div>
                  <div>
                    <dt>Previous-day delivery quantity</dt>
                    <dd>{quantity(focus.recentDeliveredLitres)}</dd>
                  </div>
                </dl>
                <ul>
                  {[...focus.reasons, ...focus.missingInputs].map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <details>
                  <summary>
                    Record verified demand and delivery evidence
                  </summary>
                  <p>
                    Enter documented demand and the complete previous-day
                    delivery quantity only when known. Blank values remain
                    unknown. This records source evidence, not a new delivery.
                  </p>
                  <form
                    key={focus.eventId}
                    className="operations-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      mutate(
                        `evidence/${focus.eventId}`,
                        {
                          demandLitres: readNumber(form, "demandLitres"),
                          recentDeliveredLitres: readNumber(
                            form,
                            "recentDeliveredLitres",
                          ),
                          source: form.get("source"),
                          observedAt: new Date().toISOString(),
                        },
                        "Verified source evidence recorded; priority recalculated.",
                        "PUT",
                      );
                    }}
                  >
                    <label>
                      Verified demand (L)
                      <input
                        type="number"
                        name="demandLitres"
                        min="1"
                        max="10000000"
                        defaultValue={focus.demandLitres ?? ""}
                      />
                    </label>
                    <label>
                      Previous-day delivered water (L)
                      <input
                        type="number"
                        name="recentDeliveredLitres"
                        min="0"
                        max="10000000"
                        defaultValue={focus.recentDeliveredLitres ?? ""}
                      />
                    </label>
                    <label>
                      Evidence source / ledger reference
                      <input
                        name="source"
                        required
                        minLength={5}
                        maxLength={500}
                      />
                    </label>
                    <button className="button" disabled={busy}>
                      Save verified evidence
                    </button>
                  </form>
                </details>
                <h3>Eligible candidates for {rankings[0].area}</h3>
                {!data.context.candidates.length && (
                  <p>No eligible tanker is currently available.</p>
                )}
                <ul>
                  {data.context.candidates.map((t, i) => (
                    <li key={t.id}>
                      {i === 0 ? "Recommended: " : "Eligible: "}
                      {t.identifier} · capacity {quantity(t.capacityLitres)} ·
                      available {quantity(t.availableLitres)}
                      {!t.currentLocation ? " · location unknown" : ""}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Excluded tankers</summary>
                  {data.context.excluded.map((t) => (
                    <p key={t.id}>
                      {t.identifier}: {t.reasons.join(" ")}
                    </p>
                  ))}
                </details>
                <label className="operations-check">
                  <input
                    type="checkbox"
                    checked={useAi}
                    disabled={busy}
                    onChange={(e) => setUseAi(e.target.checked)}
                  />
                  Request an agent explanation (provider failure leaves a
                  labeled deterministic recommendation)
                </label>
                <button
                  className="button"
                  disabled={busy || focus.eventId !== rankings[0].eventId}
                  onClick={recommend}
                >
                  Request allocation recommendation
                </button>
                {focus.eventId !== rankings[0].eventId && (
                  <p>
                    The highest-priority unassigned shortage must be reviewed
                    first.
                  </p>
                )}
              </>
            )}
          </section>
          <section className="admin-panel">
            <h2>Allocation decisions and assignments</h2>
            {!data.allocations.length && (
              <p>No allocation recommendations yet.</p>
            )}
            <div className="operations-cards">
              {data.allocations.map((a) => (
                <article
                  className="operation-card"
                  key={a.id}
                  aria-label={`Allocation ${a.id}`}
                >
                  <h3>
                    {
                      a.evidence.rankings.find((r) => r.eventId === a.eventId)
                        ?.area
                    }{" "}
                    · {a.status}
                  </h3>
                  <small>Allocation {a.id}</small>
                  <p>
                    Tanker:{" "}
                    {a.evidence.candidates.find((t) => t.id === a.tankerId)
                      ?.identifier || "Unknown"}{" "}
                    · Planned water: {quantity(a.evidence.proposedLitres)}
                  </p>
                  <p>
                    {a.ai?.execution?.mode === "REAL_GEMINI"
                      ? "Gemini explanation via Strands"
                      : a.ai?.execution?.mode === "DEMO_SIMULATION"
                        ? "Demo AI simulation — no Gemini execution"
                        : "Deterministic recommendation — no successful Gemini execution"}
                  </p>
                  {a.ai?.failureCode && (
                    <p>
                      Agent unavailable: {a.ai.failureCode}. Backend evidence
                      remains available.
                    </p>
                  )}
                  {a.ai?.advice && (
                    <>
                      <p>{a.ai.advice.summary}</p>
                      <p>{a.ai.advice.fairnessConsiderations}</p>
                    </>
                  )}
                  <p>{a.notes}</p>
                  <details>
                    <summary>Review saved evidence and audit history</summary>
                    <p>Rule: {a.evidence.ruleVersion}</p>
                    {a.evidence.rankings.map((r) => (
                      <p key={r.eventId}>
                        {r.area}: severity {r.severity}; priority{" "}
                        {r.priority ?? "Unknown (severity baseline used)"};
                        approximate population{" "}
                        {r.estimatedPopulation ?? "Unknown"}; delivery quantity{" "}
                        {quantity(r.recentDeliveredLitres)}.{" "}
                        {r.missingInputs.join(", ")}
                      </p>
                    ))}
                    <ol>
                      {a.audit.map((item, i) => (
                        <li key={i}>
                          {item.action} · {new Date(item.at).toLocaleString()} ·
                          actor {item.actorId}
                          {item.reason ? ` · ${item.reason}` : ""}
                        </li>
                      ))}
                    </ol>
                  </details>
                  {a.status === "RECOMMENDED" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          `allocations/${a.id}/approve`,
                          {},
                          "Allocation approved. Assignment still requires a separate action.",
                        )
                      }
                    >
                      Approve allocation
                    </button>
                  )}
                  {["APPROVED", "ASSIGNING"].includes(a.status) && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          `allocations/${a.id}/assign`,
                          {},
                          "Tanker assigned. Its operator can view the assignment.",
                        )
                      }
                    >
                      {a.status === "ASSIGNING"
                        ? "Resume assignment"
                        : "Assign approved tanker"}
                    </button>
                  )}
                  {[
                    "RECOMMENDED",
                    "APPROVED",
                    "ASSIGNING",
                    "RECONCILING",
                  ].includes(a.status) && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        mutate(
                          `allocations/${a.id}/reject`,
                          {
                            reason: new FormData(event.currentTarget).get(
                              "reason",
                            ),
                          },
                          "Allocation rejected with an audit record.",
                        );
                      }}
                    >
                      <label>
                        Rejection reason
                        <input
                          name="reason"
                          required
                          minLength={5}
                          maxLength={500}
                        />
                      </label>
                      <button
                        className="button button-secondary"
                        disabled={busy}
                      >
                        Reject allocation
                      </button>
                    </form>
                  )}
                  {a.rejectionReason && <p>Rejected: {a.rejectionReason}</p>}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
