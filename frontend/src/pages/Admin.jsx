import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, RotateCcw, ShieldCheck, Users, Activity } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import api, { formatApiErrorDetail } from "../lib/api";

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="u-card">
      <div className="flex items-center gap-2 u-small text-ink-muted">
        <Icon size={14} strokeWidth={1.75} className="text-purple-primary" /> {label}
      </div>
      <div className="font-display font-bold text-[36px] text-ink mt-2 leading-none">{value}</div>
    </div>
  );
}

export default function AdminConsole() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [apps, setApps] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [tab, setTab] = useState("applications");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, a, r] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/applications"),
        api.get("/admin/refunds"),
      ]);
      setStats(s.data); setApps(a.data || []); setRefunds(r.data || []);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }
    load();
  }, [user, navigate, load]);

  const decide = async (appId, decision) => {
    setBusy(appId);
    try {
      await api.post(`/admin/applications/${appId}/decide`, { decision });
      await load();
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(null);
    }
  };

  if (user && user.role !== "admin") return null;

  return (
    <DashboardLayout>
      <div className="max-w-6xl" data-testid="page-admin">
        <div className="flex items-center gap-2">
          <span className="u-pill"><ShieldCheck size={12} strokeWidth={2} /> Admin</span>
        </div>
        <h1 className="u-h2 mt-3">Admin console</h1>
        <p className="u-body mt-2">Review tutor applications and refund queue.</p>

        {stats && (
          <div className="grid sm:grid-cols-4 gap-4 mt-8">
            <StatCard label="Pending apps" value={stats.applications.pending} icon={Activity} />
            <StatCard label="Approved" value={stats.applications.approved} icon={Check} />
            <StatCard label="Total users" value={stats.users} icon={Users} />
            <StatCard label="Refunded sessions" value={stats.refunded_sessions} icon={RotateCcw} />
          </div>
        )}

        <div className="mt-10 flex gap-2 border-b border-line" data-testid="admin-tabs">
          <button
            className={`px-4 py-2.5 -mb-px border-b-2 font-medium text-[14.5px] ${
              tab === "applications" ? "border-purple-primary text-purple-primary" : "border-transparent text-ink-muted hover:text-ink"
            }`}
            onClick={() => setTab("applications")}
            data-testid="tab-applications"
          >
            Tutor applications ({apps.length})
          </button>
          <button
            className={`px-4 py-2.5 -mb-px border-b-2 font-medium text-[14.5px] ${
              tab === "refunds" ? "border-purple-primary text-purple-primary" : "border-transparent text-ink-muted hover:text-ink"
            }`}
            onClick={() => setTab("refunds")}
            data-testid="tab-refunds"
          >
            Refund queue ({refunds.length})
          </button>
        </div>

        {err && <div className="u-small text-bad mt-4" data-testid="admin-error">{err}</div>}

        {tab === "applications" && (
          <div className="mt-6 space-y-3" data-testid="applications-list">
            {apps.length === 0 ? (
              <div className="u-card text-center u-small">No applications yet.</div>
            ) : apps.map((a) => (
              <div key={a.id} className="u-card" data-testid={`app-${a.id}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-ink">{a.name}</div>
                    <div className="u-caption">{a.email} · {a.years_experience} yrs · applied {new Date(a.created_at).toLocaleDateString()}</div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(a.specialties || []).map((s) => <span key={s} className="u-pill text-[12px]">{s}</span>)}
                    </div>
                    <p className="u-small mt-3">{a.pitch}</p>
                    {a.linkedin && <a className="u-caption text-purple-primary mt-1 inline-block" href={a.linkedin} target="_blank" rel="noreferrer">{a.linkedin}</a>}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === "pending" ? (
                      <>
                        <button
                          className="u-btn-primary !py-2 !px-3 text-[13.5px]"
                          onClick={() => decide(a.id, "approve")}
                          disabled={busy === a.id}
                          data-testid={`approve-${a.id}`}
                        >
                          <Check size={14} strokeWidth={2} /> Approve
                        </button>
                        <button
                          className="u-btn-secondary !py-2 !px-3 text-[13.5px]"
                          onClick={() => decide(a.id, "reject")}
                          disabled={busy === a.id}
                          data-testid={`reject-${a.id}`}
                        >
                          <X size={14} strokeWidth={2} /> Reject
                        </button>
                      </>
                    ) : (
                      <span className={`u-pill ${a.status === "approved" ? "!bg-good/10 !text-good" : "!bg-bad/10 !text-bad"}`}>
                        {a.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "refunds" && (
          <div className="mt-6" data-testid="refunds-list">
            {refunds.length === 0 ? (
              <div className="u-card text-center u-small">No refunds yet.</div>
            ) : (
              <div className="u-card !p-0 overflow-hidden">
                <table className="w-full text-left min-w-[640px]">
                  <thead><tr className="bg-canvas-alt">
                    <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Student</th>
                    <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Topic</th>
                    <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Tutor</th>
                    <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Date</th>
                  </tr></thead>
                  <tbody>
                    {refunds.map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <td className="px-5 py-4 u-body">{r.student_name || r.student_email || "—"}</td>
                        <td className="px-5 py-4 u-body font-medium text-ink">{r.topic}</td>
                        <td className="px-5 py-4 u-body">{r.tutor_name}</td>
                        <td className="px-5 py-4 u-body">${r.price?.toFixed(0)}</td>
                        <td className="px-5 py-4 u-small">{new Date(r.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
