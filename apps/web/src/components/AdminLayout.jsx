import { NavLink, Outlet, useLocation } from "react-router-dom";
import RoleGuard from "./RoleGuard.jsx";
export default function AdminLayout() {
  const location = useLocation();
  const suffix =
    new URLSearchParams(location.search).get("demo") === "true"
      ? "?demo=true"
      : "";
  return (
    <RoleGuard role="ADMIN">
      <div className="admin-shell">
        <div className="admin-toolbar">
          <nav aria-label="Administrator navigation">
            <NavLink to={`/admin${suffix}`} end>
              Overview
            </NavLink>
            <NavLink to={`/admin/shortages${suffix}`}>Shortage zones</NavLink>
            <NavLink to={`/admin/analytics${suffix}`}>Analytics</NavLink>
            <NavLink to={`/admin/allocations${suffix}`}>Allocations</NavLink>
            <NavLink to={`/admin/tankers${suffix}`}>Tankers</NavLink>
            <NavLink to={`/admin/deliveries${suffix}`}>
              Trips and deliveries
            </NavLink>
            <NavLink to={`/admin/reports${suffix}`}>Citizen reports</NavLink>
          </nav>
        </div>
        <Outlet />
      </div>
    </RoleGuard>
  );
}
