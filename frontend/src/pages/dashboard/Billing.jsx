import React, { useEffect, useState } from "react";
import { CreditCard, RotateCcw, CheckCircle2 } from "lucide-react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../lib/api";

const STATUS_LABEL = {
  paid: { label: "Paid", color: "text-good", bg: "bg-good/10" },
  pending: { label: "Pending", color: "text-warn", bg: "bg-warn/10" },
  unpaid: { label: "Unpaid", color: "text-ink-muted", bg: "bg-canvas-alt" },
  expired: { label: "Expired", color: "text-bad", bg: "bg-bad/10" },
};

export default function Billing() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get("/billing/transactions").then(({ data }) => {
      if (!cancelled) setItems(data || []);
    }).catch((e) => console.warn("billing load failed", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalPaid = items.filter((i) => i.payment_status === "paid" && !i.refunded).reduce((a, b) => a + b.amount, 0);
  const refunded = items.filter((i) => i.refunded).reduce((a, b) => a + b.amount, 0);

  return (
    <DashboardLayout>
      <div className="max-w-5xl" data-testid="page-billing">
        <h1 className="u-h2">Billing</h1>
        <p className="u-body mt-2">Every charge and refund. No hidden fees, no subscriptions.</p>

        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <div className="u-card" data-testid="billing-paid">
            <div className="flex items-center gap-2 u-small text-ink-muted"><CheckCircle2 size={14} strokeWidth={1.75} className="text-good" /> Total paid</div>
            <div className="font-display font-bold text-[36px] text-ink mt-2 leading-none">${totalPaid.toFixed(0)}</div>
          </div>
          <div className="u-card" data-testid="billing-refunded">
            <div className="flex items-center gap-2 u-small text-ink-muted"><RotateCcw size={14} strokeWidth={1.75} className="text-warn" /> Refunded</div>
            <div className="font-display font-bold text-[36px] text-ink mt-2 leading-none">${refunded.toFixed(0)}</div>
          </div>
          <div className="u-card" data-testid="billing-count">
            <div className="flex items-center gap-2 u-small text-ink-muted"><CreditCard size={14} strokeWidth={1.75} className="text-purple-primary" /> Transactions</div>
            <div className="font-display font-bold text-[36px] text-ink mt-2 leading-none">{items.length}</div>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="u-h4 mb-4">Transactions</h3>
          {loading ? (
            <div className="u-card text-center u-small">Loading…</div>
          ) : items.length === 0 ? (
            <div className="u-card text-center u-small" data-testid="billing-empty">
              No transactions yet — your first paid doubt will show up here.
            </div>
          ) : (
            <div className="u-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[640px]" data-testid="billing-table">
                  <thead>
                    <tr className="bg-canvas-alt">
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Date</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Tier</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Amount</th>
                      <th className="px-5 py-4 u-small font-semibold text-ink uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const sl = STATUS_LABEL[it.payment_status] || { label: it.payment_status, color: "text-ink-muted", bg: "bg-canvas-alt" };
                      return (
                        <tr key={it.id} className="border-t border-line" data-testid={`billing-row-${it.id}`}>
                          <td className="px-5 py-4 u-small">{new Date(it.created_at).toLocaleString()}</td>
                          <td className="px-5 py-4 u-body font-medium text-ink capitalize">{it.tier || "—"}</td>
                          <td className="px-5 py-4 u-body">
                            ${it.amount.toFixed(2)} <span className="u-caption uppercase ml-1">{it.currency}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium ${sl.bg} ${sl.color}`}>
                              {sl.label}
                            </span>
                            {it.refunded && (
                              <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12.5px] font-medium bg-warn/10 text-warn">
                                <RotateCcw size={12} strokeWidth={2} /> Refunded
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
