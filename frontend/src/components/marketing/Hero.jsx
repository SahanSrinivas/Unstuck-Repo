import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Database, Zap, ShieldCheck } from "lucide-react";

export default function Hero() {
  return (
    <section className="u-hero-wash" data-testid="hero">
      <div className="u-container pt-20 pb-24 md:pt-28 md:pb-32 grid lg:grid-cols-2 gap-14 items-center">
        <div className="u-stagger">
          <span className="u-pill" data-testid="hero-eyebrow">AI engineering help, on demand</span>
          <h1 className="u-h1 mt-6" data-testid="hero-title">
            Real AI engineers.<br />In 5 minutes.
          </h1>
          <p className="u-body-lg mt-6 max-w-[560px]" data-testid="hero-sub">
            Stuck on RAG, agents, or fine-tuning? Skip the Stack Overflow wait
            and the ChatGPT hallucinations. Get a verified AI engineer on a
            15-minute call. Fixed price. No monthly commitment.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3" data-testid="hero-ctas">
            <Link to="/register" className="u-btn-primary" data-testid="hero-cta-primary">
              Submit your first doubt <ArrowRight size={18} strokeWidth={1.75} />
            </Link>
            <Link to="/tutor-apply" className="u-btn-secondary" data-testid="hero-cta-secondary">
              I'm an AI engineer — apply to tutor
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 u-caption">
            <span className="inline-flex items-center gap-1.5"><Check size={14} strokeWidth={2} className="text-purple-primary" />First AI attempt is free</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} strokeWidth={2} className="text-purple-primary" />Auto-refund if unresolved</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} strokeWidth={2} className="text-purple-primary" />Verified practitioners only</span>
          </div>
        </div>

        {/* Stacked card stack illustration */}
        <div className="relative h-[420px] hidden lg:block" data-testid="hero-card-stack" aria-hidden>
          <div className="absolute right-12 top-2 w-[360px] u-card shadow-sm rotate-[-3deg]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-bad" />
              <span className="w-2 h-2 rounded-full bg-warn" />
              <span className="w-2 h-2 rounded-full bg-good" />
              <span className="ml-3 u-caption">Doubt #182 — RAG recall@5 dropped</span>
            </div>
            <div className="font-mono text-[12.5px] leading-7 text-ink-muted">
              <div><span className="text-purple-primary">retriever</span>.search(query, k=5)</div>
              <div className="text-ink-soft"># recall: 0.41 ↓ from 0.78</div>
            </div>
          </div>

          <div className="absolute right-2 top-28 w-[380px] u-card shadow-md rotate-[2deg]">
            <span className="u-pill"><Zap size={12} strokeWidth={2} /> Matched in 4 min</span>
            <h4 className="u-h4 mt-3">Aria Chen</h4>
            <p className="u-small mt-1">Built retrieval at a YC AI infra startup</p>
            <div className="flex gap-2 mt-3">
              <span className="u-pill text-[12px]">RAG</span>
              <span className="u-pill text-[12px]">Evals</span>
              <span className="u-pill text-[12px]">Vector DBs</span>
            </div>
          </div>

          <div className="absolute right-20 top-60 w-[360px] u-card shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-soft flex items-center justify-center text-purple-primary">
                <ShieldCheck size={18} strokeWidth={1.75} />
              </div>
              <div>
                <div className="font-display font-semibold text-ink">Resolved · 28 min</div>
                <p className="u-small mt-1">Reranker swap + chunk overlap fix lifted recall to 0.83.</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="u-caption">Deep Dive</span>
                  <span className="text-ink-soft">·</span>
                  <span className="u-caption">$30</span>
                  <span className="text-ink-soft">·</span>
                  <span className="u-caption text-good font-medium">Auto-released</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
