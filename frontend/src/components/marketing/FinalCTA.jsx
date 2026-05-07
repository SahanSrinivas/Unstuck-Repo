import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="bg-white" data-testid="final-cta">
      <div className="u-container u-section text-center">
        <h2 className="u-h2 mx-auto max-w-3xl">Stop being stuck.</h2>
        <p className="u-body-lg mt-5 mx-auto max-w-xl">
          A real AI engineer is one form away. Your first AI attempt is free —
          you only pay if a human is actually needed.
        </p>
        <div className="mt-9 flex justify-center">
          <Link to="/register" className="u-btn-primary" data-testid="final-cta-btn">
            Submit your first doubt <ArrowRight size={18} strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </section>
  );
}
