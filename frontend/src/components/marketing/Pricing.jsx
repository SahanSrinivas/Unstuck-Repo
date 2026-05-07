import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

export const TIERS = [
  {
    key: "quick",
    label: "Quick Doubt",
    minutes: 15,
    price: 15,
    items: [
      "1 focused question",
      "Live chat + code review",
      "Resolved or refund",
    ],
  },
  {
    key: "deep",
    label: "Deep Dive",
    minutes: 30,
    price: 30,
    popular: true,
    items: [
      "Debug a specific failure",
      "Live chat + video + code",
      "Written summary after",
      "Resolved or refund",
    ],
  },
  {
    key: "working",
    label: "Working Session",
    minutes: 45,
    price: 45,
    items: [
      "Pair-program through it",
      "Shared editor + video",
      "Written summary after",
      "Resolved or refund",
    ],
  },
  {
    key: "project",
    label: "Project Help",
    minutes: 60,
    price: 60,
    items: [
      "Architecture review",
      "Eval / harness sketch",
      "Written summary + plan",
      "Resolved or refund",
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-white" data-testid="pricing">
      <div className="u-container u-section">
        <div className="max-w-2xl">
          <span className="u-pill">Pricing</span>
          <h2 className="u-h2 mt-4">One doubt. One fixed price.</h2>
          <p className="u-body-lg mt-4">
            No subscriptions. No "credits" that expire. Pick the tier that
            matches the depth of help you need.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TIERS.map((t) => (
            <div
              key={t.key}
              className={`u-card u-card-hover relative flex flex-col ${
                t.popular ? "border-purple-primary border-[1.5px] bg-canvas-alt" : ""
              }`}
              data-testid={`pricing-${t.key}`}
            >
              {t.popular && (
                <span className="absolute -top-3 left-6 u-pill !bg-purple-primary !text-white">
                  Most popular
                </span>
              )}
              <div className="font-display font-semibold text-[15px] text-purple-primary uppercase tracking-wider">
                {t.label}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display font-bold text-[44px] text-ink leading-none">
                  ${t.price}
                </span>
                <span className="u-small">/ {t.minutes} min</span>
              </div>
              <ul className="mt-5 space-y-2.5 flex-1">
                {t.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 u-small">
                    <Check size={16} strokeWidth={2} className="text-purple-primary mt-0.5 flex-shrink-0" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={t.popular ? "u-btn-primary mt-6 w-full" : "u-btn-secondary mt-6 w-full"}
                data-testid={`pricing-cta-${t.key}`}
              >
                Choose {t.label}
              </Link>
            </div>
          ))}
        </div>

        <p className="u-caption mt-8">
          You're not charged until your doubt is resolved. Auto-refund if it isn't.
        </p>
      </div>
    </section>
  );
}
