import { useEffect, useState } from "react";
import { AuthContext } from "../lib/authContext.js";
import { adminRequest, ADMIN_TOKEN_KEY } from "../lib/adminApi.js";
export default function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const ended = () => setState({ user: null, loading: false, error: "" });
    window.addEventListener("admin-session-ended", ended);
    const load = async () => {
      if (!sessionStorage.getItem(ADMIN_TOKEN_KEY)) return { user: null };
      return adminRequest("/auth/me", { signal: controller.signal });
    };
    load()
      .then((result) => {
        if (!controller.signal.aborted)
          setState({ user: result.user, loading: false, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            user: null,
            loading: false,
            error: sessionStorage.getItem(ADMIN_TOKEN_KEY) ? error.message : "",
          });
      });
    return () => {
      controller.abort();
      window.removeEventListener("admin-session-ended", ended);
    };
  }, [attempt]);
  const login = async (email, password) => {
    const result = await adminRequest("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token);
    setState({ user: result.user, loading: false, error: "" });
  };
  const logout = async () => {
    await adminRequest("/auth/logout", { method: "POST", body: {} });
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setState({ user: null, loading: false, error: "" });
  };
  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        retry: () => {
          setState({ user: null, loading: true, error: "" });
          setAttempt((n) => n + 1);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
