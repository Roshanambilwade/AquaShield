import { Link } from "react-router-dom";

const workspaces = [
  {
    number: "01",
    label: "For communities",
    title: "A voice for every household.",
    text: "A shared place for residents to raise water concerns and follow the response.",
    to: "/status",
    action: "View system status",
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
            An intelligence and decision layer for emergency water management.
            Built around local needs, transparent decisions, and human
            oversight.
          </p>
          <Link to="/status" className="button">
            Check system status <span aria-hidden="true">↗</span>
          </Link>
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
        <span className="phase-badge">Phase 1</span>
        <p>
          The foundation is in place. Reporting, crisis analysis, and dispatch
          will arrive in later phases.
        </p>
      </section>
      <section className="workspace-section" aria-labelledby="workspace-title">
        <div className="section-heading">
          <p className="eyebrow">One platform. Shared purpose.</p>
          <h2 id="workspace-title">Connected by a common need.</h2>
        </div>
        <div className="workspace-grid">
          {workspaces.map((workspace) => (
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
