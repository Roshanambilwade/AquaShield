import { useEffect, useState } from "react";
import { adminRequest } from "../lib/adminApi.js";
import { shortageRequest } from "../lib/shortages.js";

export default function useShortages(demo, id, admin = false) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({});
  const key = `${admin}:${demo}:${id || "list"}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    (admin
      ? adminRequest(`/dashboard/shortages${id ? `/${id}` : ""}?demo=${demo}`, {
          signal: controller.signal,
        }).then((data) => (id ? data.event : data))
      : shortageRequest(demo, { id, signal: controller.signal })
    )
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [demo, id, key, admin]);
  return {
    ...(state.key === key ? state : { data: null, error: "", loading: true }),
    refresh: () => setAttempt((n) => n + 1),
  };
}
