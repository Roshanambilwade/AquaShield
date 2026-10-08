import { useContext, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../lib/authContext.js";
export default function LoginPage() {
  const auth = useContext(AuthContext);
  const [params] = useSearchParams();
  const candidate = params.get("returnTo") || "/admin";
  const destination = /^\/admin(?:\/|\?|$)/.test(candidate)
    ? candidate
    : "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.user) return <Navigate replace to={destination} />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await auth.login(email, password);
      setPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page login-page">
      <p className="eyebrow">AquaShield command center</p>
      <h1 className="page-title">Administrator sign in</h1>
      <p className="page-intro">
        Access municipal evidence and shortage assessment tools.
      </p>
      <form className="login-card" onSubmit={submit}>
        {error && <p role="alert">{error}</p>}
        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          maxLength={256}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="button" disabled={busy || auth.loading}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="evidence-note">
        Access is provisioned by the project operator. Citizen reporting remains
        available without an account.
      </p>
    </div>
  );
}
