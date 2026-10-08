import { useEffect, useState } from "react";
import { adminRequest } from "../lib/adminApi.js";
export default function useAdminData(path, refreshKey = 0) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({});
  const key = `${path}:${refreshKey}:${attempt}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    adminRequest(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ key, error: error.message });
      });
    return () => controller.abort();
  }, [path, key]);
  return {
    ...(state.key === key ? state : { loading: Boolean(path) }),
    refresh: () => setAttempt((n) => n + 1),
  };
}
