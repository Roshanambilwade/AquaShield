import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../lib/authContext.js";
import { adminRequest } from "../lib/adminApi.js";
import RoleGuard from "../components/RoleGuard.jsx";
import TripCard from "../components/TripCard.jsx";
export default function OperatorPage() {
  return (
    <RoleGuard role="OPERATOR">
      <OperatorAssignments />
    </RoleGuard>
  );
}
function OperatorAssignments() {
  const auth = useContext(AuthContext);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (auth.user?.role !== "OPERATOR") return;
    const controller = new AbortController();
    adminRequest("/operator/assignments", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(e.message);
        }
      });
    return () => controller.abort();
  }, [auth.user, attempt]);
  return (
    <div className="page operations-page">
      <p className="eyebrow">Tanker operator</p>
      <h1 className="page-title">Your assignments</h1>
      <button
        className="button button-secondary"
        onClick={() => {
          setError("");
          setAttempt((n) => n + 1);
        }}
      >
        Refresh assignments
      </button>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading assignments…</p>}
      {data && (
        <>
          <section className="admin-panel">
            <h2>Your tanker</h2>
            {!data.tankers.length && (
              <p>
                No tanker is linked to your account. Contact the municipal team
                to link your assigned tanker, then refresh assignments.
              </p>
            )}
            {data.tankers.map((t) => (
              <p key={t.id}>
                {t.identifier} · {t.name} · {t.status} · capacity{" "}
                {t.capacityLitres} L · available{" "}
                {t.availableLitres == null
                  ? "Unknown"
                  : `${t.availableLitres} L`}
                {t.isDemo ? " · Simulated demo tanker" : ""}
              </p>
            ))}
          </section>
          <section className="admin-panel">
            <h2>Trip controls and delivery history</h2>
            {!data.deliveries?.length && (
              <p>
                No trips recorded yet. Trips appear after the municipal team
                approves and assigns a tanker.
              </p>
            )}
            <div className="operations-cards">
              {data.deliveries?.map((d) => (
                <TripCard
                  key={d.id}
                  delivery={d}
                  onChange={async () => {
                    setData(await adminRequest("/operator/assignments"));
                  }}
                />
              ))}
            </div>
          </section>
          <section className="admin-panel">
            <h2>Current assignments</h2>
            {!data.assignments.length && (
              <p>No assignment has been approved and assigned to you.</p>
            )}
            {data.assignments.map((a) => (
              <article className="operation-card" key={a.id}>
                <h3>
                  {a.destination.area} · {a.status}
                </h3>
                <p>Assignment {a.id}</p>
                <Link
                  className="button button-secondary"
                  to={`/operator/assignment/${a.id}`}
                >
                  Open assigned job
                </Link>
                {a.isDemo && (
                  <p className="demo-note">Simulated demo assignment</p>
                )}
                <p>
                  Destination zone center:{" "}
                  {a.destination.center
                    ? `${a.destination.center.lat}, ${a.destination.center.lng} (approximate)`
                    : "Unknown"}
                </p>
                <p>
                  Planned water:{" "}
                  {a.proposedLitres == null
                    ? "Unknown; confirm with the municipal team"
                    : `${a.proposedLitres} L`}
                </p>
                <p>{a.notes}</p>
                <p>Assigned {new Date(a.assignedAt).toLocaleString()}</p>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
