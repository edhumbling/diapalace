"use client";

import React, { useState } from "react";
import { BarChart3, Search, FileText, Ban, TrendingUp, Wallet } from "lucide-react";
import { Transaction } from "../lib/db";

interface AnalyticsModuleProps {
  transactions: Transaction[];
  onVoidTransaction: (transactionId: string) => void;
  onViewReceipt: (tx: Transaction) => void;
}

export default function AnalyticsModule({
  transactions,
  onVoidTransaction,
  onViewReceipt
}: AnalyticsModuleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPayment, setFilterPayment] = useState("All");

  // Filtered transactions history list
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.customer && tx.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.customer && tx.customer.phone.includes(searchQuery));
    const matchesPayment =
      filterPayment === "All" || tx.paymentMethod === filterPayment;
    return matchesSearch && matchesPayment;
  });

  // Calculate Metrics (Aggregated by Day, Week, Month)
  const now = new Date();
  
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;
  const oneMonthMs = 30 * oneDayMs;

  const calculateRevenue = (timeframeMs: number) => {
    return transactions
      .filter((tx) => {
        if (tx.isVoided) return false;
        const txDate = new Date(tx.timestamp);
        return now.getTime() - txDate.getTime() <= timeframeMs;
      })
      .reduce((acc, tx) => acc + tx.total, 0);
  };

  const dailyRevenue = calculateRevenue(oneDayMs);
  const weeklyRevenue = calculateRevenue(oneWeekMs);
  const monthlyRevenue = calculateRevenue(oneMonthMs);

  // MoMo vs Cash stats (all time, non-voided)
  const cashTotal = transactions
    .filter((tx) => !tx.isVoided && tx.paymentMethod === "Cash")
    .reduce((acc, tx) => acc + tx.total, 0);
  const momoTotal = transactions
    .filter((tx) => !tx.isVoided && tx.paymentMethod === "Mobile Money")
    .reduce((acc, tx) => acc + tx.total, 0);

  const handleVoidClick = (txId: string) => {
    if (
      confirm(
        "Are you sure you want to void this transaction? All items will be returned to inventory stock."
      )
    ) {
      onVoidTransaction(txId);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 relative">
      
      {/* Top Cards: Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Daily Revenue Card */}
        <div className="glass-panel p-6 rounded-3xl border-zinc-900 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">
              Today&apos;s Sales (24h)
            </span>
            <span className="text-2xl font-black text-rose-300 font-mono">
              GH₵ {dailyRevenue.toFixed(2)}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">Active retail operations</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-300 border border-rose-500/20 group-hover:scale-105 transition-transform duration-300">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Weekly Revenue Card */}
        <div className="glass-panel p-6 rounded-3xl border-zinc-900 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">
              Weekly Revenue (7d)
            </span>
            <span className="text-2xl font-black text-violet-300 font-mono">
              GH₵ {weeklyRevenue.toFixed(2)}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">Weekly sales performance</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-300 border border-violet-500/20 group-hover:scale-105 transition-transform duration-300">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        {/* Monthly Revenue Card */}
        <div className="glass-panel p-6 rounded-3xl border-zinc-900 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">
              Monthly Revenue (30d)
            </span>
            <span className="text-2xl font-black text-cyan-300 font-mono">
              GH₵ {monthlyRevenue.toFixed(2)}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">Monthly balance overview</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-300 border border-cyan-500/20 group-hover:scale-105 transition-transform duration-300">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Balance Stats (Cash vs MoMo) */}
      <div className="glass-panel p-5 rounded-2xl border-zinc-900 flex flex-col sm:flex-row gap-6 justify-around items-center text-center">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Cash in Drawer</span>
          <span className="text-lg font-bold text-zinc-200 font-mono">GH₵ {cashTotal.toFixed(2)}</span>
        </div>
        <div className="hidden sm:block w-px h-10 bg-zinc-900" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Mobile Money Ledger</span>
          <span className="text-lg font-bold text-rose-300 font-mono">GH₵ {momoTotal.toFixed(2)}</span>
        </div>
        <div className="hidden sm:block w-px h-10 bg-zinc-900" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Voided Transactions Rate</span>
          <span className="text-lg font-bold text-zinc-500 font-mono">
            {transactions.length > 0
              ? `${Math.round(
                  (transactions.filter((t) => t.isVoided).length / transactions.length) * 100
                )}%`
              : "0%"}
          </span>
        </div>
      </div>

      {/* History Log Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/40 p-4 border border-zinc-900 rounded-2xl">
          
          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by receipt ID or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-400/50"
            />
          </div>

          {/* Payment Method filter */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full">
            {["All", "Cash", "Mobile Money"].map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterPayment(opt)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer ${
                  filterPayment === opt
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-sm"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction History Log Table */}
        <div className="glass-panel rounded-2xl border-zinc-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
                <th className="py-4 px-5">Receipt ID</th>
                <th className="py-4 px-4">Date & Time</th>
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Payment Method</th>
                <th className="py-4 px-4">Amount</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/55 text-xs">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-zinc-900/10 transition-colors ${
                        tx.isVoided ? "opacity-60 bg-zinc-950/20" : ""
                      }`}
                    >
                      <td className="py-3.5 px-5 font-mono font-bold text-zinc-200">{tx.id}</td>
                      <td className="py-3.5 px-4 text-zinc-500 font-mono">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-300">
                        {tx.customer ? tx.customer.name : <span className="text-zinc-600 font-normal">Walk-in</span>}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-400">
                        {tx.paymentMethod} {tx.momoNetwork ? `(${tx.momoNetwork})` : ""}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-300">
                        GH₵ {tx.total.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            tx.isVoided
                              ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {tx.isVoided ? "Voided" : "Completed"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex justify-end gap-2.5">
                          <button
                            onClick={() => onViewReceipt(tx)}
                            className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                            title="View Receipt"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {!tx.isVoided && (
                            <button
                              onClick={() => handleVoidClick(tx.id)}
                              className="p-1.5 rounded-lg border border-zinc-800 hover:border-rose-900/60 text-zinc-600 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Void Transaction"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-600 font-medium">
                    No transactions recorded in history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
