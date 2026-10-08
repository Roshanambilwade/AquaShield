import { Link } from "react-router-dom";

export default function WorkspacePage({ audience }) {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">{audience}</p>
      <h1 className="page-title">Your workspace starts here.</h1>
      <div className="empty-card">
        <span className="phase-badge">Phase 1 foundation</span>
        <h2>A shared foundation for the response.</h2>
        <p>
          This workspace is being prepared. Operational tools and account access
          will be introduced in later phases.
        </p>
        <Link className="button button-secondary" to="/status">
          View system status <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}
