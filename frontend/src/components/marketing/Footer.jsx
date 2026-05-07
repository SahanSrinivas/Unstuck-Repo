import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-line" data-testid="footer">
      <div className="u-container py-16 grid gap-10 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="font-display font-bold text-[22px] text-ink">
            Unstuck<span className="text-purple-primary">.</span>
          </div>
          <p className="u-small mt-3 max-w-xs">
            Real AI engineers, in 5 minutes. Fixed price. No monthly commitment.
          </p>
        </div>

        <div>
          <div className="font-display font-semibold text-ink text-[14px] mb-3 uppercase tracking-wider">Product</div>
          <ul className="space-y-2">
            <li><a href="/#how" className="u-small hover:text-purple-primary">How it works</a></li>
            <li><a href="/#pricing" className="u-small hover:text-purple-primary">Pricing</a></li>
            <li><a href="/#why" className="u-small hover:text-purple-primary">Why Unstuck</a></li>
          </ul>
        </div>
        <div>
          <div className="font-display font-semibold text-ink text-[14px] mb-3 uppercase tracking-wider">Tutors</div>
          <ul className="space-y-2">
            <li><Link to="/tutor-apply" className="u-small hover:text-purple-primary">Apply to tutor</Link></li>
            <li><a href="#" className="u-small hover:text-purple-primary">Earnings</a></li>
            <li><a href="#" className="u-small hover:text-purple-primary">Quality bar</a></li>
          </ul>
        </div>
        <div>
          <div className="font-display font-semibold text-ink text-[14px] mb-3 uppercase tracking-wider">Company</div>
          <ul className="space-y-2">
            <li><a href="#" className="u-small hover:text-purple-primary">About</a></li>
            <li><a href="#" className="u-small hover:text-purple-primary">Privacy</a></li>
            <li><a href="#" className="u-small hover:text-purple-primary">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="u-container py-5 flex flex-col md:flex-row items-center justify-between gap-2">
          <span className="u-caption">© {new Date().getFullYear()} Unstuck Labs.</span>
          <span className="u-caption">Built for AI engineering. Only.</span>
        </div>
      </div>
    </footer>
  );
}
