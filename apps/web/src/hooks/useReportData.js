import { useEffect, useState } from "react";
import { getReport, getReports } from "../lib/api.js";

export default function useReportData({ id, page = 1, demo = false }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const key = `${id || "list"}:${page}:${demo}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const operation = id
      ? getReport(id, controller.signal)
      : getReports(page, demo, controller.signal);
    operation
      .then((data) => {
        if (active) setState({ key, data, error: "", loading: false });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setState({ key, data: null, error: error.message, loading: false });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, page, demo, key]);
  const refresh = () => setAttempt((value) => value + 1);
  return {
    ...(state.key === key ? state : { data: null, error: "", loading: true }),
    refresh,
  };
}
