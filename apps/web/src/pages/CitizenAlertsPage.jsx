import { useState } from "react";
import RoleGuard from "../components/RoleGuard.jsx";
import useAdminData from "../hooks/useAdminData.js";
import { adminRequest } from "../lib/adminApi.js";
export default function CitizenAlertsPage() {
  return (
    <RoleGuard role="CITIZEN">
      <Inbox />
    </RoleGuard>
  );
}
function Inbox() {
  const [refresh, setRefresh] = useState(0),
    [page, setPage] = useState(1),
    [history, setHistory] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const preference = useAdminData("/citizen/alerts/area", refresh);
  const inbox = useAdminData(
    `/citizen/alerts?page=${page}&limit=10&history=${history}`,
    refresh,
  );
  async function action(path, body, method = "PUT") {
    setBusy(true);
    setError("");
    try {
      await adminRequest(path, { method, body });
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page report-page">
      <p className="eyebrow">Private citizen inbox</p>
      <h1 className="page-title">My Alerts</h1>
      <p>
        Select a service area to receive local in-app advisories. This is your
        preference, not verified residency. No location permission is requested.
      </p>
      {(preference.loading || inbox.loading) && (
        <p role="status">Loading your alerts…</p>
      )}
      {(error || preference.error || inbox.error) && (
        <p role="alert">
          {error || preference.error || inbox.error}{" "}
          <button onClick={() => setRefresh((n) => n + 1)}>Retry alerts</button>
        </p>
      )}
      {preference.data && (
        <label>
          Preferred service area{" "}
          <select
            disabled={busy}
            value={preference.data.areaId || ""}
            onChange={(e) => {
              setPage(1);
              action("/citizen/alerts/area", {
                areaId: e.target.value || null,
              });
            }}
          >
            <option value="">No local area selected</option>
            {preference.data.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p role="status">
        {inbox.data?.unreadCount ?? "…"} unread active advisories
      </p>
      <label>
        <input
          type="checkbox"
          checked={history}
          onChange={(e) => {
            setHistory(e.target.checked);
            setPage(1);
          }}
        />{" "}
        Include expired and withdrawn history
      </label>
      {inbox.data && !inbox.data.notifications.length && (
        <p>
          No relevant advisories in this view. Municipal notices are published
          by authorized staff.
        </p>
      )}
      <ul className="report-list">
        {inbox.data?.notifications.map((a) => (
          <li key={a.id}>
            <article className="report-card">
              <h2>{a.title}</h2>
              <p>
                {a.areaName} · {a.category.replaceAll("_", " ")} · {a.status} ·{" "}
                {a.unread ? "Unread" : "Read"}
              </p>
              {a.isDemo && (
                <p className="demo-note">
                  Simulated demonstration advisory; no real emergency claim.
                </p>
              )}
              <p>{a.message}</p>
              <p>
                Published {new Date(a.createdAt).toLocaleString()} · Expires{" "}
                {new Date(a.expiresAt).toLocaleString()}
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  action(`/citizen/alerts/${a.id}/read`, { read: a.unread })
                }
              >
                {a.unread ? "Mark as read" : "Mark as unread"}
              </button>
            </article>
          </li>
        ))}
      </ul>
      <div className="pagination">
        <button
          disabled={busy || page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous notices
        </button>
        <span>Page {page}</span>
        <button
          disabled={busy || !inbox.data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Next notices
        </button>
      </div>
      <p>
        Reading a notice does not close the municipal advisory or resolve a
        shortage.
      </p>
    </div>
  );
}
