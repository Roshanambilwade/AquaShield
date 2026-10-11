import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import useAdminData from "../hooks/useAdminData.js";
import { useEnvironment } from "../lib/environment.js";
import { adminRequest } from "../lib/adminApi.js";
export default function AdvisoriesPage() {
  const [params] = useSearchParams(),
    environment = useEnvironment();
  const demo = environment.demonstration || params.get("demo") === "true";
  const [refresh, setRefresh] = useState(0),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const areas = useAdminData(`/advisories/areas?demo=${demo}`, refresh);
  const notices = useAdminData(
    `/advisories?demo=${demo}&page=${page}&limit=10`,
    refresh,
  );
  async function action(path, body) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await adminRequest(`${path}?demo=${demo}`, { method: "POST", body });
      setRefresh((n) => n + 1);
      setSuccess("Saved municipal advisory state.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page report-page">
      <p className="eyebrow">Authorized in-app publication</p>
      <h1 className="page-title">Citizen advisories</h1>
      <p>
        Publish concise, privacy-safe wording from reviewed evidence. No
        external messages are sent. Reusing a source/category/audience returns
        its existing notice; withdrawn or expired notices are not silently
        reopened.
      </p>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
      {(areas.loading || notices.loading) && (
        <p role="status">Loading advisories…</p>
      )}
      {(areas.error || notices.error) && (
        <p role="alert">
          {areas.error || notices.error}
          <button onClick={() => setRefresh((n) => n + 1)}>
            Retry advisories
          </button>
        </p>
      )}
      {areas.data && (
        <form
          className="report-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action("/advisories", {
              areaId: f.get("areaId"),
              audience: f.get("audience"),
              category: f.get("category"),
              sourceType: f.get("sourceType"),
              sourceId: f.get("sourceId"),
              expiresInHours: Number(f.get("expiresInHours")),
            });
          }}
        >
          <label>
            Service area
            <select aria-label="Service area" name="areaId" required>
              {areas.data.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Audience
            <select name="audience">
              <option value="AREA">Selected area subscribers</option>
              <option value="MUNICIPAL">All municipal citizen accounts</option>
            </select>
          </label>
          <label>
            Advisory category
            <select name="category">
              <option value="SUPPLY_REVIEW">Supply evidence reviewed</option>
              <option value="DELIVERY_RECORDED">Area delivery recorded</option>
              <option value="ACTIVITY_WATCH">Supported activity watch</option>
              {environment.demonstration && (
                <option value="DEMONSTRATION">
                  Explicit simulated advisory
                </option>
              )}
            </select>
          </label>
          <label>
            Evidence type
            <select name="sourceType">
              <option value="REPORT">Manually reviewed report</option>
              <option value="DELIVERY">Accepted completed delivery</option>
              <option value="PREDICTION">
                Current supported report-history prediction
              </option>
              {environment.demonstration && (
                <option value="SIMULATED">Simulated advisory scenario</option>
              )}
            </select>
          </label>
          <label>
            Evidence ID or stable simulated scenario key
            <input name="sourceId" required minLength={2} maxLength={100} />
          </label>
          <label>
            Expiry in hours
            <input
              name="expiresInHours"
              type="number"
              min="1"
              max="168"
              defaultValue="24"
              required
            />
          </label>
          <p>
            Report and delivery evidence must be current (within one day).
            Forecast evidence must be supported and within its forecast window.
            Synthetic forecast fixtures cannot be published as operational
            warnings. Demo wording remains simulated.
          </p>
          <button disabled={busy} className="button button-primary">
            {busy ? "Saving…" : "Publish advisory"}
          </button>
        </form>
      )}
      {!notices.loading &&
        notices.data &&
        !notices.data.notifications.length && (
          <p>No citizen advisories have been published.</p>
        )}
      {notices.data?.notifications.map((a) => (
        <article className="report-card" key={a.id}>
          <h2>{a.title}</h2>
          <p>
            {a.areaName} · {a.status} · {a.provenance}
          </p>
          <p>{a.message}</p>
          <p>Expires {new Date(a.expiresAt).toLocaleString()}</p>
          {a.status === "ACTIVE" && (
            <button
              disabled={busy}
              onClick={() =>
                action(`/advisories/${a.id}/withdraw`, { revision: a.revision })
              }
            >
              Withdraw advisory
            </button>
          )}
        </article>
      ))}
      <div className="pagination">
        <button
          disabled={page === 1 || busy}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous advisories
        </button>
        <span>Page {page}</span>
        <button
          disabled={!notices.data?.hasMore || busy}
          onClick={() => setPage((p) => p + 1)}
        >
          Next advisories
        </button>
      </div>
    </div>
  );
}
