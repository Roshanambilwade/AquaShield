import { useContext, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { AuthContext } from "../lib/authContext.js";
export default function AdminLayout() {
  const auth = useContext(AuthContext);
  const location = useLocation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.loading)
    return (
      <div className="page">
        <p role="status">Checking administrator session…</p>
      </div>
    );
  if (auth.error)
    return (
      <div className="page">
        <p role="alert">{auth.error}</p>
        <button className="button" onClick={auth.retry}>
          Try again
        </button>
      </div>
    );
  if (!auth.user)
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await auth.logout();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const suffix = location.search.includes("demo=true") ? "?demo=true" : "";
  return (
    <div className="admin-shell">
      <div className="admin-toolbar">
        <div>
          <span className="admin-lock">ADMIN</span>
          <span>{auth.user.name}</span>
        </div>
        <nav aria-label="Administrator navigation">
          <NavLink to={`/admin${suffix}`} end>
            Overview
          </NavLink>
          <NavLink to={`/admin/shortages${suffix}`}>Shortage zones</NavLink>
          <NavLink to={`/admin/analytics${suffix}`}>Analytics</NavLink>
        </nav>
        <button onClick={logout} disabled={busy}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
      {error && (
        <p className="page" role="alert">
          {error}
        </p>
      )}
      <Outlet />
    </div>
  );
}
