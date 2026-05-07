import React from "react";

export default function CoinFlip() {
  return (
    <section className="bg-canvas-alt" data-testid="coin-flip">
      <div className="u-container u-section">
        <div className="max-w-[720px] mx-auto">
          <h2 className="u-h2 text-center" data-testid="coin-flip-title">
            Every change to a production AI system is a coin flip.
          </h2>

          <div className="mt-10 space-y-6">
            <p className="u-body-lg" data-testid="coin-flip-p1">
              You ship a new chunker. Recall ticks up in offline eval. Three
              days later, a customer complaint trickles in — answers are
              subtly worse on a query class your eval missed. Or you swap
              models and tool-calling format drift breaks 4% of agent runs.
              Or fine-tuning on a new dataset shifts the policy and your
              safety filter starts letting things through.
            </p>

            <p
              className="font-display font-semibold text-[22px] md:text-[26px] leading-snug text-ink"
              data-testid="coin-flip-p2"
            >
              You only find out when customers complain. Or compliance does.
            </p>

            <p className="u-body-lg" data-testid="coin-flip-p3">
              Stack Overflow doesn't help — there's no question to ask yet.
              ChatGPT can't help — the failure is in your eval set, your
              data, your specific stack. Internal teammates are heads-down
              on their own sprint. The senior engineer who'd spot it in 10
              minutes doesn't work at your company.
            </p>

            <p className="u-body-lg" data-testid="coin-flip-p4">
              That's the gap Unstuck fills. Not learning RAG from scratch.
              Not 8-week mentorships. A real practitioner, on a 15-minute
              call, looking at your actual telemetry and saying "yeah —
              your reranker is collapsing on multi-hop queries, here's the
              fix."
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
