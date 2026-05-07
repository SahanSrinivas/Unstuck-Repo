import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function GoogleCallback() {
  const [params] = useSearchParams();
  const [err, setErr] = useState("");
  const { refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function exchange() {
      const code = params.get("code");
      const state = params.get("state");
      const expectedState = sessionStorage.getItem("google_oauth_state");
      const redirectUri = sessionStorage.getItem("google_redirect_uri") || (window.location.origin + "/auth/google");
      if (params.get("error")) {
        if (!cancelled) setErr(params.get("error_description") || params.get("error"));
        return;
      }
      if (!code) {
        if (!cancelled) setErr("Missing authorization code");
        return;
      }
      if (expectedState && state !== expectedState) {
        if (!cancelled) setErr("OAuth state mismatch — please retry");
        return;
      }
      try {
        await api.post("/auth/google/callback", { code, redirect_uri: redirectUri });
        sessionStorage.removeItem("google_oauth_state");
        sessionStorage.removeItem("google_redirect_uri");
        await refresh();
        if (!cancelled) navigate("/dashboard", { replace: true });
      } catch (e) {
        if (!cancelled) setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      }
    }
    exchange();
    return () => { cancelled = true; };
  }, [params, navigate, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center u-hero-wash" data-testid="page-google-callback">
      <div className="u-card max-w-sm text-center">
        {err ? (
          <>
            <h2 className="u-h3 text-bad">Sign-in failed</h2>
            <p className="u-small mt-3">{err}</p>
            <button className="u-btn-primary mt-5" onClick={() => navigate("/login")}>Try again</button>
          </>
        ) : (
          <>
            <h2 className="u-h3">Signing you in…</h2>
            <p className="u-small mt-3">Just a moment while we finish authenticating with Google.</p>
          </>
        )}
      </div>
    </div>
  );
}
