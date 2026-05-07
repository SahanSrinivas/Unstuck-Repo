import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star, Clock, DollarSign } from "lucide-react";
import TutorLayout from "../../components/tutor/TutorLayout";
import api from "../../lib/api";

export function TutorQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    api.get("/tutor/queue").then(({ data }) => { if (!cancelled) setItems(data || []); })
      .catch((e) => console.warn("queue load failed", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return (
    <TutorLayout>
      <div className="max-w-5xl" data-testid="page-tutor-queue">
        <h1 className="u-h2">Incoming doubts</h1>
        <p className="u-body mt-2">Sessions matched to you. Tap to open and start helping.</p>
        <div className="mt-8">
          {loading ? (
            <div className="u-card text-center u-small">Loading…</div>
          ) : items.length === 0 ? (
            <div className="u-card text-center" data-testid="queue-empty">
              <p className="u-body">No incoming doubts right now.</p>
              <p className="u-caption mt-2">When a student matches with you, they'll appear here.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {items.map((s) => (
                <Link to={`/sessions/${s.id}`} key={s.id} className="u-card u-card-hover" data-testid={`queue-item-${s.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display font-semibold text-ink">{s.topic}</div>
                      <div className="u-caption mt-1">{s.tier} · {s.duration_min} min · ${s.price}</div>
                    </div>
                    <span className="u-pill">{s.status}</span>
                  </div>
                  {s.doubt && (
                    <p className="u-small mt-3 line-clamp-3">{s.doubt.description}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="u-caption">Created {new Date(s.created_at).toLocaleString()}</span>
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
    </TutorLayout>
  );
}

export function TutorSessions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    api.get("/tutor/sessions").then(({ data }) => { if (!cancelled) setItems(data || []); })
      .catch((e) => console.warn("sessions load failed", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return (
    <TutorLayout>
      <div className="max-w-5xl" data-testid="page-tutor-sessions">
        <h1 className="u-h2">All sessions</h1>
        <p className="u-body mt-2">Every session you've taken on Unstuck.</p>
        <div className="mt-8">
          {loading ? <div className="u-card text-center u-small">Loading…</div> :
           items.length === 0 ? <div className="u-card text-center u-small">No sessions yet.</div> : (
            <div className="u-card !p-0 overflow-hidden">
              <table className="w-full text-left min-w-[600px]">
                <thead><tr className="bg-canvas-alt">
                  <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Topic</th>
                  <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Status</th>
                  <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Duration</th>
                  <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Price</th>
                  <th className="px-5 py-4" />
                </tr></thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className="border-t border-line">
                      <td className="px-5 py-4 u-body font-medium text-ink">{s.topic}</td>
                      <td className="px-5 py-4 u-small capitalize">{s.status}</td>
                      <td className="px-5 py-4 u-body">{s.duration_min} min</td>
                      <td className="px-5 py-4 u-body">${s.price}</td>
                      <td className="px-5 py-4">
                        <Link to={`/sessions/${s.id}`} className="text-purple-primary text-[14px] font-medium">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           )}
        </div>
      </div>
    </TutorLayout>
  );
}

export function TutorProfile() {
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.get("/tutor/profile").then(({ data }) => setProfile(data))
      .catch((e) => setErr(e.response?.data?.detail || "Profile not available"));
  }, []);
  if (err) {
    return (
      <TutorLayout>
        <div className="u-card text-center" data-testid="profile-no-tutor">
          <p className="u-body">{err}</p>
          <p className="u-caption mt-2">Your account may not be linked to an approved tutor profile yet.</p>
        </div>
      </TutorLayout>
    );
  }
  if (!profile) return <TutorLayout><div className="u-card u-small">Loading…</div></TutorLayout>;
  return (
    <TutorLayout>
      <div className="max-w-3xl" data-testid="page-tutor-profile">
        <h1 className="u-h2">{profile.name}</h1>
        <p className="u-body mt-2">{profile.bio}</p>
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <div className="u-card">
            <div className="flex items-center gap-2 u-small text-ink-muted"><DollarSign size={14} className="text-good" /> Total earnings</div>
            <div className="font-display font-bold text-[36px] text-ink mt-2 leading-none">${profile.earnings_total}</div>
            <div className="u-caption mt-1">After 30% platform fee</div>
          </div>
          <div className="u-card">
            <div className="flex items-center gap-2 u-small text-ink-muted"><Clock size={14} /> Sessions</div>
            <div className="font-display font-bold text-[36px] text-ink mt-2 leading-none">{profile.completed_sessions}</div>
          </div>
          <div className="u-card">
            <div className="flex items-center gap-2 u-small text-ink-muted"><Star size={14} className="text-purple-primary" /> Rating</div>
            <div className="font-display font-bold text-[36px] text-ink mt-2 leading-none">{profile.rating?.toFixed(1)}</div>
          </div>
        </div>
        <div className="mt-8">
          <h3 className="u-h4">Specialties</h3>
          <div className="flex flex-wrap gap-2 mt-3">
            {(profile.specialties || []).map((s) => <span key={s} className="u-pill">{s}</span>)}
          </div>
        </div>
      </div>
    </TutorLayout>
  );
}
