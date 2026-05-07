import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/marketing/Navbar";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register, error } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await register(email, password, name);
    setSubmitting(false);
    if (ok) navigate("/doubts/new", { replace: true });
  };

  return (
    <div className="App min-h-screen flex flex-col" data-testid="page-register">
      <Navbar />
      <main className="flex-1 flex items-center justify-center u-hero-wash">
        <div className="u-container max-w-[440px] py-16">
          <div className="u-card bg-white">
            <span className="u-pill">Free to start</span>
            <h1 className="u-h3 mt-4">Create your Unstuck account</h1>
            <p className="u-small mt-2">Your first AI attempt is free. You only pay if a human is needed.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="register-form">
              <div>
                <label className="u-small font-medium text-ink block mb-1.5">Name</label>
                <input
                  type="text"
                  className="u-input"
                  required
                  minLength={1}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="register-name"
                />
              </div>
              <div>
                <label className="u-small font-medium text-ink block mb-1.5">Email</label>
                <input
                  type="email"
                  className="u-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="register-email"
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
                  data-testid="register-password"
                  autoComplete="new-password"
                />
                <div className="u-caption mt-1">At least 6 characters.</div>
              </div>
              {error && <div className="u-small text-bad" data-testid="register-error">{error}</div>}
              <button type="submit" className="u-btn-primary w-full" disabled={submitting} data-testid="register-submit">
                {submitting ? "Creating account…" : "Create account"}
              </button>
            </form>
            <div className="u-small mt-5 text-center">
              Already have an account? <Link to="/login" className="text-purple-primary font-medium" data-testid="register-to-login">Sign in</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
