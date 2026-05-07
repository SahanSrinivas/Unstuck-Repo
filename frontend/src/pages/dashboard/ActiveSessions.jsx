import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../lib/api";

export default function ActiveSessions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get("/sessions").then(({ data }) => {
      if (cancelled) return;
      setItems((data || []).filter((s) => s.status === "scheduled" || s.status === "active"));
    }).catch((e) => console.warn("active-sessions load failed", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-5xl" data-testid="page-active-sessions">
        <h1 className="u-h2">Active sessions</h1>
        <p className="u-body mt-2">Scheduled and in-progress sessions. Tap one to jump in.</p>

        <div className="mt-8">
          {loading ? (
            <div className="u-card text-center u-small">Loading…</div>
          ) : items.length === 0 ? (
            <div className="u-card text-center" data-testid="active-empty">
              <p className="u-body">Nothing active right now.</p>
              <Link to="/doubts/new" className="u-btn-primary mt-4 inline-flex">Start a new doubt</Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {items.map((s) => (
                <Link key={s.id} to={`/sessions/${s.id}`} className="u-card u-card-hover" data-testid={`active-${s.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display font-semibold text-ink">{s.topic} with {s.tutor_name}</div>
                      <div className="u-caption mt-1">{s.tier} · {s.duration_min} min · ${s.price.toFixed(0)}</div>
                    </div>
                    <span className="u-pill">{s.status}</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="u-caption inline-flex items-center gap-1.5"><Clock size={12} strokeWidth={2} /> Created {new Date(s.created_at).toLocaleString()}</span>
                    <span className="text-purple-primary text-[14px] font-medium inline-flex items-center gap-1">
                      Open <ArrowRight size={14} strokeWidth={2} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
