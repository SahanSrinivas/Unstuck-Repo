import React, { useState } from "react";
import Navbar from "../components/marketing/Navbar";
import Footer from "../components/marketing/Footer";
import api, { formatApiErrorDetail } from "../lib/api";
import { Check } from "lucide-react";

const SPECIALTY_OPTIONS = ["RAG", "Agents", "Fine-tuning", "MLOps", "Prompting", "Evals"];

export default function TutorApply() {
  const [form, setForm] = useState({
    name: "", email: "", years_experience: 3, linkedin: "", pitch: "", specialties: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const toggleSpec = (s) => {
    const ns = form.specialties.includes(s) ? form.specialties.filter((x) => x !== s) : [...form.specialties, s];
    setForm({ ...form, specialties: ns });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErr("");
    try {
      await api.post("/tutors/apply", { ...form, years_experience: parseInt(form.years_experience, 10) || 0 });
      setDone(true);
    } catch (ex) {
      setErr(formatApiErrorDetail(ex.response?.data?.detail) || ex.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="App min-h-screen flex flex-col" data-testid="page-tutor-apply">
      <Navbar />
      <main className="flex-1 bg-canvas-alt">
        <div className="u-container py-16">
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <span className="u-pill">For tutors</span>
              <h1 className="u-h2 mt-4">Apply to tutor on Unstuck</h1>
              <p className="u-body-lg mt-5">
                We accept ~30% of applicants. We'll review yours within 3 business days
                and follow up with a brief technical screen.
              </p>
              <ul className="mt-7 space-y-3 u-body">
                <li className="flex items-start gap-2"><Check size={16} className="text-purple-primary mt-1" /> Set your own hours</li>
                <li className="flex items-start gap-2"><Check size={16} className="text-purple-primary mt-1" /> Same-day payouts</li>
                <li className="flex items-start gap-2"><Check size={16} className="text-purple-primary mt-1" /> No bidding, no proposals</li>
              </ul>
            </div>

            <div className="lg:col-span-2">
              <div className="u-card bg-white">
                {done ? (
                  <div data-testid="tutor-apply-success">
                    <span className="u-pill">Application received</span>
                    <h2 className="u-h3 mt-4">Thanks — we'll be in touch.</h2>
                    <p className="u-body mt-3">
                      We review every application personally. Expect an email within 3 business days
                      from <span className="text-purple-primary font-medium">tutors@unstuck.dev</span>.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-5" data-testid="tutor-apply-form">
                    <div className="grid md:grid-cols-2 gap-5">
                      <div>
                        <label className="u-small font-medium text-ink block mb-1.5">Full name</label>
                        <input className="u-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="tutor-name" />
                      </div>
                      <div>
                        <label className="u-small font-medium text-ink block mb-1.5">Work email</label>
                        <input type="email" className="u-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="tutor-email" />
                      </div>
                      <div>
                        <label className="u-small font-medium text-ink block mb-1.5">Years of AI/ML experience</label>
                        <input type="number" min="0" className="u-input" required value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} data-testid="tutor-years" />
                      </div>
                      <div>
                        <label className="u-small font-medium text-ink block mb-1.5">LinkedIn / portfolio</label>
                        <input className="u-input" placeholder="https://…" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} data-testid="tutor-linkedin" />
                      </div>
                    </div>
                    <div>
                      <label className="u-small font-medium text-ink block mb-2">Specialties (pick all that apply)</label>
                      <div className="flex flex-wrap gap-2" data-testid="tutor-specialties">
                        {SPECIALTY_OPTIONS.map((s) => {
                          const on = form.specialties.includes(s);
                          return (
                            <button
                              type="button"
                              key={s}
                              onClick={() => toggleSpec(s)}
                              className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                                on ? "bg-purple-primary text-white border-purple-primary" : "bg-white text-ink border-line hover:border-purple-primary hover:text-purple-primary"
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="u-small font-medium text-ink block mb-1.5">Why you'd be a great Unstuck tutor</label>
                      <textarea
                        className="u-textarea min-h-[120px]"
                        required
                        minLength={20}
                        placeholder="Tell us about a non-trivial AI engineering problem you shipped a fix for…"
                        value={form.pitch}
                        onChange={(e) => setForm({ ...form, pitch: e.target.value })}
                        data-testid="tutor-pitch"
                      />
                    </div>
                    {err && <div className="u-small text-bad" data-testid="tutor-apply-error">{err}</div>}
                    <button type="submit" className="u-btn-primary" disabled={submitting} data-testid="tutor-apply-submit">
                      {submitting ? "Submitting…" : "Submit application"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
