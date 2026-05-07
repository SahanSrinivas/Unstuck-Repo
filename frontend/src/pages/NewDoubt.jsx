import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Sparkles, Check, Clock, Star, Loader2 } from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { TIERS } from "../components/marketing/Pricing";
import api, { formatApiErrorDetail } from "../lib/api";

const TOPIC_OPTIONS = ["RAG", "Agents", "Fine-tuning", "MLOps", "Prompting", "Evals"];

function Stepper({ step }) {
  const steps = ["Describe", "AI tries first", "Match & pay"];
  return (
    <div className="flex items-center gap-3 u-small" data-testid="doubt-stepper">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-2 ${active || done ? "text-purple-primary" : "text-ink-soft"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold ${active || done ? "bg-purple-primary text-white" : "bg-canvas-alt text-ink-muted"}`}>
                {done ? <Check size={12} strokeWidth={2.5} /> : idx}
              </span>
              <span className="font-medium">{label}</span>
            </div>
            {idx < steps.length && <div className="w-6 h-px bg-line" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Step1({ value, onChange, onContinue }) {
  const toggleTopic = (t) => {
    const next = value.topics.includes(t) ? value.topics.filter((x) => x !== t) : [...value.topics, t];
    onChange({ ...value, topics: next });
  };
  return (
    <div className="u-card max-w-3xl" data-testid="doubt-step-1">
      <h2 className="u-h3">What are you stuck on?</h2>
      <p className="u-small mt-1">Be concrete — the more specific, the better the AI's first attempt.</p>
      <div className="mt-6 space-y-5">
        <div>
          <label className="u-small font-medium text-ink block mb-1.5">Description</label>
          <textarea
            className="u-textarea min-h-[140px]"
            placeholder="My RAG retriever's recall@5 dropped from 0.78 to 0.41 after I switched chunkers…"
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            data-testid="doubt-description"
          />
        </div>
        <div>
          <label className="u-small font-medium text-ink block mb-1.5">Code (optional)</label>
          <textarea
            className="u-textarea min-h-[160px] font-mono text-[13.5px]"
            placeholder={`# paste a snippet…\nretriever.search(query, k=5)`}
            value={value.code}
            onChange={(e) => onChange({ ...value, code: e.target.value })}
            data-testid="doubt-code"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="u-small font-medium text-ink block mb-1.5">Error log (optional)</label>
          <textarea
            className="u-textarea min-h-[100px] font-mono text-[13.5px]"
            placeholder="Paste a stack trace or error output…"
            value={value.error_log}
            onChange={(e) => onChange({ ...value, error_log: e.target.value })}
            data-testid="doubt-error"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="u-small font-medium text-ink block mb-2">Topics</label>
          <div className="flex flex-wrap gap-2" data-testid="doubt-topics">
            {TOPIC_OPTIONS.map((t) => {
              const on = value.topics.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTopic(t)}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
                    on
                      ? "bg-purple-primary text-white border-purple-primary"
                      : "bg-white text-ink border-line hover:border-purple-primary hover:text-purple-primary"
                  }`}
                  data-testid={`topic-${t.toLowerCase()}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-7 flex justify-end">
        <button
          className="u-btn-primary"
          disabled={value.description.trim().length < 5}
          onClick={onContinue}
          data-testid="doubt-step1-continue"
        >
          Continue <ArrowRight size={18} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function Step2({ doubtId, onResult, onBack }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const { data } = await api.post(`/doubts/${doubtId}/triage`);
        if (!cancelled) setResult(data);
      } catch (e) {
        if (!cancelled) setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [doubtId]);

  if (loading) {
    return (
      <div className="u-card max-w-3xl text-center" data-testid="doubt-step-2-loading">
        <div className="w-14 h-14 mx-auto rounded-full bg-purple-soft flex items-center justify-center text-purple-primary animate-soft-pulse">
          <Sparkles size={26} strokeWidth={1.75} />
        </div>
        <h2 className="u-h3 mt-5">Asking the AI…</h2>
        <p className="u-small mt-2">Claude Sonnet 4.5 is taking the first attempt. Usually 8–15 seconds.</p>
      </div>
    );
  }

  if (err || !result) {
    return (
      <div className="u-card max-w-3xl" data-testid="doubt-step-2-error">
        <h2 className="u-h3">AI triage failed</h2>
        <p className="u-small mt-2 text-bad">{err || "No result"}</p>
        <button className="u-btn-secondary mt-5" onClick={onBack}>Back</button>
      </div>
    );
  }

  // AI unavailable / errored — clean state, push the user toward a human
  if (result.error || result.confidence === 0) {
    return (
      <div className="u-card max-w-3xl" data-testid="doubt-step-2-unavailable">
        <span className="u-pill">AI is unavailable right now</span>
        <h2 className="u-h3 mt-3">Let's get you a human directly.</h2>
        <p className="u-body mt-3">
          {result.answer || "Our AI couldn't take a first attempt this time."}
        </p>
        <div className="mt-6 flex gap-3">
          <button className="u-btn-secondary" onClick={onBack} data-testid="ai-back">
            Edit my doubt
          </button>
          <button
            className="u-btn-primary"
            onClick={() => onResult({ accepted: false, partial: false, suggested_tier: result.suggested_tier })}
            data-testid="ai-skip-to-human"
          >
            Match me with a human <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  const confPct = Math.round(result.confidence * 100);
  const confColor = confPct >= 70 ? "text-good" : confPct >= 40 ? "text-warn" : "text-bad";

  return (
    <div className="space-y-5 max-w-3xl" data-testid="doubt-step-2-result">
      <div className="u-card">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="u-pill"><Sparkles size={12} strokeWidth={2} /> AI's first attempt</span>
          <span className={`u-small font-medium ${confColor}`} data-testid="ai-confidence">
            Confidence: {confPct}%
          </span>
        </div>
        <div className="mt-4 prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-7 text-ink m-0">{result.answer}</pre>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <button className="u-btn-secondary" onClick={() => onResult({ accepted: true })} data-testid="ai-resolved">
          <Check size={16} strokeWidth={2} /> Solved it — thanks
        </button>
        <button className="u-btn-secondary" onClick={() => onResult({ accepted: false, partial: true, suggested_tier: result.suggested_tier })} data-testid="ai-partial">
          Partially helpful
        </button>
        <button className="u-btn-primary" onClick={() => onResult({ accepted: false, partial: false, suggested_tier: result.suggested_tier })} data-testid="ai-need-human">
          Get me a human <ArrowRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function TutorCard({ tutor, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tutor.id)}
      className={`u-card text-left ${selected ? "border-purple-primary border-[1.5px] bg-purple-soft/30" : "u-card-hover"}`}
      data-testid={`tutor-card-${tutor.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-purple-soft text-purple-primary flex items-center justify-center font-display font-semibold text-[14px]">
          {tutor.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-ink">{tutor.name}</div>
          <div className="u-caption">{tutor.bio}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {tutor.specialties.slice(0, 3).map((s) => (
          <span key={s} className="u-pill text-[12px]">{s}</span>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 u-caption">
        <span className="inline-flex items-center gap-1 text-ink"><Star size={12} strokeWidth={2} className="text-purple-primary" /> {tutor.rating.toFixed(1)}</span>
        <span className="inline-flex items-center gap-1"><Clock size={12} strokeWidth={2} /> ~{tutor.response_time_min} min</span>
        <span>{tutor.rate_hint}</span>
      </div>
    </button>
  );
}

function Step3({ doubtId, suggestedTier, onDone }) {
  const [tier, setTier] = useState(suggestedTier && TIERS.find((t) => t.key === suggestedTier) ? suggestedTier : "deep");
  const [tutors, setTutors] = useState([]);
  const [tutorId, setTutorId] = useState(null);
  const [paying, setPaying] = useState(false);
  const [matching, setMatching] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/tutors").then(({ data }) => setTutors(data || [])).catch((e) => console.warn("tutors load failed", e));
  }, []);

  const tierObj = TIERS.find((t) => t.key === tier);

  const handlePayAndMatch = async () => {
    setErr("");
    setPaying(true);
    try {
      const origin = window.location.origin;
      const { data } = await api.post("/payments/checkout", {
        doubt_id: doubtId, tier, origin_url: origin,
      });
      // also pre-create a session record so dashboard reflects it
      try {
        await api.post(`/doubts/${doubtId}/match`, { doubt_id: doubtId, tier, tutor_id: tutorId });
      } catch (matchErr) {
        // matching is also created post-pay if needed
        console.warn("pre-match failed (will retry post-pay)", matchErr);
      }
      window.location.href = data.url;
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      setPaying(false);
    }
  };

  const handleSkipPayMatch = async () => {
    setErr("");
    setMatching(true);
    try {
      const { data } = await api.post(`/doubts/${doubtId}/match`, { doubt_id: doubtId, tier, tutor_id: tutorId });
      onDone(data);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="doubt-step-3">
      <div className="u-card">
        <span className="u-pill">Recommended</span>
        <h2 className="u-h3 mt-3">
          Based on your doubt, we recommend a <span className="text-purple-primary">{tierObj?.minutes}-min {tierObj?.label}</span> — ${tierObj?.price}
        </h2>
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="tier-selector">
          {TIERS.map((t) => {
            const sel = tier === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTier(t.key)}
                className={`text-left p-4 rounded-md border transition-colors ${
                  sel
                    ? "border-purple-primary bg-purple-soft/40"
                    : "border-line bg-white hover:border-purple-primary/50"
                }`}
                data-testid={`tier-${t.key}`}
              >
                <div className="font-display font-semibold text-ink">{t.label}</div>
                <div className="u-caption mt-1">{t.minutes} min · ${t.price}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-3">
          <h3 className="u-h4">Available tutors</h3>
          <span className="u-caption">Tap to pre-select, or auto-match</span>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {tutors.slice(0, 3).map((t) => (
            <TutorCard key={t.id} tutor={t} selected={tutorId === t.id} onSelect={setTutorId} />
          ))}
        </div>
      </div>

      {err && <div className="u-small text-bad" data-testid="match-error">{err}</div>}

      <div className="u-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="u-small">You're not charged unless your doubt is resolved.</div>
          <div className="u-caption mt-1">Test mode — Stripe will accept test card 4242 4242 4242 4242.</div>
        </div>
        <div className="flex gap-3">
          <button className="u-btn-secondary" onClick={handleSkipPayMatch} disabled={matching} data-testid="match-skip-pay">
            {matching ? <><Loader2 size={16} className="animate-spin" />Matching…</> : "Match without paying"}
          </button>
          <button className="u-btn-primary" onClick={handlePayAndMatch} disabled={paying} data-testid="match-pay">
            {paying ? <><Loader2 size={16} className="animate-spin" />Redirecting…</> : <>Pay ${tierObj?.price} & Match <ArrowRight size={16} strokeWidth={2} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewDoubt() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [doubt, setDoubt] = useState({ description: "", code: "", error_log: "", topics: [] });
  const [doubtId, setDoubtId] = useState(null);
  const [suggested, setSuggested] = useState("deep");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  // Handle Stripe cancel return
  useEffect(() => {
    if (params.get("payment") === "cancelled") {
      const did = params.get("doubt_id");
      if (did) { setDoubtId(did); setStep(3); }
    }
  }, [params]);

  const handleStep1 = async () => {
    setCreating(true);
    setCreateErr("");
    try {
      const { data } = await api.post("/doubts", {
        description: doubt.description,
        code: doubt.code,
        error_log: doubt.error_log,
        topics: doubt.topics,
      });
      setDoubtId(data.id);
      setStep(2);
    } catch (e) {
      setCreateErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl">
        <div className="mb-6">
          <Stepper step={step} />
        </div>

        {step === 1 && (
          <>
            <Step1 value={doubt} onChange={setDoubt} onContinue={handleStep1} />
            {creating && <div className="u-small mt-3">Saving your doubt…</div>}
            {createErr && <div className="u-small text-bad mt-3" data-testid="create-error">{createErr}</div>}
          </>
        )}

        {step === 2 && doubtId && (
          <Step2
            doubtId={doubtId}
            onBack={() => setStep(1)}
            onResult={({ accepted, suggested_tier }) => {
              if (accepted) navigate("/dashboard");
              else {
                if (suggested_tier) setSuggested(suggested_tier);
                setStep(3);
              }
            }}
          />
        )}

        {step === 3 && doubtId && (
          <Step3
            doubtId={doubtId}
            suggestedTier={suggested}
            onDone={(session) => navigate(`/sessions/${session.id}`)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
