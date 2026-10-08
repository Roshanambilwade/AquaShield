export default function ReportFeedback({ loading, error, refresh }) {
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
        <button className="button button-secondary" onClick={refresh}>
          Try again
        </button>
      </div>
    );
  return null;
}
