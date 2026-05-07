import React, { useEffect, useState } from "react";
import { Key, Trash2, Plus, ShieldCheck } from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import api, { formatApiErrorDetail } from "../../lib/api";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [nameErr, setNameErr] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const saveName = async (e) => {
    e.preventDefault();
    setNameMsg(""); setNameErr(""); setSavingName(true);
    try {
      await api.patch("/auth/me", { name });
      await refresh();
      setNameMsg("Profile updated.");
    } catch (ex) {
      setNameErr(formatApiErrorDetail(ex.response?.data?.detail) || ex.message);
    } finally {
      setSavingName(false);
    }
  };

  const savePw = async (e) => {
    e.preventDefault();
    setPwMsg(""); setPwErr(""); setSavingPw(true);
    try {
      await api.post("/auth/password", { current_password: currentPw, new_password: newPw });
      setPwMsg("Password changed.");
      setCurrentPw(""); setNewPw("");
    } catch (ex) {
      setPwErr(formatApiErrorDetail(ex.response?.data?.detail) || ex.message);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl" data-testid="page-settings">
        <h1 className="u-h2">Settings</h1>
        <p className="u-body mt-2">Manage your profile, sign-in methods and password.</p>

        <PasskeyCard />

        <div className="u-card mt-8" data-testid="settings-profile-card">
          <h3 className="u-h4">Profile</h3>
          <form onSubmit={saveName} className="mt-5 space-y-4" data-testid="settings-profile-form">
            <div>
              <label className="u-small font-medium text-ink block mb-1.5">Email</label>
              <input className="u-input bg-canvas-alt" value={user?.email || ""} disabled data-testid="settings-email" />
              <div className="u-caption mt-1">Email is locked. Contact support to change it.</div>
            </div>
            <div>
              <label className="u-small font-medium text-ink block mb-1.5">Display name</label>
              <input className="u-input" value={name} onChange={(e) => setName(e.target.value)} required minLength={1} maxLength={80} data-testid="settings-name" />
            </div>
            {nameMsg && <div className="u-small text-good" data-testid="settings-name-success">{nameMsg}</div>}
            {nameErr && <div className="u-small text-bad" data-testid="settings-name-error">{nameErr}</div>}
            <button type="submit" className="u-btn-primary" disabled={savingName} data-testid="settings-save-name">
              {savingName ? "Saving…" : "Save profile"}
            </button>
          </form>
        </div>

        <div className="u-card mt-6" data-testid="settings-password-card">
          <h3 className="u-h4">Change password (legacy)</h3>
          <p className="u-caption mt-1">Only used by the original admin account. New users sign in passwordlessly.</p>
          <form onSubmit={savePw} className="mt-5 space-y-4" data-testid="settings-password-form">
            <div>
              <label className="u-small font-medium text-ink block mb-1.5">Current password</label>
              <input
                type="password"
                className="u-input"
                required
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                data-testid="settings-current-pw"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="u-small font-medium text-ink block mb-1.5">New password</label>
              <input
                type="password"
                className="u-input"
                required
                minLength={6}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                data-testid="settings-new-pw"
                autoComplete="new-password"
              />
              <div className="u-caption mt-1">At least 6 characters.</div>
            </div>
            {pwMsg && <div className="u-small text-good" data-testid="settings-pw-success">{pwMsg}</div>}
            {pwErr && <div className="u-small text-bad" data-testid="settings-pw-error">{pwErr}</div>}
            <button type="submit" className="u-btn-primary" disabled={savingPw} data-testid="settings-save-pw">
              {savingPw ? "Saving…" : "Change password"}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

function PasskeyCard() {
  const [methods, setMethods] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/auth/methods");
      setMethods(data);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const addPasskey = async () => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { data: options } = await api.post("/auth/passkey/register/begin", {});
      const credential = await startRegistration({ optionsJSON: options });
      await api.post("/auth/passkey/register/complete", { credential });
      setMsg("Passkey added to this device.");
      await load();
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message || "Passkey enrollment cancelled");
    } finally {
      setBusy(false);
    }
  };

  const removePasskey = async (cred_id) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      await api.delete(`/auth/passkey/${encodeURIComponent(cred_id)}`);
      await load();
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="u-card mt-8" data-testid="settings-passkey-card">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-md bg-purple-soft flex items-center justify-center text-purple-primary"><ShieldCheck size={20} strokeWidth={1.75} /></div>
        <div className="flex-1">
          <h3 className="u-h4">Passkeys</h3>
          <p className="u-small mt-1">Sign in with your face, fingerprint, or device PIN — no codes, no passwords.</p>
        </div>
      </div>
      <div className="mt-5 space-y-2" data-testid="passkey-list">
        {methods?.passkeys?.length === 0 && <div className="u-caption">No passkeys yet on this account.</div>}
        {(methods?.passkeys || []).map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-canvas-alt rounded-md" data-testid={`passkey-${p.id.slice(0,8)}`}>
            <div className="flex items-center gap-2">
              <Key size={16} strokeWidth={1.75} className="text-purple-primary" />
              <div>
                <div className="font-mono text-[12.5px] text-ink">{p.id.slice(0, 24)}…</div>
                <div className="u-caption">Added {p.registered_at ? new Date(p.registered_at).toLocaleDateString() : ""}</div>
              </div>
            </div>
            <button className="text-bad hover:bg-bad/10 p-2 rounded-md" onClick={() => removePasskey(p.id)} aria-label="Remove passkey" data-testid={`passkey-remove-${p.id.slice(0,8)}`}>
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
      {msg && <div className="u-small text-good mt-3" data-testid="passkey-success">{msg}</div>}
      {err && <div className="u-small text-bad mt-3" data-testid="passkey-error">{err}</div>}
      <button className="u-btn-primary mt-5" onClick={addPasskey} disabled={busy} data-testid="add-passkey-btn">
        <Plus size={16} strokeWidth={2} /> {busy ? "Waiting for device…" : "Add a passkey"}
      </button>
      <p className="u-caption mt-2">
        {methods?.google ? "Linked: Google account · " : ""}
        Use a passkey to skip the email-code step next time.
      </p>
    </div>
  );
}
