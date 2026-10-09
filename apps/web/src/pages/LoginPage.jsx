import { useContext, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../lib/authContext.js";
import { loginDestination } from "../lib/portalAccess.js";
export default function LoginPage({ citizen = false }) {
  const auth = useContext(AuthContext);
  const [params] = useSearchParams();
  const candidate = params.get("returnTo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.loading)
    return (
      <div className="page">
        <p role="status">Checking your session…</p>
      </div>
    );
  if (auth.error)
    return (
      <div className="page">
        <p role="alert">{auth.error}</p>
        <button className="button" onClick={auth.retry}>
          Try again
        </button>
      </div>
    );
  if (auth.user)
    return (
      <Navigate replace to={loginDestination(auth.user.role, candidate)} />
    );
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
      <p className="eyebrow">
        {citizen ? "Citizen reporting" : "AquaShield command center"}
      </p>
      <h1 className="page-title">
        {citizen
          ? "Citizen sign in"
          : candidate?.startsWith("/operator")
            ? "Operator sign in"
            : "Administrator sign in"}
      </h1>
      <p className="page-intro">
        {citizen
          ? "Sign in to submit and track your household reports."
          : "Sign in with your provisioned municipal or operator account."}
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
        {citizen ? (
          <>
            New to AquaShield?{" "}
            <Link to="/register">Create a citizen account</Link>. Email
            ownership and identity remain unverified.
          </>
        ) : (
          <>
            Municipal and operator access is provisioned by an administrator.{" "}
            <Link to="/citizen/login">Citizen sign in</Link> or{" "}
            <Link to="/register">register</Link> to submit a report.
          </>
        )}
      </p>
    </div>
  );
}
