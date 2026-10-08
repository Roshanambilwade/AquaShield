import { useSearchParams } from "react-router-dom";
import useAdminData from "../hooks/useAdminData.js";
import { AnalyticsPanel } from "../components/AdminDashboardPanels.jsx";
export default function AnalyticsPage() {
  const [params] = useSearchParams();
  const demo = params.get("demo") === "true";
  const state = useAdminData(`/dashboard/analytics?demo=${demo}`);
  return (
    <div className="page shortage-page">
      <p className="eyebrow">Municipal evidence</p>
      <h1 className="page-title">Shortage analytics</h1>
      {demo && (
        <p className="demo-note">
          Simulated demo evidence; not real municipal statistics.
        </p>
      )}
      <AnalyticsPanel state={state} />
    </div>
  );
}
