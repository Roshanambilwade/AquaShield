import { useContext, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthContext } from "../lib/authContext.js";
import { portalHome } from "../lib/portalAccess.js";
export default function RegisterPage() {
  const auth = useContext(AuthContext);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [created, setCreated] = useState(false);
  if (auth.user) return <Navigate replace to={portalHome(auth.user.role)} />;
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await auth.register({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      });
      setCreated(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page login-page">
      <p className="eyebrow">Citizen access</p>
      <h1 className="page-title">Create your citizen account</h1>
      <p className="page-intro">
        Save and track your own household reports across sign-ins.
      </p>
      {created ? (
        <section className="login-card">
          <p role="status">
            Account created. Sign in to submit and track reports.
          </p>
          <Link className="button" to="/citizen/login">
            Citizen sign in
          </Link>
        </section>
      ) : (
        <form className="login-card" onSubmit={submit}>
          {error && <p role="alert">{error}</p>}
          <label htmlFor="citizen-name">Full name</label>
          <input
            id="citizen-name"
            name="name"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            required
          />
          <label htmlFor="citizen-email">Email</label>
          <input
            id="citizen-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
          <label htmlFor="citizen-password">Password</label>
          <input
            id="citizen-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            required
          />
          <label htmlFor="citizen-confirm">Confirm password</label>
          <input
            id="citizen-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            required
          />
          <p className="evidence-note">
            Use at least 12 characters. Email ownership and identity are not
            verified; do not enter government identification or an address here.
          </p>
          <button className="button" disabled={busy || auth.loading}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}
      <p>
        Already registered? <Link to="/citizen/login">Citizen sign in</Link>
      </p>
    </div>
  );
}
