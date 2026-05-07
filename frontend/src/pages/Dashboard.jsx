import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Sparkles, ArrowRight } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const STATUS_STYLES = {
  scheduled: "bg-purple-soft text-purple-primary",
  active: "bg-info/10 text-info",
  completed: "bg-good/10 text-good",
  cancelled: "bg-bad/10 text-bad",
};

function StatusPill({ status }) {
  const cls = STATUS_STYLES[status] || "bg-canvas-alt text-ink-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium ${cls}`} data-testid={`status-${status}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, i] = await Promise.all([
          api.get("/sessions"),
          api.get("/insights"),
        ]);
        if (!cancelled) {
          setSessions(s.data || []);
          setInsight(i.data || null);
        }
      } catch (e) {
        console.warn("dashboard load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardLayout>
      <div data-testid="dashboard-main" className="max-w-5xl">
        {/* greeting */}
        <div className="u-card u-hero-wash !bg-white border-purple-soft">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <span className="u-pill">Hi {user?.name?.split(" ")[0] || "there"}</span>
              <h1 className="u-h2 mt-3">What's blocking you?</h1>
              <p className="u-body mt-2 max-w-lg">
                Submit a doubt — the AI takes the first crack, then a human steps
                in only if you need one.
              </p>
            </div>
            <Link to="/doubts/new" className="u-btn-primary" data-testid="dashboard-new-doubt-cta">
              <Plus size={18} strokeWidth={2} /> New Doubt
            </Link>
          </div>
        </div>

        {/* AI insight */}
        {insight && (
          <div className="u-card mt-8 bg-canvas-alt border-purple-soft" data-testid="ai-insight-card">
            <div className="flex gap-4">
              <div className="w-11 h-11 rounded-md bg-purple-primary text-white flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <span className="u-pill">{insight.tag}</span>
                <h3 className="u-h4 mt-2">{insight.title}</h3>
                <p className="u-body mt-2">{insight.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* sessions */}
        <div className="mt-10">
          <div className="flex items-end justify-between mb-4">
            <h2 className="u-h3">Recent sessions</h2>
            <span className="u-caption">{sessions.length} total</span>
          </div>

          {loading ? (
            <div className="u-card text-center u-small">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="u-card text-center" data-testid="no-sessions">
              <p className="u-body">No sessions yet — submit your first doubt.</p>
              <Link to="/doubts/new" className="u-btn-primary mt-4 inline-flex"><Plus size={16} strokeWidth={2} /> New Doubt</Link>
            </div>
          ) : (
            <div className="u-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]" data-testid="sessions-table">
                  <thead>
                    <tr className="bg-canvas-alt">
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Topic</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Tutor</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Status</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Duration</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Price</th>
                      <th className="px-5 py-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-t border-line" data-testid={`session-row-${s.id}`}>
                        <td className="px-5 py-4 u-body font-medium text-ink">{s.topic}</td>
                        <td className="px-5 py-4 u-body">{s.tutor_name}</td>
                        <td className="px-5 py-4"><StatusPill status={s.status} /></td>
                        <td className="px-5 py-4 u-body">{s.duration_min} min</td>
                        <td className="px-5 py-4 u-body">${s.price.toFixed(0)}</td>
                        <td className="px-5 py-4">
                          <Link to={`/sessions/${s.id}`} className="text-purple-primary text-[14px] font-medium inline-flex items-center gap-1">
                            View <ArrowRight size={14} strokeWidth={2} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
