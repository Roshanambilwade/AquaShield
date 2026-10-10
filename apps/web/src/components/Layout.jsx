import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../lib/authContext.js";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PORTALS } from "../lib/portalAccess.js";
import { useEnvironment } from "../lib/environment.js";

export default function Layout() {
  const auth = useContext(AuthContext);
  const environment = useEnvironment();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { pathname, search } = useLocation();
  useEffect(() => {
    const titles = {
      "/": "Overview",
      "/report": "Report water shortage",
      "/my-reports": "My reports",
      "/login": new URLSearchParams(search)
        .get("returnTo")
        ?.startsWith("/operator")
        ? "Operator sign in"
        : "Municipal sign in",
      "/citizen/login": "Citizen sign in",
      "/register": "Register",
      "/admin": "Municipal overview",
      "/admin/shortages": "Shortage evidence",
      "/admin/analytics": "Municipal analytics",
      "/admin/audit": "Audit history",
      "/admin/predictions": "Early warning",
      "/admin/tankers": "Tanker fleet",
      "/admin/allocations": "Fair allocation",
      "/admin/deliveries": "Trips and deliveries",
      "/admin/reports": "Citizen evidence review",
      "/operator": "Your assignments",
      "/alerts": "Local alerts",
      "/status": "System status",
      "/report/success": "Report submitted",
    };
    const section = pathname.startsWith("/report/")
      ? "Report status"
      : pathname.startsWith("/admin/reports/")
        ? "Citizen evidence review"
        : pathname.startsWith("/admin/audit/")
          ? "Audit record"
          : pathname.startsWith("/operator/assignment/")
            ? "Assigned job"
            : pathname.includes("/shortages/") ||
                pathname.startsWith("/alerts/")
              ? "Shortage details"
              : "Page not found";
    document.title = `${titles[pathname] || section} | AquaShield`;
  }, [pathname, search]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus();
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <NavLink to="/" className="brand" aria-label="AquaShield home">
          <img src="/favicon.svg" alt="" width="40" height="40" />
          <span>
            Aqua<span className="brand-accent">Shield</span>
          </span>
        </NavLink>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            Overview
          </NavLink>
          {!auth.loading && (!auth.user || auth.user.role === "CITIZEN") && (
            <>
              <NavLink to="/report" end>
                Report water shortage
              </NavLink>
              <NavLink to="/my-reports">My reports</NavLink>
            </>
          )}
          {!auth.loading && (!auth.user || auth.user.role === "ADMIN") && (
            <NavLink to="/admin">Municipal team</NavLink>
          )}
          {!auth.loading && (!auth.user || auth.user.role === "OPERATOR") && (
            <NavLink to="/operator">Operator</NavLink>
          )}
          <NavLink to="/alerts">Local alerts</NavLink>
          <NavLink to="/status">System status</NavLink>
          {!auth.loading && !auth.user && (
            <NavLink to="/citizen/login">Citizen sign in</NavLink>
          )}
          {!auth.loading && !auth.user && (
            <NavLink to="/register">Register</NavLink>
          )}
        </nav>
      </header>
      {auth.user && (
        <div className="page citizen-session">
          <span>
            {PORTALS[auth.user.role]?.label} · Signed in as {auth.user.name}
            {auth.user.role === "CITIZEN" && (
              <>
                {" "}
                · Email {auth.user.emailVerified ? "verified" : "unverified"}
              </>
            )}
          </span>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await auth.logout();
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      {environment.demonstration && (
        <p className="demo-note" role="status">
          AquaShield — Demonstration Environment · simulated scenarios and
          account activity
        </p>
      )}
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>
          AquaShield <span className="footer-dot">·</span> AquaSentinels
        </span>
        <span>Environmental Hacks — Heat &amp; Water Track</span>
      </footer>
    </div>
  );
}
