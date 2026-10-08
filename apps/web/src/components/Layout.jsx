import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const { pathname } = useLocation();
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
          <NavLink to="/admin">Municipal team</NavLink>
          <NavLink to="/operator">Operator</NavLink>
          <NavLink to="/status">System status</NavLink>
        </nav>
      </header>
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
