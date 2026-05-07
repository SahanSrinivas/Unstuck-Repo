import React from "react";
import { Send, Users, CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    icon: Send,
    title: "Submit",
    body:
      "Paste your stuck point: a question, a stack trace, a snippet. Pick the topic. Our AI takes the first attempt — free.",
  },
  {
    icon: Users,
    title: "Match",
    body:
      "If the AI doesn't fully resolve it, we route you to a verified AI engineer in under 5 minutes. You see their bio first.",
  },
  {
    icon: CheckCircle2,
    title: "Resolve",
    body:
      "Fixed price for the tier you pick. Quality-audited summary. Auto-refund if your doubt isn't actually resolved.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="u-section bg-white" data-testid="how-it-works">
      <div className="u-container">
        <div className="max-w-2xl">
          <span className="u-pill" data-testid="how-eyebrow">How it works</span>
          <h2 className="u-h2 mt-4" data-testid="how-title">How Unstuck works</h2>
          <p className="u-body-lg mt-4">
            Three steps. No subscriptions. No bidding. No hour-long discovery
            calls before someone touches your code.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="u-card u-card-hover" data-testid={`how-step-${i + 1}`}>
                <div className="w-11 h-11 rounded-md bg-purple-soft flex items-center justify-center text-purple-primary">
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <div className="u-caption mt-5">Step {i + 1}</div>
                <h3 className="u-h3 mt-1">{s.title}</h3>
                <p className="u-body mt-3">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
