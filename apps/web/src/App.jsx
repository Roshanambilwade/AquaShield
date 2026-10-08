import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import HomePage from "./pages/HomePage.jsx";
import StatusPage from "./pages/StatusPage.jsx";
import WorkspacePage from "./pages/WorkspacePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ReportPage from "./pages/ReportPage.jsx";
import ReportHistoryPage from "./pages/ReportHistoryPage.jsx";
import ReportStatusPage from "./pages/ReportStatusPage.jsx";
import ReportSuccessPage from "./pages/ReportSuccessPage.jsx";
import ShortagesPage from "./pages/ShortagesPage.jsx";
import ShortageStatusPage from "./pages/ShortageStatusPage.jsx";
import AdminLayout from "./components/AdminLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="status" element={<StatusPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="report/success" element={<ReportSuccessPage />} />
        <Route path="report/:id" element={<ReportStatusPage />} />
        <Route path="my-reports" element={<ReportHistoryPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<ShortagesPage admin />} />
          <Route path="shortages" element={<ShortagesPage admin />} />
          <Route path="shortages/:id" element={<ShortageStatusPage admin />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>
        <Route path="alerts" element={<ShortagesPage />} />
        <Route path="alerts/:id" element={<ShortageStatusPage />} />
        <Route
          path="operator"
          element={<WorkspacePage audience="Tanker operator" />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
