import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import HistoryFilters from "../components/HistoryFilters.jsx";
import { initialWindow, windowQuery } from "../lib/historyWindow.js";
import MunicipalAnalytics from "../components/MunicipalAnalytics.jsx";
import useAdminData from "../hooks/useAdminData.js";
import { AnalyticsPanel } from "../components/AdminDashboardPanels.jsx";
export default function AnalyticsPage() {
  const [params] = useSearchParams();
  const demo = useEnvironment().demonstration || params.get("demo") === "true";
  const [values, setValues] = useState(() => ({
    ...initialWindow(),
    areaId: "",
  }));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const state = useAdminData(`/dashboard/analytics?demo=${demo}${query}`);
  return (
    <div className="page shortage-page">
      <p className="eyebrow">Municipal evidence</p>
      <h1 className="page-title">Shortage analytics</h1>
      {demo && (
        <p className="demo-note">
          Simulated demo evidence; not real municipal statistics.
        </p>
      )}
      <form
        className="admin-panel history-filters"
        aria-label="Analytics filters"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const q = new URLSearchParams(windowQuery(values));
            if (values.areaId) q.set("areaId", values.areaId);
            setQuery(`&${q}`);
            setError("");
            state.refresh();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <HistoryFilters values={values} setValues={setValues} />
        <label>
          Service area
          <select
            aria-label="Service area"
            value={values.areaId}
            onChange={(e) => setValues({ ...values, areaId: e.target.value })}
          >
            <option value="">All areas</option>
            {state.data?.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Apply analytics filters</button>
        {error && <p role="alert">{error}</p>}
      </form>
      {state.data && <MunicipalAnalytics data={state.data} />}
      <AnalyticsPanel state={state} />
    </div>
  );
}
import { useEnvironment } from "../lib/environment.js";
