import { NavLink, Outlet, useLocation } from "react-router-dom";
import RoleGuard from "./RoleGuard.jsx";
import { useEnvironment } from "../lib/environment.js";
export default function AdminLayout() {
  const environment = useEnvironment();
  const location = useLocation();
  const suffix =
    new URLSearchParams(location.search).get("demo") === "true"
      ? "?demo=true"
      : "";
  return (
    <RoleGuard role="ADMIN">
      <div className="admin-shell">
        <div className="admin-toolbar">
          <p className="sidebar-label">Municipal command center</p>
          <nav aria-label="Administrator navigation">
            {environment.simulation && (
              <NavLink to="/admin/simulation">Simulation</NavLink>
            )}
            <NavLink to={`/admin${suffix}`} end>
              Overview
            </NavLink>
            <NavLink to={`/admin/shortages${suffix}`}>Shortage zones</NavLink>
            <NavLink to={`/admin/analytics${suffix}`}>Analytics</NavLink>
            <NavLink to={`/admin/audit${suffix}`}>Audit history</NavLink>
            <NavLink to={`/admin/predictions${suffix}`}>Early warning</NavLink>
            <NavLink to={`/admin/allocations${suffix}`}>Allocations</NavLink>
            <NavLink to={`/admin/tankers${suffix}`}>Tankers</NavLink>
            <NavLink to={`/admin/deliveries${suffix}`}>
              Trips and deliveries
            </NavLink>
            <NavLink to={`/admin/reports${suffix}`}>Citizen reports</NavLink>
            <NavLink to={`/admin/advisories${suffix}`}>
              Citizen advisories
            </NavLink>
          </nav>
        </div>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </RoleGuard>
  );
}
