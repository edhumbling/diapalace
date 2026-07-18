"use client";

import React, { useState, useMemo } from "react";
import { GlassTile, Icon, type IconName, type TileTone } from "./glass/icons";
import { Transaction } from "../lib/db";
import { useDebounce } from "../hooks/useDebounce";
import ConfirmDialog from "./ConfirmDialog";

interface AnalyticsModuleProps {
  transactions: Transaction[];
  onVoidTransaction: (transactionId: string) => void;
  onRefundTransaction: (transactionId: string) => void;
  onViewReceipt: (tx: Transaction) => void;
}

const PAGE_SIZE = 15;

export default function AnalyticsModule({
  transactions,
  onVoidTransaction,
  onRefundTransaction,
  onViewReceipt
}: AnalyticsModuleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPayment, setFilterPayment] = useState("All");
  const [page, setPage] = useState(0);
  const [confirmVoid, setConfirmVoid] = useState<string | null>(null);
  const [confirmRefund, setConfirmRefund] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 250);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (tx.customer && tx.customer.name.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
        (tx.customer && tx.customer.phone.includes(debouncedSearch));
      const matchesPayment = filterPayment === "All" || tx.paymentMethod === filterPayment;
      return matchesSearch && matchesPayment;
    });
  }, [transactions, debouncedSearch, filterPayment]);

  const pageCount = Math.ceil(filteredTransactions.length / PAGE_SIZE);
  const paged = filteredTransactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const now = Date.now(); // eslint-disable-line react-hooks/purity
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;
  const oneMonthMs = 30 * oneDayMs;

  const nonVoidedSales = transactions.filter((tx) => !tx.isVoided && tx.total >= 0);

  const revenueData = (() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * oneDayMs);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + oneDayMs;
      const total = nonVoidedSales
        .filter((tx) => {
          const ts = new Date(tx.timestamp).getTime();
          return ts >= dayStart && ts < dayEnd;
        })
        .reduce((acc, tx) => acc + tx.total, 0);
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        value: total,
      });
    }
    return days;
  })();

  const maxRevenue = Math.max(...revenueData.map((d) => d.value), 1);

  const calcFn = (ms: number) =>
    nonVoidedSales
      .filter((tx) => now - new Date(tx.timestamp).getTime() <= ms)
      .reduce((acc, tx) => acc + tx.total, 0);

  const dailyRevenue = calcFn(oneDayMs);
  const weeklyRevenue = calcFn(oneWeekMs);
  const monthlyRevenue = calcFn(oneMonthMs);

  const cashTotal = nonVoidedSales
    .filter((tx) => tx.paymentMethod === "Cash")
    .reduce((acc, tx) => acc + tx.total, 0);
  const momoTotal = nonVoidedSales
    .filter((tx) => tx.paymentMethod === "Mobile Money")
    .reduce((acc, tx) => acc + tx.total, 0);
  const grandTotal = cashTotal + momoTotal;
  const cashPct = grandTotal > 0 ? (cashTotal / grandTotal) * 100 : 0;
  const momoPct = grandTotal > 0 ? (momoTotal / grandTotal) * 100 : 0;

  const topProducts = (() => {
    const map = new Map<string, { qty: number; rev: number }>();
    nonVoidedSales.forEach((tx) =>
      tx.items.forEach((item) => {
        const existing = map.get(item.name) || { qty: 0, rev: 0 };
        map.set(item.name, {
          qty: existing.qty + item.quantity,
          rev: existing.rev + item.quantity * item.price,
        });
      })
    );
    return Array.from(map.entries())
      .sort((a, b) => b[1].rev - a[1].rev)
      .slice(0, 5);
  })();

  const maxTopRev = topProducts.length > 0 ? topProducts[0][1].rev : 1;

  const kpis: { label: string; value: number; icon: IconName; tone: TileTone; text: string }[] = [
    { label: "Today · 24h", value: dailyRevenue, icon: "trending", tone: "cyan", text: "text-ice" },
    { label: "This week · 7d", value: weeklyRevenue, icon: "trending", tone: "violet", text: "text-lilac" },
    { label: "This month · 30d", value: monthlyRevenue, icon: "wallet", tone: "emerald", text: "text-mint" },
  ];

  return (
    <div className="relative flex flex-1 flex-col gap-4">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {kpis.map((card, i) => (
          <div
            key={card.label}
            className="g-panel sheen rise flex items-center justify-between rounded-[26px] p-5"
            style={{ "--d": `${i * 70}ms` } as React.CSSProperties}
          >
            <div className="flex flex-col gap-1">
              <span className="lbl">{card.label}</span>
              <span className={`num text-[22px] font-bold ${card.text}`}>GH₵ {card.value.toFixed(2)}</span>
              <span className="text-[10px] font-semibold text-faint">Sales performance</span>
            </div>
            <GlassTile name={card.icon} tone={card.tone} size={46} />
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div className="g-panel rise rounded-[26px] p-5" style={{ "--d": "120ms" } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <span className="lbl">Revenue trend · 7 days</span>
          <span className="num text-[10px] text-faint">
            peak GH₵ {maxRevenue.toFixed(0)}
          </span>
        </div>
        <div className="mt-4 flex h-32 items-end gap-2.5">
          {revenueData.map((d) => {
            const pct = maxRevenue > 0 ? (d.value / maxRevenue) * 100 : 0;
            return (
              <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="num text-[8px] font-bold text-faint opacity-0 transition-opacity group-hover:opacity-100">
                  GH₵{d.value.toFixed(0)}
                </span>
                <div
                  className="w-full rounded-t-lg rounded-b-md transition-all duration-500 group-hover:brightness-125"
                  style={{
                    height: `${Math.max(pct, 5)}%`,
                    background: "linear-gradient(180deg, var(--acc-1), var(--acc-2))",
                    boxShadow: "0 0 20px -4px rgba(139, 92, 246, 0.5), inset 0 1px 0 rgba(255,255,255,0.35)",
                  }}
                />
                <span className="text-[8px] font-bold uppercase tracking-wider text-faint">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment mix + top products */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="g-panel rise flex flex-col gap-4 rounded-[26px] p-5" style={{ "--d": "180ms" } as React.CSSProperties}>
          <span className="lbl">Payment breakdown</span>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-semibold text-dim">
                  <Icon name="banknote" size={13} className="text-mint" /> Cash
                </span>
                <span className="num font-bold text-ink">GH₵ {cashTotal.toFixed(2)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${cashPct}%`, background: "linear-gradient(90deg, #34d399, #6ee7b7)", boxShadow: "0 0 12px rgba(52,211,153,0.5)" }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-semibold text-dim">
                  <Icon name="smartphone" size={13} className="text-sky" /> Mobile Money
                </span>
                <span className="num font-bold text-ink">GH₵ {momoTotal.toFixed(2)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${momoPct}%`, background: "linear-gradient(90deg, #60a5fa, #93c5fd)", boxShadow: "0 0 12px rgba(96,165,250,0.5)" }}
                />
              </div>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-around gap-4 border-t border-white/[0.07] pt-4 text-center">
            <div className="flex flex-col gap-0.5">
              <span className="lbl !text-[8px]">Cash drawer</span>
              <span className="num text-sm font-bold text-ink">GH₵ {cashTotal.toFixed(0)}</span>
            </div>
            <span className="h-8 w-px bg-white/[0.08]" />
            <div className="flex flex-col gap-0.5">
              <span className="lbl !text-[8px]">MoMo float</span>
              <span className="num text-sm font-bold text-ink">GH₵ {momoTotal.toFixed(0)}</span>
            </div>
            <span className="h-8 w-px bg-white/[0.08]" />
            <div className="flex flex-col gap-0.5">
              <span className="lbl !text-[8px]">Void rate</span>
              <span className="num text-sm font-bold text-dim">
                {transactions.length > 0
                  ? `${Math.round((transactions.filter((t) => t.isVoided).length / transactions.length) * 100)}%`
                  : "0%"}
              </span>
            </div>
          </div>
        </div>

        <div className="g-panel rise flex flex-col gap-3 rounded-[26px] p-5" style={{ "--d": "240ms" } as React.CSSProperties}>
          <span className="lbl">Top products</span>
          {topProducts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {topProducts.map(([name, data], i) => {
                const pct = (data.rev / maxTopRev) * 100;
                return (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate pr-2 font-semibold text-ink">
                        <span className="num mr-1.5 text-[9px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                        {name}
                      </span>
                      <span className="num shrink-0 font-bold text-ice">GH₵ {data.rev.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, var(--acc-2), var(--acc-1))",
                          boxShadow: "0 0 10px rgba(125, 211, 252, 0.4)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-faint">No sales data yet</p>
          )}
        </div>
      </div>

      {/* Transaction history */}
      <div className="flex flex-col gap-3">
        <div className="g-panel flex flex-col items-stretch justify-between gap-3 rounded-3xl p-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              placeholder="Search receipt ID or customer…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              className="w-full rounded-2xl py-2.5 pl-10 pr-4 text-[13px] font-semibold"
            />
          </div>
          <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto">
            {["All", "Cash", "Mobile Money"].map((opt) => (
              <button
                key={opt}
                onClick={() => { setFilterPayment(opt); setPage(0); }}
                className={`shrink-0 rounded-xl border px-3.5 py-2 text-[11px] font-extrabold transition-all ${
                  filterPayment === opt
                    ? "border-ice/40 bg-ice/10 text-ice shadow-[0_0_18px_-4px_rgba(103,232,249,0.5)]"
                    : "border-white/[0.07] bg-white/[0.03] text-dim hover:border-white/[0.14] hover:text-ink"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="g-panel overflow-x-auto rounded-3xl">
          <table className="gtab min-w-[780px]">
            <thead>
              <tr>
                <th className="!pl-5">Receipt</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="!pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length > 0 ? (
                paged.map((tx) => (
                  <tr key={tx.id} className={tx.isVoided ? "opacity-50" : ""}>
                    <td className="num !pl-5 font-bold text-ink">{tx.id}</td>
                    <td className="num text-[11px]">{new Date(tx.timestamp).toLocaleString()}</td>
                    <td className="font-semibold text-ink">
                      {tx.customer ? tx.customer.name : <span className="font-normal text-faint">Walk-in</span>}
                    </td>
                    <td className="font-semibold">
                      {tx.paymentMethod}{tx.momoNetwork ? ` (${tx.momoNetwork})` : ""}
                    </td>
                    <td className={`num font-bold ${tx.total < 0 ? "text-honey" : "text-ice"}`}>
                      {tx.total < 0 ? "−" : ""}GH₵ {Math.abs(tx.total).toFixed(2)}
                    </td>
                    <td>
                      <span className={`pill ${tx.isVoided ? "pill-coral" : tx.total < 0 ? "pill-honey" : "pill-mint"}`}>
                        {tx.isVoided ? "Voided" : tx.total < 0 ? "Refund" : "Completed"}
                      </span>
                    </td>
                    <td className="!pr-5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => onViewReceipt(tx)} className="btn-ico h-8 w-8" title="View receipt">
                          <Icon name="file" size={13} />
                        </button>
                        {!tx.isVoided && tx.total >= 0 && (
                          <>
                            <button onClick={() => setConfirmRefund(tx.id)} className="btn-ico h-8 w-8 hover:!border-honey/40 hover:!bg-honey/10 hover:!text-honey" title="Refund">
                              <Icon name="undo" size={13} />
                            </button>
                            <button onClick={() => setConfirmVoid(tx.id)} className="btn-ico h-8 w-8 hover:!border-coral/40 hover:!bg-coral/10 hover:!text-coral" title="Void">
                              <Icon name="ban" size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="!py-16 text-center text-faint">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-1.5 text-xs">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-ghost flex items-center gap-1 rounded-xl px-3 py-1.5">
              <Icon name="chevronLeft" size={12} /> Prev
            </button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`num h-8 w-8 rounded-xl text-xs font-bold transition-all ${
                  page === i ? "border border-ice/40 bg-ice/10 text-ice" : "text-faint hover:bg-white/[0.05] hover:text-ink"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1} className="btn-ghost flex items-center gap-1 rounded-xl px-3 py-1.5">
              Next <Icon name="chevronRight" size={12} />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmVoid !== null}
        title="Void Transaction"
        message="This will reverse the transaction and return all items to inventory. This action cannot be undone."
        confirmLabel="Void Transaction"
        variant="danger"
        onConfirm={() => { if (confirmVoid) { onVoidTransaction(confirmVoid); setConfirmVoid(null); } }}
        onCancel={() => setConfirmVoid(null)}
      />

      <ConfirmDialog
        open={confirmRefund !== null}
        title="Issue Refund"
        message="This will create a refund transaction and return items to inventory. The customer will receive their money back."
        confirmLabel="Issue Refund"
        variant="danger"
        onConfirm={() => { if (confirmRefund) { onRefundTransaction(confirmRefund); setConfirmRefund(null); } }}
        onCancel={() => setConfirmRefund(null)}
      />
    </div>
  );
}
