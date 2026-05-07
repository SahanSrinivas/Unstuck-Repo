import React from "react";
import { Check, Minus } from "lucide-react";

const SCREENING = [
  {
    asked: "Walk me through a production incident you debugged",
    skipped: "Have you taken any AI courses",
  },
  {
    asked: "Show me an eval you've actually run",
    skipped: "What's your favorite framework",
  },
  {
    asked: "What's the worst regression you shipped, and how did you catch it",
    skipped: "How many years of experience",
  },
];

export default function Screening() {
  return (
    <section className="bg-white" data-testid="screening">
      <div className="u-container u-section">
        <div className="max-w-2xl">
          <span className="u-pill">Supply quality</span>
          <h2 className="u-h2 mt-4">Built for the engineers production trusts</h2>
          <p className="u-body-lg mt-4">
            Every Unstuck tutor has shipped an AI system that real customers
            depend on. We screen on production experience, not certifications.
          </p>
        </div>

        <div className="mt-12 u-card overflow-hidden p-0" data-testid="screening-table">
          <div className="overflow-x-auto md:overflow-visible">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-canvas-alt">
                  <th className="p-5 u-small font-semibold uppercase tracking-wider text-purple-primary">
                    What we ask in screening
                  </th>
                  <th className="p-5 u-small font-semibold uppercase tracking-wider text-ink-muted">
                    What we don't
                  </th>
                </tr>
              </thead>
              <tbody>
                {SCREENING.map((row) => (
                  <tr key={row.asked} className="border-t border-line">
                    <td className="p-5 u-body text-ink">
                      <span className="inline-flex items-start gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-soft text-purple-primary mt-0.5 flex-shrink-0">
                          <Check size={14} strokeWidth={2} />
                        </span>
                        <span>{row.asked}</span>
                      </span>
                    </td>
                    <td className="p-5 u-body text-ink-muted">
                      <span className="inline-flex items-start gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 text-ink-soft mt-0.5 flex-shrink-0">
                          <Minus size={14} strokeWidth={1.75} />
                        </span>
                        <span>{row.skipped}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 max-w-2xl space-y-4">
          <p className="u-body-lg" data-testid="screening-pass-rate">
            ~70% of applicants don't pass. The ones who do have shipped at YC AI
            startups, Fortune 500 ML teams, and infrastructure companies you've
            heard of.
          </p>
          <p className="u-caption" data-testid="screening-nda">
            NDA-friendly. Sessions can be conducted under NDA on request —
            common for compliance-sensitive issues.
          </p>
        </div>
      </div>
    </section>
  );
}
