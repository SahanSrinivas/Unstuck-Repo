import React from "react";
import { Quote } from "lucide-react";

const QUOTES = [
  {
    body:
      "Spent two days on a recall regression. Aria spotted it in 18 minutes — chunker was tokenizing on punctuation only. Worth every cent.",
    name: "AI engineer",
    role: "Series-B SaaS startup",
    avatar: "AC",
  },
  {
    body:
      "I'd rather pay $30 than wait 8 hours for a Stack Overflow answer that ends up wrong. The summary email after was already worth the price.",
    name: "ML engineer",
    role: "Fortune 500",
    avatar: "MK",
  },
  {
    body:
      "Got a senior agents engineer to look at my LangGraph state machine. He killed three nodes I was over-engineering. Shipped two days later.",
    name: "Founder",
    role: "Building an autonomous agents product",
    avatar: "SR",
  },
];

export default function Testimonials() {
  return (
    <section className="u-section bg-white" data-testid="testimonials">
      <div className="u-container">
        <div className="max-w-2xl">
          <span className="u-pill">In their words</span>
          <h2 className="u-h2 mt-4">From engineers who got unstuck</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {QUOTES.map((q, i) => (
            <div key={i} className="u-card u-card-hover" data-testid={`testimonial-${i}`}>
              <Quote size={22} strokeWidth={1.75} className="text-purple-primary" />
              <p className="u-body mt-4 text-ink">{q.body}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-soft text-purple-primary flex items-center justify-center font-display font-semibold text-[14px]">
                  {q.avatar}
                </div>
                <div>
                  <div className="font-display font-semibold text-ink text-[15px]">{q.name}</div>
                  <div className="u-caption">{q.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
