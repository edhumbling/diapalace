"use client";

import React, { useState } from "react";
import { GlassTile, Icon } from "./glass/icons";
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

const NETWORK_STYLES: Record<"MTN" | "Telecel" | "AT", string> = {
  MTN: "border-honey/50 bg-honey/10 text-honey shadow-[0_0_18px_-4px_rgba(251,191,36,0.5)]",
  Telecel: "border-coral/50 bg-coral/10 text-coral shadow-[0_0_18px_-4px_rgba(251,113,133,0.5)]",
  AT: "border-sky/50 bg-sky/10 text-sky shadow-[0_0_18px_-4px_rgba(96,165,250,0.5)]",
};

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
    <div className="g-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={trapRef}
        className="g-panel-2 pop flex max-h-[90vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-[30px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <GlassTile name="card" tone="cyan" size={36} />
            <div>
              <h3 className="font-display text-base font-bold tracking-tight text-ink">Secure Checkout</h3>
              <p className="mt-0.5 text-[10px] font-semibold text-faint">
                {linkedCustomer ? `Linked: ${linkedCustomer.name}` : "Walk-in transaction"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ico h-9 w-9">
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Bill summary */}
        <div className="g-deep relative overflow-hidden rounded-3xl p-5 text-center">
          <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-[0.18em] text-faint">
            <span>Total bill</span>
            {discount > 0 && <span className="text-mint">−GH₵ {discount.toFixed(2)} discount</span>}
          </div>
          <div className="mt-2 flex items-baseline justify-center gap-2.5">
            {discount > 0 && (
              <span className="num text-base text-faint line-through">GH₵ {subtotal.toFixed(2)}</span>
            )}
            <span
              className="num text-[34px] font-bold leading-none text-ice"
              style={{ textShadow: "0 0 30px rgba(103, 232, 249, 0.45)" }}
            >
              GH₵ {totalBill.toFixed(2)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="lbl">Payment method</span>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: "Cash", icon: "banknote", tone: "emerald", label: "Cash" },
                { id: "Mobile Money", icon: "smartphone", tone: "blue", label: "MoMo" },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex items-center justify-center gap-2.5 rounded-2xl border py-3.5 text-[11px] font-extrabold uppercase tracking-[0.12em] transition-all ${
                    paymentMethod === m.id
                      ? "border-ice/50 bg-ice/[0.08] text-ink shadow-[0_0_24px_-6px_rgba(103,232,249,0.6)]"
                      : "border-white/[0.07] bg-white/[0.03] text-faint hover:border-white/[0.14] hover:text-dim"
                  }`}
                >
                  <GlassTile name={m.icon} tone={m.tone} size={26} className={paymentMethod === m.id ? "" : "opacity-60 saturate-[0.6]"} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "Cash" ? (
            <div className="g-deep flex flex-col gap-4 rounded-3xl p-4">
              <div className="flex flex-col gap-1.5">
                <label className="lbl">Amount received (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  min={totalBill}
                  placeholder="Enter amount received"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="num w-full rounded-2xl px-4 py-3 text-sm font-bold"
                  required
                />
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs">
                <span className="font-semibold text-dim">Change due back</span>
                <span className={`num text-base font-bold ${changeDue > 0 ? "text-mint" : "text-faint"}`}>
                  GH₵ {changeDue.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="g-deep flex flex-col gap-4 rounded-3xl p-4">
              <div className="flex flex-col gap-2">
                <span className="lbl">Network provider</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["MTN", "Telecel", "AT"] as const).map((network) => (
                    <button
                      key={network}
                      type="button"
                      onClick={() => setMomoNetwork(network)}
                      className={`rounded-xl border py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em] transition-all ${
                        momoNetwork === network
                          ? NETWORK_STYLES[network]
                          : "border-white/[0.07] bg-white/[0.03] text-faint hover:text-dim"
                      }`}
                    >
                      {network}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="lbl !text-[8px]">MoMo number</label>
                  <input
                    type="text"
                    placeholder="e.g. +233 24 400 0000"
                    value={momoPhone}
                    onChange={(e) => setMomoPhone(e.target.value)}
                    className="num w-full rounded-xl px-3 py-2.5 text-xs font-semibold"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="lbl !text-[8px]">Reference (optional)</label>
                  <input
                    type="text"
                    placeholder="Transaction ID"
                    value={momoRef}
                    onChange={(e) => setMomoRef(e.target.value)}
                    className="num w-full rounded-xl px-3 py-2.5 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-aurora flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[11px] font-extrabold uppercase tracking-[0.16em]"
          >
            <Icon name="checkCircle" size={16} strokeWidth={2} />
            <span>Complete Transaction</span>
          </button>
        </form>
      </div>
    </div>
  );
}
