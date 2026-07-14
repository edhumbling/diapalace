"use client";

import React, { useState, useMemo } from "react";
import { Search, FileText, Ban, TrendingUp, Wallet, Undo2 } from "lucide-react";
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

  // Top products
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

  return (
    <div className="flex-1 flex flex-col gap-6 relative">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Today (24h)", value: dailyRevenue, color: "rose", icon: TrendingUp },
          { label: "This Week (7d)", value: weeklyRevenue, color: "violet", icon: TrendingUp },
          { label: "This Month (30d)", value: monthlyRevenue, color: "cyan", icon: Wallet },
        ].map((card) => {
          const Icon = card.icon;
          const colorMap: Record<string, string> = { rose: "rose", violet: "violet", cyan: "cyan" };
          const c = colorMap[card.color] || "rose";
          return (
            <div key={card.label} className={`glass-panel p-6 rounded-3xl border-zinc-900 shadow-xl flex items-center justify-between relative overflow-hidden group`}>
              <div className={`absolute top-0 right-0 w-24 h-24 bg-${c}-500/5 rounded-full blur-xl pointer-events-none`} />
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">{card.label}</span>
                <span className={`text-2xl font-black text-${c}-300 font-mono`}>GH₵ {card.value.toFixed(2)}</span>
                <span className="text-[10px] text-zinc-500 font-medium">Sales performance</span>
              </div>
              <div className={`w-12 h-12 rounded-2xl bg-${c}-500/10 flex items-center justify-center text-${c}-300 border border-${c}-500/20 group-hover:scale-105 transition-transform duration-300`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Trend Chart */}
      <div className="glass-panel p-5 rounded-2xl border-zinc-900">
        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Revenue Trend (7 days)</span>
        <div className="mt-3 flex items-end gap-2 h-28">
          {revenueData.map((d) => {
            const pct = maxRevenue > 0 ? (d.value / maxRevenue) * 100 : 0;
            return (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[8px] font-mono font-bold text-zinc-500">GH₵{d.value.toFixed(0)}</span>
                <div
                  className="w-full rounded-md bg-gradient-to-t from-rose-500/80 to-rose-400/60 transition-all duration-500"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <span className="text-[8px] font-semibold text-zinc-500 uppercase">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cash vs MoMo + Top Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-5 rounded-2xl border-zinc-900 flex flex-col gap-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Payment Breakdown</span>
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 font-medium">Cash</span>
                <span className="font-mono font-bold text-zinc-200">GH₵ {cashTotal.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${cashPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400 font-medium">Mobile Money</span>
                <span className="font-mono font-bold text-zinc-200">GH₵ {momoTotal.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${momoPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-zinc-900 flex flex-col gap-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Top Products</span>
          {topProducts.length > 0 ? (
            <div className="flex flex-col gap-2">
              {topProducts.map(([name, data]) => {
                const pct = (data.rev / maxTopRev) * 100;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-zinc-300 font-medium truncate pr-2">{name}</span>
                      <span className="font-mono font-bold text-rose-300 shrink-0">GH₵ {data.rev.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-600 py-4 text-center">No sales data yet</p>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="glass-panel p-5 rounded-2xl border-zinc-900 flex flex-col sm:flex-row gap-6 justify-around items-center text-center">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Cash in Drawer</span>
          <span className="text-lg font-bold text-zinc-200 font-mono">GH₵ {cashTotal.toFixed(2)}</span>
        </div>
        <div className="hidden sm:block w-px h-10 bg-zinc-900" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Mobile Money</span>
          <span className="text-lg font-bold text-rose-300 font-mono">GH₵ {momoTotal.toFixed(2)}</span>
        </div>
        <div className="hidden sm:block w-px h-10 bg-zinc-900" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Voided Rate</span>
          <span className="text-lg font-bold text-zinc-500 font-mono">
            {transactions.length > 0
              ? `${Math.round((transactions.filter((t) => t.isVoided).length / transactions.length) * 100)}%`
              : "0%"}
          </span>
        </div>
      </div>

      {/* Transaction History */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/40 p-4 border border-zinc-900 rounded-2xl">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by receipt ID or customer name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-400/50"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full">
            {["All", "Cash", "Mobile Money"].map((opt) => (
              <button
                key={opt}
                onClick={() => { setFilterPayment(opt); setPage(0); }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer ${
                  filterPayment === opt
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-sm"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >{opt}</button>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border-zinc-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
                <th className="py-4 px-5">Receipt ID</th>
                <th className="py-4 px-4">Date & Time</th>
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Payment</th>
                <th className="py-4 px-4">Amount</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/55 text-xs">
              {paged.length > 0 ? (
                paged.map((tx) => (
                  <tr key={tx.id} className={`hover:bg-zinc-900/10 transition-colors ${tx.isVoided ? "opacity-60 bg-zinc-950/20" : ""}`}>
                    <td className="py-3.5 px-5 font-mono font-bold text-zinc-200">{tx.id}</td>
                    <td className="py-3.5 px-4 text-zinc-500 font-mono">{new Date(tx.timestamp).toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-300">
                      {tx.customer ? tx.customer.name : <span className="text-zinc-600 font-normal">Walk-in</span>}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-400">
                      {tx.paymentMethod}{tx.momoNetwork ? ` (${tx.momoNetwork})` : ""}
                    </td>
                    <td className={`py-3.5 px-4 font-mono font-bold ${tx.total < 0 ? "text-rose-400" : "text-rose-300"}`}>
                      {tx.total < 0 ? "-" : ""}GH₵ {Math.abs(tx.total).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        tx.isVoided ? "bg-rose-500/10 border border-rose-500/20 text-rose-400" :
                        tx.total < 0 ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" :
                        "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      }`}>
                        {tx.isVoided ? "Voided" : tx.total < 0 ? "Refund" : "Completed"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex justify-end gap-2.5">
                        <button onClick={() => onViewReceipt(tx)} className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer" title="View Receipt">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        {!tx.isVoided && tx.total >= 0 && (
                          <>
                            <button onClick={() => setConfirmRefund(tx.id)} className="p-1.5 rounded-lg border border-zinc-800 hover:border-amber-900/60 text-zinc-600 hover:text-amber-400 transition-colors cursor-pointer" title="Refund">
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setConfirmVoid(tx.id)} className="p-1.5 rounded-lg border border-zinc-800 hover:border-rose-900/60 text-zinc-600 hover:text-rose-400 transition-colors cursor-pointer" title="Void">
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="py-16 text-center text-zinc-600 font-medium">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 text-xs">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
            >Prev</button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  page === i ? "bg-rose-500/10 text-rose-300 border border-rose-500/30" : "text-zinc-500 hover:text-zinc-200 border border-transparent"
                }`}
              >{i + 1}</button>
            ))}
            <button
              onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
              disabled={page >= pageCount - 1}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
            >Next</button>
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
