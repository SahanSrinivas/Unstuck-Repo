import React, { useState } from "react";
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
        <p className="u-body mt-2">Manage your profile and password.</p>

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
          <h3 className="u-h4">Change password</h3>
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
