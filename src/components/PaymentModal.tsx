"use client";

import React, { useState } from "react";
import { Banknote, Smartphone, CheckCircle2, X } from "lucide-react";
import { Customer } from "../lib/db";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface PaymentModalProps {
  totalBill: number;
  subtotal: number;
  discount: number;
  linkedCustomer: Customer | null;
  onClose: () => void;
  onComplete: (
    paymentMethod: "Cash" | "Mobile Money",
    momoNetwork?: "MTN" | "Telecel" | "AT",
    referenceText?: string,
    amountPaid?: number
  ) => void;
}

export default function PaymentModal({
  totalBill,
  subtotal,
  discount,
  linkedCustomer,
  onClose,
  onComplete
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Mobile Money">("Cash");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const changeDue = amountReceived ? Math.max(0, Number(amountReceived) - totalBill) : 0;
  const [momoNetwork, setMomoNetwork] = useState<"MTN" | "Telecel" | "AT">("MTN");
  const [momoPhone, setMomoPhone] = useState<string>(linkedCustomer ? linkedCustomer.phone : "");
  const [momoRef, setMomoRef] = useState<string>("");

  const trapRef = useFocusTrap(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === "Cash") {
      const received = Number(amountReceived);
      if (isNaN(received) || received < totalBill) {
        return;
      }
      onComplete("Cash", undefined, undefined, received);
    } else {
      if (!momoPhone) return;
      onComplete("Mobile Money", momoNetwork, `Ref: ${momoRef || "N/A"} / Phone: ${momoPhone}`, totalBill);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={trapRef}
        className="glass-panel w-full max-w-lg rounded-3xl border border-zinc-800 p-6 flex flex-col gap-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-900 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Secure Checkout</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {linkedCustomer ? `Linked: ${linkedCustomer.name}` : "Walk-in Transaction"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-zinc-900/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-zinc-500">
            <span>Total Bill</span>
            {discount > 0 && (
              <span className="text-emerald-400">
                -GH₵ {discount.toFixed(2)} discount
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-center gap-2 mt-1">
            {discount > 0 && (
              <span className="text-lg font-mono text-zinc-500 line-through">GH₵ {subtotal.toFixed(2)}</span>
            )}
            <span className="text-3xl font-black text-rose-300 font-mono">GH₵ {totalBill.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Payment Method</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("Cash")}
                className={`py-3.5 rounded-2xl border flex items-center justify-center gap-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  paymentMethod === "Cash"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash Payment</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("Mobile Money")}
                className={`py-3.5 rounded-2xl border flex items-center justify-center gap-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  paymentMethod === "Mobile Money"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : "bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile Money</span>
              </button>
            </div>
          </div>

          {paymentMethod === "Cash" ? (
            <div className="flex flex-col gap-4 bg-zinc-900/10 border border-zinc-900/60 p-4 rounded-2xl">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                  Amount Received (GH₵)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={totalBill}
                  placeholder="Enter amount received"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm font-mono font-bold text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-rose-400/50"
                  required
                />
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-900">
                <span className="text-zinc-500 font-medium">Change Due back</span>
                <span className={`font-mono font-black text-base ${changeDue > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
                  GH₵ {changeDue.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 bg-zinc-900/10 border border-zinc-900/60 p-4 rounded-2xl">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Network Provider</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["MTN", "Telecel", "AT"] as const).map((network) => (
                    <button
                      key={network}
                      type="button"
                      onClick={() => setMomoNetwork(network)}
                      className={`py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        momoNetwork === network
                          ? network === "MTN"
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                            : network === "Telecel"
                            ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                            : "bg-blue-500/10 border-blue-500/40 text-blue-300"
                          : "bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {network}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">MoMo Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +233 24 400 0000"
                    value={momoPhone}
                    onChange={(e) => setMomoPhone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-rose-400/50"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Reference / ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="Transaction ID"
                    value={momoRef}
                    onChange={(e) => setMomoRef(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-rose-400/50"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/10 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete Transaction</span>
          </button>
        </form>
      </div>
    </div>
  );
}
