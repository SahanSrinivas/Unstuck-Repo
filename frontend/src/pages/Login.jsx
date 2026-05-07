import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, Key, ArrowRight, ShieldCheck } from "lucide-react";
import Navbar from "../components/marketing/Navbar";
import api, { formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { id: "google", label: "Google" },
  { id: "otp", label: "Email code" },
  { id: "passkey", label: "Passkey" },
];

export default function Login() {
  const [tab, setTab] = useState("google");
  return (
    <div className="App min-h-screen flex flex-col" data-testid="page-login">
      <Navbar />
      <main className="flex-1 flex items-center justify-center u-hero-wash">
        <div className="u-container max-w-[460px] py-16">
          <div className="u-card bg-white">
            <span className="u-pill"><ShieldCheck size={12} strokeWidth={2} /> Passwordless</span>
            <h1 className="u-h3 mt-4">Sign in to Unstuck</h1>
            <p className="u-small mt-2">No passwords. Pick how you'd like to authenticate.</p>

            <div className="mt-6 flex gap-1.5 p-1 bg-canvas-alt rounded-md" data-testid="login-tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={`flex-1 px-3 py-2 rounded text-[14px] font-medium transition-colors ${
                    tab === t.id ? "bg-white text-purple-primary shadow-sm" : "text-ink-muted hover:text-ink"
                  }`}
                  onClick={() => setTab(t.id)}
                  data-testid={`tab-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === "google" && <GooglePane />}
              {tab === "otp" && <OtpPane />}
              {tab === "passkey" && <PasskeyPane />}
            </div>

            <div className="h-px bg-line my-6" />
            <div className="u-caption text-center">
              By continuing you agree to our terms · <Link to="/" className="text-purple-primary">Back home</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Google ---
function GooglePane() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onClick = async () => {
    setErr(""); setBusy(true);
    try {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUri = window.location.origin + "/auth/google";
      const { data } = await api.get(`/auth/google/start?redirect_uri=${encodeURIComponent(redirectUri)}`);
      sessionStorage.setItem("google_oauth_state", data.state);
      sessionStorage.setItem("google_redirect_uri", redirectUri);
      window.location.href = data.url;
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="login-google-pane">
      <button onClick={onClick} disabled={busy} className="u-btn-secondary w-full" data-testid="google-signin-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09a7.21 7.21 0 010-4.18V7.07H2.18a11 11 0 000 9.86l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>
      {err && <div className="u-small text-bad" data-testid="google-error">{err}</div>}
      <p className="u-caption">We'll only request your name, email and avatar.</p>
    </div>
  );
}

// --- Email OTP ---
function OtpPane() {
  const [step, setStep] = useState("send"); // send | verify
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const next = loc.state?.from?.pathname || "/dashboard";

  const sendCode = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const { data } = await api.post("/auth/otp/send", { email, name });
      if (data?.dev_code) setDevCode(data.dev_code);
      setStep("verify");
    } catch (ex) {
      setErr(formatApiErrorDetail(ex.response?.data?.detail) || ex.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api.post("/auth/otp/verify", { email, code, name });
      await refresh();
      navigate(next, { replace: true });
    } catch (ex) {
      setErr(formatApiErrorDetail(ex.response?.data?.detail) || ex.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === "send") {
    return (
      <form onSubmit={sendCode} className="space-y-4" data-testid="otp-send-form">
        <div>
          <label className="u-small font-medium text-ink block mb-1.5">Email</label>
          <input type="email" required className="u-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" data-testid="otp-email" />
        </div>
        <div>
          <label className="u-small font-medium text-ink block mb-1.5">Your name (only on first sign-in)</label>
          <input className="u-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" data-testid="otp-name" />
        </div>
        {err && <div className="u-small text-bad" data-testid="otp-error">{err}</div>}
        <button type="submit" disabled={busy} className="u-btn-primary w-full" data-testid="otp-send-btn">
          <Mail size={16} strokeWidth={2} /> {busy ? "Sending…" : "Email me a code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4" data-testid="otp-verify-form">
      <div className="u-small">We sent a 6-digit code to <b>{email}</b>. It expires in 10 minutes.</div>
      {devCode && (
        <div className="u-card !p-3 !bg-purple-soft !border-purple-primary/30" data-testid="dev-code-banner">
          <div className="u-caption text-purple-primary">Dev mode (Resend not configured)</div>
          <div className="font-mono text-[20px] font-bold tracking-[6px] text-purple-primary">{devCode}</div>
        </div>
      )}
      <div>
        <label className="u-small font-medium text-ink block mb-1.5">Enter code</label>
        <input
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          className="u-input font-mono text-center tracking-[10px] text-[20px]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          data-testid="otp-code"
          autoFocus
        />
      </div>
      {err && <div className="u-small text-bad" data-testid="otp-verify-error">{err}</div>}
      <button type="submit" disabled={busy || code.length !== 6} className="u-btn-primary w-full" data-testid="otp-verify-btn">
        {busy ? "Verifying…" : "Sign in"}
      </button>
      <button type="button" className="u-small text-ink-muted hover:text-purple-primary block mx-auto" onClick={() => setStep("send")}>
        Use a different email
      </button>
    </form>
  );
}

// --- Passkey ---
function PasskeyPane() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const next = loc.state?.from?.pathname || "/dashboard";

  const signIn = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const { data: options } = await api.post("/auth/passkey/login/begin", { email });
      const credential = await startAuthentication({ optionsJSON: options });
      await api.post("/auth/passkey/login/complete", { credential });
      await refresh();
      navigate(next, { replace: true });
    } catch (ex) {
      setErr(formatApiErrorDetail(ex.response?.data?.detail) || ex.message || "Passkey sign-in cancelled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={signIn} className="space-y-4" data-testid="passkey-form">
      <div>
        <label className="u-small font-medium text-ink block mb-1.5">Email</label>
        <input type="email" required className="u-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" data-testid="passkey-email" />
      </div>
      {err && <div className="u-small text-bad" data-testid="passkey-error">{err}</div>}
      <button type="submit" disabled={busy || !email} className="u-btn-primary w-full" data-testid="passkey-signin-btn">
        <Key size={16} strokeWidth={2} /> {busy ? "Waiting for device…" : "Sign in with passkey"}
      </button>
      <p className="u-caption">First time? Sign in with email code, then add a passkey from Settings.</p>
    </form>
  );
}
