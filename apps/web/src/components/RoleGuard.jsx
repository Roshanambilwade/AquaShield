import { useContext } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../lib/authContext.js";
import { PORTALS, portalHome } from "../lib/portalAccess.js";

export default function RoleGuard({ role, children }) {
  const auth = useContext(AuthContext);
  const location = useLocation();
  if (auth.loading)
    return (
      <div className="page">
        <p role="status">Checking your session…</p>
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
        to={`${role === "CITIZEN" ? "/citizen/login" : "/login"}?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (auth.user.role !== role)
    return (
      <div className="page">
        <h1>{PORTALS[role].label} access required</h1>
        <p role="alert">
          Your {PORTALS[auth.user.role]?.label.toLowerCase() || "current"}{" "}
          account cannot access this portal.
        </p>
        <Link className="button" to={portalHome(auth.user.role)}>
          Return to your portal
        </Link>
      </div>
    );
  return children;
}
