import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, RotateCcw } from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../lib/api";

const STATUS_STYLES = {
  scheduled: "bg-purple-soft text-purple-primary",
  active: "bg-info/10 text-info",
  completed: "bg-good/10 text-good",
  cancelled: "bg-bad/10 text-bad",
};

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get("/sessions").then(({ data }) => {
      if (cancelled) return;
      setItems((data || []).filter((s) => s.status === "completed" || s.status === "cancelled"));
    }).catch((e) => console.warn("history load failed", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-5xl" data-testid="page-history">
        <h1 className="u-h2">History</h1>
        <p className="u-body mt-2">Every session you've completed, with resolution and refund status.</p>

        <div className="mt-8">
          {loading ? (
            <div className="u-card text-center u-small">Loading…</div>
          ) : items.length === 0 ? (
            <div className="u-card text-center" data-testid="history-empty">
              <p className="u-body">No completed sessions yet.</p>
              <Link to="/doubts/new" className="u-btn-primary mt-4 inline-flex">Start your first doubt</Link>
            </div>
          ) : (
            <div className="u-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[720px]" data-testid="history-table">
                  <thead>
                    <tr className="bg-canvas-alt">
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Topic</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Tutor</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Status</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Resolution</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Price</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => (
                      <tr key={s.id} className="border-t border-line" data-testid={`history-row-${s.id}`}>
                        <td className="px-5 py-4 u-body font-medium text-ink">
                          <Link to={`/sessions/${s.id}`} className="hover:text-purple-primary">{s.topic}</Link>
                        </td>
                        <td className="px-5 py-4 u-body">{s.tutor_name}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium ${STATUS_STYLES[s.status] || ""}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />{s.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 u-small">
                          {s.resolution === "resolved" && (
                            <span className="inline-flex items-center gap-1 text-good"><CheckCircle2 size={14} strokeWidth={2} /> Resolved</span>
                          )}
                          {s.resolution === "refunded" && (
                            <span className="inline-flex items-center gap-1 text-warn"><RotateCcw size={14} strokeWidth={2} /> Refunded</span>
                          )}
                          {!s.resolution && <span className="text-ink-soft">—</span>}
                        </td>
                        <td className="px-5 py-4 u-body">${s.price.toFixed(0)}</td>
                        <td className="px-5 py-4 u-small">{new Date(s.created_at).toLocaleDateString()}</td>
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
