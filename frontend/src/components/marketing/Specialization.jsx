import React from "react";

const ROWS = [
  {
    title: "Retrieval regressions in production",
    body:
      "Recall dropped after a chunker change. Reranker thrashing on a query class nobody tested. Vector DB recall is fine but latency spiked 4x. Get someone who's debugged retrieval at production scale to look at your eval and traces.",
    example:
      "Recall@5 on multi-hop queries went from 0.78 → 0.41 after we moved to semantic chunking. Aria spotted that we'd lost punctuation-aware splitting, fixed it in 18 minutes.",
    code: `# eval recall@5 across chunkers
for chunker in [token_512, sentence, semantic]:
    recall = run_eval(chunker, queries, gold)
    print(chunker.__name__, recall)
# token_512   0.41
# sentence    0.62
# semantic    0.78  <— actually try this`,
  },
  {
    title: "Agents misbehaving in prod",
    body:
      "Tool-call schema drift. Loops on edge cases your eval didn't catch. Latency creeping past SLA on multi-step plans. Hallucinated tool args breaking downstream services. Get a fix, not a framework debate.",
    example:
      "Our LangGraph agent was retrying a deprecated tool name 3% of the time. Killed two nodes, fixed the schema, latency dropped 40%.",
    code: `# tool spec mismatch — most common agent bug
def get_user(user_id: int) -> User: ...
# but the LLM keeps calling:
{"name": "get_user", "args": {"id": 42}}
# fix: rename param OR add description
# OR strict tool schemas (function calling)`,
  },
  {
    title: "Fine-tuning regressions",
    body:
      "Eval improved but real-world quality dropped. Distilled model failing safety checks the base model passed. LoRA merge changed the policy in ways your test set didn't catch. Get someone who's shipped 30+ models to debug it with you.",
    example:
      "Post-DPO model started refusing safe queries. Reward hacking on the preference data — caught in one session.",
    code: `# LoRA defaults that actually work for 7-13B
lora_rank      = 16
lora_alpha     = 32           # 2x rank
target_modules = ["q_proj", "v_proj"]
learning_rate  = 2e-4         # higher than full FT
# SFT on instruction data → DPO on prefs → ship`,
  },
  {
    title: "Inference cost & latency in production",
    body:
      "p95 latency wrecking your SLO. Cold starts on serverless killing UX. KV-cache hits suddenly tanking after a deploy. vLLM batch sizing eating your margin. Talk to someone who's tuned production inference at scale.",
    example:
      "Cost per request 3x'd overnight after a model swap. Continuous batching wasn't engaging — fixed the request shape, costs dropped back.",
    code: `# inference cost cliff at batch_size=1
# vLLM continuous batching → 4-8x throughput
vllm serve mistral-7b-instruct \\
  --max-num-seqs 256 \\
  --gpu-memory-utilization 0.92 \\
  --enable-prefix-caching`,
  },
];

function CodeBlock({ code }) {
  return (
    <pre className="u-code-block" data-testid="spec-code">
      <code>{code}</code>
    </pre>
  );
}

export default function Specialization() {
  return (
    <section className="bg-canvas-alt" data-testid="specialization">
      <div className="u-container u-section">
        <div className="max-w-2xl">
          <span className="u-pill">Vertical, by design</span>
          <h2 className="u-h2 mt-4">Built for AI engineering. Only.</h2>
          <p className="u-body-lg mt-4">
            Generalist platforms have generalist tutors. We don't. Every Unstuck
            tutor has shipped production AI systems in one of these four areas.
          </p>
        </div>

        <div className="mt-16 space-y-20">
          {ROWS.map((r, i) => {
            const codeFirst = i % 2 === 1;
            return (
              <div
                key={r.title}
                className="grid md:grid-cols-2 gap-10 md:gap-14 items-center"
                data-testid={`spec-row-${i}`}
              >
                <div className={codeFirst ? "md:order-2" : ""}>
                  <h3 className="u-h3">{r.title}</h3>
                  <p className="u-body-lg mt-4">{r.body}</p>
                  <p
                    className="u-small italic mt-4 text-ink-muted border-l-2 border-purple-primary/40 pl-4"
                    data-testid={`spec-example-${i}`}
                  >
                    "{r.example}"
                  </p>
                </div>
                <div className={codeFirst ? "md:order-1" : ""}>
                  <CodeBlock code={r.code} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
