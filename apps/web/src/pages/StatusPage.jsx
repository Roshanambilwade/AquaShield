import useHealth from "../hooks/useHealth.js";

export default function StatusPage() {
  const { status, health, error, refresh } = useHealth();
  const healthy = health?.data.status === "ok";
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Platform foundation</p>
      <h1 className="page-title">System status</h1>
      <p className="page-intro">
        Connection status for the AquaShield API and database.
      </p>
      <section
        className="status-card"
        aria-label="Service health"
        aria-busy={status === "loading"}
      >
        <div role="status" aria-live="polite">
          {status === "loading" && (
            <p className="status-heading">Checking services…</p>
          )}
          {status === "complete" && (
            <>
              <span
                className={`status-badge ${healthy ? "healthy" : "degraded"}`}
              >
                {healthy ? "All services operational" : "Database unavailable"}
              </span>
              <h2 className="status-heading">
                {healthy ? "Ready for the next step." : "The API is running."}
              </h2>
              <p>
                {healthy
                  ? "The API and MongoDB are connected."
                  : "MongoDB is not connected. Please try again shortly."}
              </p>
              <dl className="service-list">
                <div>
                  <dt>Backend API</dt>
                  <dd>Online</dd>
                </div>
                <div>
                  <dt>MongoDB</dt>
                  <dd>{healthy ? "Connected" : "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Last checked</dt>
                  <dd>
                    {new Date(health.data.timestamp).toLocaleTimeString()}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
        {status === "error" && (
          <div role="alert">
            <h2 className="status-heading">Unable to check services.</h2>
            <p>{error}</p>
          </div>
        )}
        <button
          className="button button-secondary"
          onClick={refresh}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Checking…" : "Check again"}
        </button>
      </section>
    </div>
  );
}
