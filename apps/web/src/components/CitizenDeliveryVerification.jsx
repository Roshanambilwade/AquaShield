import { useState } from "react";
import { getDeliveryOtp } from "../lib/api.js";

export default function CitizenDeliveryVerification({ report }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (report.isDemo || report.responseStatus?.status !== "ARRIVED") return null;
  async function issue() {
    setBusy(true);
    setResult(null);
    setError("");
    try {
      setResult(await getDeliveryOtp(report.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="report-detail-card"
      aria-label="Citizen delivery verification"
    >
      <h2>Area delivery verification</h2>
      <p>
        The earliest eligible account-backed reporter is the designated
        recipient. Only that account can obtain a code. Share it with the
        assigned operator after observing the area delivery.
      </p>
      <p>
        This confirms account participation, not verified identity, measured
        litres or receipt by every household. No SMS is sent.
      </p>
      <button className="button" disabled={busy} onClick={issue}>
        {busy ? "Requesting code…" : "Get recipient delivery code"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <p>
            Recipient delivery code: <strong>{result.recipientOtp}</strong>
          </p>
          <p>
            Expires: {new Date(result.expiresAt).toLocaleString()}. The code is
            single-use and is cleared when you leave this page.
          </p>
          <button
            className="button button-secondary"
            onClick={() => setResult(null)}
          >
            Hide delivery code
          </button>
        </div>
      )}
    </section>
  );
}
