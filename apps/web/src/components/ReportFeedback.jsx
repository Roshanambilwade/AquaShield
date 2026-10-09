import { Link, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../lib/authContext.js";
import { portalHome } from "../lib/portalAccess.js";
export default function ReportFeedback({ loading, error, refresh, code }) {
  const location = useLocation();
  const auth = useContext(AuthContext);
  if (loading)
    return (
      <div className="empty-card" role="status">
        Loading reports…
      </div>
    );
  if (error)
    return (
      <div className="error-message" role="alert">
        <p>{error}</p>
        {code === "CITIZEN_REQUIRED" && auth.user ? (
          <Link to={portalHome(auth.user.role)}>Return to your portal</Link>
        ) : (
          ["AUTH_REQUIRED", "SESSION_EXPIRED", "CITIZEN_REQUIRED"].includes(
            code,
          ) && (
            <Link
              to={`/citizen/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
            >
              Citizen sign in
            </Link>
          )
        )}
        <button className="button button-secondary" onClick={refresh}>
          Try again
        </button>
      </div>
    );
  return null;
}
