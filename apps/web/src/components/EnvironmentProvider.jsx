import { useEffect, useState } from "react";
import { EnvironmentContext } from "../lib/environment.js";
import { LOCALITY_CENTERS } from "../../../../packages/shared/reportOptions.js";
export default function EnvironmentProvider({ children }) {
  const [state, setState] = useState({
    demonstration: false,
    areas: LOCALITY_CENTERS,
  });
  useEffect(() => {
    const controller = new AbortController();
    const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
      /\/+$/,
      "",
    );
    fetch(`${base}/environment`, {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.success && !controller.signal.aborted) setState(data.data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <EnvironmentContext.Provider value={state}>
      {children}
    </EnvironmentContext.Provider>
  );
}
