import { useEffect, useState } from "react";
import { shortageRequest } from "../lib/shortages.js";

export default function useShortages(demo, id) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({});
  const key = `${demo}:${id || "list"}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    shortageRequest(demo, { id, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [demo, id, key]);
  return {
    ...(state.key === key ? state : { data: null, error: "", loading: true }),
    refresh: () => setAttempt((n) => n + 1),
  };
}
