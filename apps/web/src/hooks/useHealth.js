import { useCallback, useEffect, useState } from "react";
import { getHealth } from "../lib/api.js";

export default function useHealth() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    status: "loading",
    health: null,
    error: "",
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 8000);

    async function check() {
      try {
        const health = await getHealth(controller.signal);
        if (active) setState({ status: "complete", health, error: "" });
      } catch (error) {
        if (active)
          setState({
            status: "error",
            health: null,
            error:
              error.name === "AbortError"
                ? "The status check timed out. Please try again."
                : error.message,
          });
      } finally {
        clearTimeout(timer);
      }
    }
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  const refresh = useCallback(() => {
    setState({ status: "loading", health: null, error: "" });
    retry();
  }, [retry]);

  return { ...state, refresh };
}
