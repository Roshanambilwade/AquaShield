import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">404 · Page not found</p>
      <h1 className="page-title">Let’s get you back.</h1>
      <p className="page-intro">
        The page you’re looking for is not available.
      </p>
      <Link className="button" to="/">
        Return to overview
      </Link>
    </div>
  );
}
