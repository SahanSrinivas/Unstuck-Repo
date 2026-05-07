import React from "react";

const ROWS = [
  {
    title: "RAG & retrieval",
    body:
      "Recall in the gutter? Reranking thrashing? Chunk strategy is voodoo? Get someone who's shipped retrieval at scale to look at your eval set with you.",
    code: `# eval recall@5 across chunkers
for chunker in [token_512, sentence, semantic]:
    recall = run_eval(chunker, queries, gold)
    print(chunker.__name__, recall)
# token_512   0.41
# sentence    0.62
# semantic    0.78  <— actually try this`,
  },
  {
    title: "Agents & tool use",
    body:
      "Agents looping. Tools returning the wrong arg shape. Planner over-thinking simple tasks. Skip the framework debates — get a fix.",
    code: `# tool spec mismatch — most common agent bug
def get_user(user_id: int) -> User: ...
# but the LLM keeps calling:
{"name": "get_user", "args": {"id": 42}}
# fix: rename param OR add description
# OR strict tool schemas (function calling)`,
  },
  {
    title: "Fine-tuning & training",
    body:
      "Loss curve looks fine but eval is worse. LoRA rank too high? Distillation underperforming? Talk to someone who's trained 30+ models.",
    code: `# LoRA defaults that actually work for 7-13B
lora_rank      = 16
lora_alpha     = 32           # 2x rank
target_modules = ["q_proj", "v_proj"]
learning_rate  = 2e-4         # higher than full FT
# SFT on instruction data → DPO on prefs → ship`,
  },
  {
    title: "MLOps & deployment",
    body:
      "vLLM vs TGI. Batch sizes. KV-cache. Spot instances. Cold starts that wreck your p95. Get unstuck on the boring-but-expensive stuff.",
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
