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
        <Route
          path="admin"
          element={<WorkspacePage audience="Municipal team" />}
        />
        <Route
          path="operator"
          element={<WorkspacePage audience="Tanker operator" />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
