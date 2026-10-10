import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles.css";
import "./reporting.css";
import "./shortages.css";
import "./admin.css";
import AuthProvider from "./components/AuthProvider.jsx";
import EnvironmentProvider from "./components/EnvironmentProvider.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <EnvironmentProvider>
            <App />
          </EnvironmentProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
