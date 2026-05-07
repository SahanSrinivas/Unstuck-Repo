import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/marketing/Navbar";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();
  const next = loc.state?.from?.pathname || "/dashboard";

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await login(email, password);
    setSubmitting(false);
    if (ok) navigate(next, { replace: true });
  };

  return (
    <div className="App min-h-screen flex flex-col" data-testid="page-login">
      <Navbar />
      <main className="flex-1 flex items-center justify-center u-hero-wash">
        <div className="u-container max-w-[440px] py-16">
          <div className="u-card bg-white">
            <span className="u-pill">Welcome back</span>
            <h1 className="u-h3 mt-4">Sign in to Unstuck</h1>
            <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="login-form">
              <div>
                <label className="u-small font-medium text-ink block mb-1.5">Email</label>
                <input
                  type="email"
                  className="u-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="u-small font-medium text-ink block mb-1.5">Password</label>
                <input
                  type="password"
                  className="u-input"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password"
                  autoComplete="current-password"
                />
              </div>
              {error && <div className="u-small text-bad" data-testid="login-error">{error}</div>}
              <button type="submit" className="u-btn-primary w-full" disabled={submitting} data-testid="login-submit">
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <div className="u-small mt-5 text-center">
              New here? <Link to="/register" className="text-purple-primary font-medium" data-testid="login-to-register">Create an account</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
