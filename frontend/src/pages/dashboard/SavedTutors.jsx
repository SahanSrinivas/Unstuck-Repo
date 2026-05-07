import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, BookmarkX, Star, Clock } from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../lib/api";

export default function SavedTutors() {
  const [saved, setSaved] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([api.get("/saved-tutors"), api.get("/tutors")]);
      setSaved(s.data || []);
      setAll(a.data || []);
    } catch (e) {
      console.warn("saved-tutors load failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const savedIds = new Set(saved.map((t) => t.id));

  const toggle = async (tutorId, isSaved) => {
    try {
      if (isSaved) await api.delete(`/saved-tutors/${tutorId}`);
      else await api.post(`/saved-tutors/${tutorId}`);
      load();
    } catch (e) {
      console.warn("toggle saved failed", e);
    }
  };

  const TutorRow = ({ tutor, isSaved }) => (
    <div className="u-card u-card-hover" data-testid={`saved-tutor-${tutor.id}`}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-purple-soft text-purple-primary flex items-center justify-center font-display font-semibold">{tutor.avatar}</div>
        <div className="flex-1">
          <div className="font-display font-semibold text-ink">{tutor.name}</div>
          <div className="u-caption">{tutor.bio}</div>
        </div>
        <button
          onClick={() => toggle(tutor.id, isSaved)}
          className={`p-2 rounded-md transition-colors ${isSaved ? "text-purple-primary hover:bg-purple-soft" : "text-ink-soft hover:text-purple-primary hover:bg-canvas-alt"}`}
          aria-label={isSaved ? "Unsave tutor" : "Save tutor"}
          data-testid={`toggle-save-${tutor.id}`}
        >
          {isSaved ? <BookmarkX size={18} strokeWidth={1.75} /> : <Bookmark size={18} strokeWidth={1.75} />}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {tutor.specialties.slice(0, 4).map((sp) => (<span key={sp} className="u-pill text-[12px]">{sp}</span>))}
      </div>
      <div className="flex items-center gap-4 mt-4 u-caption">
        <span className="inline-flex items-center gap-1 text-ink"><Star size={12} strokeWidth={2} className="text-purple-primary" /> {tutor.rating.toFixed(1)}</span>
        <span className="inline-flex items-center gap-1"><Clock size={12} strokeWidth={2} /> ~{tutor.response_time_min} min</span>
        <span>{tutor.rate_hint}</span>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl" data-testid="page-saved-tutors">
        <h1 className="u-h2">Saved tutors</h1>
        <p className="u-body mt-2">Bookmark tutors you've liked. They'll appear first on your next match.</p>

        <h3 className="u-h4 mt-10">Your bookmarks</h3>
        <div className="mt-4">
          {loading ? (
            <div className="u-card text-center u-small">Loading…</div>
          ) : saved.length === 0 ? (
            <div className="u-card text-center u-small" data-testid="saved-empty">
              No bookmarks yet — save tutors below to add them.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {saved.map((t) => <TutorRow key={t.id} tutor={t} isSaved={true} />)}
            </div>
          )}
        </div>

        <h3 className="u-h4 mt-12">All available tutors</h3>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          {all.map((t) => <TutorRow key={t.id} tutor={t} isSaved={savedIds.has(t.id)} />)}
        </div>

        <div className="mt-10">
          <Link to="/doubts/new" className="u-btn-primary">Start a doubt</Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
