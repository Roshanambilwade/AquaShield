import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../lib/authContext.js";
import { allowedDestination, portalHome } from "../lib/portalAccess.js";

const workspaces = [
  {
    number: "01",
    label: "For communities",
    title: "A voice for every household.",
    text: "A shared place for residents to raise water concerns and follow the response.",
    to: "/report",
    action: "Report water shortage",
  },
  {
    number: "02",
    label: "For municipal teams",
    title: "Clarity when it matters.",
    text: "A workspace for understanding local need and coordinating emergency resources.",
    to: "/admin",
    action: "Explore workspace",
  },
  {
    number: "03",
    label: "For tanker operators",
    title: "Connect the last mile.",
    text: "A dedicated space for the teams bringing emergency water to communities.",
    to: "/operator",
    action: "Explore workspace",
  },
];

export default function HomePage() {
  const auth = useContext(AuthContext);
  const citizenActions =
    !auth.loading && (!auth.user || auth.user.role === "CITIZEN");
  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="small-dot" /> Emergency water management
          </p>
          <h1>
            Every community.
            <br />
            Every drop.
            <br />
            <span>A coordinated response.</span>
          </h1>
          <p className="hero-description">
            Report water problems in your area. Share what your household is
            experiencing and track your report in one place.
          </p>
          <div className="hero-actions">
            {citizenActions && (
              <>
                <Link to="/report" className="button">
                  Report water shortage <span aria-hidden="true">↗</span>
                </Link>
                <Link to="/my-reports" className="button button-secondary">
                  Track my report
                </Link>
              </>
            )}
            {auth.user && auth.user.role !== "CITIZEN" && (
              <Link to={portalHome(auth.user.role)} className="button">
                Open your portal
              </Link>
            )}
            <Link to="/alerts" className="button button-secondary">
              View active local alerts
            </Link>
          </div>
        </div>
        <div className="water-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="water-drop">
            <svg viewBox="0 0 180 220">
              <path
                d="M90 10C70 45 25 95 25 140a65 65 0 0 0 130 0C155 95 110 45 90 10Z"
                fill="currentColor"
              />
              <path
                d="M55 145a35 35 0 0 0 35 35"
                fill="none"
                stroke="#d1efdb"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="art-caption">Water connects us.</span>
        </div>
      </section>
      <section className="foundation-note" aria-label="Project availability">
        <span className="phase-badge">Phases 1–7</span>
        <p>
          Citizen reporting and shortage evidence are available. Municipal teams
          can review evidence, approve allocations and assign eligible tankers.
          Assigned operators can record trips and demo OTP delivery. Forecasts
          remain future work.
        </p>
      </section>
      <section className="workspace-section" aria-labelledby="workspace-title">
        <div className="section-heading">
          <p className="eyebrow">One platform. Shared purpose.</p>
          <h2 id="workspace-title">Connected by a common need.</h2>
        </div>
        <div className="workspace-grid">
          {workspaces
            .filter(
              (workspace) =>
                !auth.loading &&
                (!auth.user ||
                  allowedDestination(auth.user.role, workspace.to)),
            )
            .map((workspace) => (
              <article className="workspace-card" key={workspace.number}>
                <div className="card-top">
                  <span>{workspace.label}</span>
                  <span className="card-number">{workspace.number}</span>
                </div>
                <h3>{workspace.title}</h3>
                <p>{workspace.text}</p>
                <Link to={workspace.to}>
                  {workspace.action} <span aria-hidden="true">↗</span>
                </Link>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}
