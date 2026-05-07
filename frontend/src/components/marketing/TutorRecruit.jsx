import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const POINTS = [
  "Set your own hours",
  "No bidding wars",
  "Get paid the same day",
  "Help the AI builder community",
];

export default function TutorRecruit() {
  return (
    <section className="bg-canvas-alt" data-testid="tutor-recruit">
      <div className="u-container u-section">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="u-pill">For tutors</span>
            <h2 className="u-h2 mt-4">
              Are you an AI engineer? Earn $40–60/hour helping others get unstuck.
            </h2>
            <p className="u-body-lg mt-5 max-w-[540px]">
              We bring you doubts that match your specialty. You decide when to
              pick them up. The work is short, technical, and pays out the same
              day.
            </p>
            <ul className="mt-7 grid sm:grid-cols-2 gap-3">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2 u-body">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-primary mt-3 flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link to="/tutor-apply" className="u-btn-primary" data-testid="tutor-apply-cta">
                Apply to be a tutor <ArrowRight size={18} strokeWidth={1.75} />
              </Link>
            </div>
          </div>

          <div className="u-card bg-white">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="font-display font-bold text-[36px] text-purple-primary leading-none">$48</div>
                <div className="u-caption mt-1">Avg. hourly take-home</div>
              </div>
              <div>
                <div className="font-display font-bold text-[36px] text-purple-primary leading-none">22 min</div>
                <div className="u-caption mt-1">Avg. session length</div>
              </div>
              <div>
                <div className="font-display font-bold text-[36px] text-purple-primary leading-none">4.9</div>
                <div className="u-caption mt-1">Avg. tutor rating</div>
              </div>
              <div>
                <div className="font-display font-bold text-[36px] text-purple-primary leading-none">Same-day</div>
                <div className="u-caption mt-1">Payouts</div>
              </div>
            </div>
            <div className="h-px bg-line my-7" />
            <div className="u-small">
              All tutors verified via technical screening + reference checks.
              We turn down ~70% of applications — that's the bar.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
