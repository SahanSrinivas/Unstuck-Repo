import React from "react";
import { Check, Minus } from "lucide-react";

const COLS = ["Stack Overflow", "ChatGPT", "Codementor", "Unstuck"];
const ROWS = [
  ["AI vertical specialists", false, false, false, true],
  ["Fixed price (no bidding)", false, true, false, true],
  ["5-minute matching", false, true, false, true],
  ["AI takes the first attempt (free)", false, false, false, true],
  ["Quality audit on every session", false, false, false, true],
  ["Mobile-first", false, true, false, true],
  ["Built only for AI engineers", false, false, false, true],
];

function Cell({ on }) {
  return on ? (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-soft text-purple-primary">
      <Check size={16} strokeWidth={2} />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-7 h-7 text-ink-soft">
      <Minus size={16} strokeWidth={1.75} />
    </span>
  );
}

export default function WhyDifferent() {
  return (
    <section id="why" className="bg-canvas-alt" data-testid="why-different">
      <div className="u-container u-section">
        <div className="max-w-2xl">
          <span className="u-pill">Honest comparison</span>
          <h2 className="u-h2 mt-4">Why not Stack Overflow, ChatGPT, or Codementor?</h2>
          <p className="u-body-lg mt-4">
            Engineers respect honesty. Here's where each option helps — and where
            it stops.
          </p>
        </div>

        <div className="mt-12 u-card overflow-hidden p-0" data-testid="why-table">
          <div className="overflow-x-auto md:overflow-visible">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-canvas-alt">
                  <th className="p-5 u-small font-semibold text-ink uppercase tracking-wider">Feature</th>
                  {COLS.map((c) => (
                    <th key={c} className={`p-5 u-small font-semibold uppercase tracking-wider ${c === "Unstuck" ? "text-purple-primary" : "text-ink"}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="p-5 u-body font-medium text-ink">{r[0]}</td>
                    <td className="p-5"><Cell on={r[1]} /></td>
                    <td className="p-5"><Cell on={r[2]} /></td>
                    <td className="p-5"><Cell on={r[3]} /></td>
                    <td className="p-5 bg-purple-soft/40"><Cell on={r[4]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
