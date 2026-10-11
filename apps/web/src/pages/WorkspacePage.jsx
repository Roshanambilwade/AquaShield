import { Link } from "react-router-dom";

export default function WorkspacePage({ audience }) {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">{audience}</p>
      <h1 className="page-title">Your workspace starts here.</h1>
      <div className="empty-card">
        <h2>Choose your workspace.</h2>
        <p>Sign in to access the tools available to your account.</p>
        <Link className="button button-secondary" to="/status">
          View system status <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}
