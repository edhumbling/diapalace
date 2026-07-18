"use client";

import React, { useState } from "react";
import { Icon } from "./glass/icons";
import { Transaction } from "../lib/db";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ReceiptModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function ReceiptModal({ transaction, onClose }: ReceiptModalProps) {
  const [copied, setCopied] = useState(false);
  const trapRef = useFocusTrap(true);
  const formattedDate = new Date(transaction.timestamp).toLocaleString();

  const receiptItemsText = transaction.items
    .map(
      (item) =>
        `${item.name}${item.variation ? ` (${item.variation.size || ""}${item.variation.size && item.variation.color ? "/" : ""}${item.variation.color || ""})` : ""}\n  ${item.quantity} x GH₵ ${item.price.toFixed(2)} = GH₵ ${(item.quantity * item.price).toFixed(2)}`
    )
    .join("\n");

  const fullReceiptText = `
DIAPALACE.COM ONLINE POS
Retail Operations, Accra, Ghana
================================
RECEIPT ID: ${transaction.id}
DATE: ${formattedDate}
OPERATOR: ${transaction.operator}
CUSTOMER: ${transaction.customer ? `${transaction.customer.name} (${transaction.customer.phone})` : "Walk-in"}
================================
ITEMS PURCHASED:
${receiptItemsText}
--------------------------------
Subtotal:  GH₵ ${transaction.subtotal.toFixed(2)}
Discount:  GH₵ ${transaction.discount.toFixed(2)}
TOTAL:     GH₵ ${transaction.total.toFixed(2)}
================================
Payment:   ${transaction.paymentMethod}${transaction.momoNetwork ? ` (${transaction.momoNetwork})` : ""}
Status:    ${transaction.isVoided ? "VOIDED" : transaction.total < 0 ? "REFUNDED" : "PAID"}
================================
Thank you for your business! Come back soon.
  `.trim();

  const receiptHtml = `
    <html>
      <head>
        <title>Receipt ${transaction.id}</title>
        <style>
          body { font-family: monospace; font-size: 12px; color: #000; margin: 20px; padding: 0; white-space: pre-wrap; line-height: 1.4; }
          .center { text-align: center; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="center">
          <h3>DIAPALACE.COM</h3>
          <p>Retail Operations<br>Accra, Ghana</p>
        </div>
        <p>================================</p>
        <p><strong>RECEIPT ID:</strong> ${transaction.id}</p>
        <p><strong>DATE:</strong> ${formattedDate}</p>
        <p><strong>OPERATOR:</strong> ${transaction.operator}</p>
        <p><strong>CUSTOMER:</strong> ${transaction.customer ? `${transaction.customer.name} (${transaction.customer.phone})` : "Walk-in"}</p>
        <p>================================</p>
        <p><strong>ITEMS:</strong></p>
        ${transaction.items.map((item) => `
          <div>
            ${item.name}${item.variation ? ` (${item.variation.size || ""}${item.variation.size && item.variation.color ? "/" : ""}${item.variation.color || ""})` : ""}<br>
            &nbsp;&nbsp;${item.quantity} x GH₵ ${item.price.toFixed(2)} = GH₵ ${(item.quantity * item.price).toFixed(2)}
          </div>`).join("")}
        <p>--------------------------------</p>
        <p><strong>Subtotal:</strong> GH₵ ${transaction.subtotal.toFixed(2)}</p>
        <p><strong>Discount:</strong> GH₵ ${transaction.discount.toFixed(2)}</p>
        <p><strong>TOTAL:</strong> GH₵ ${transaction.total.toFixed(2)}</p>
        <p>================================</p>
        <p><strong>Payment:</strong> ${transaction.paymentMethod}${transaction.momoNetwork ? ` (${transaction.momoNetwork})` : ""}</p>
        <p><strong>Status:</strong> ${transaction.isVoided ? "VOIDED" : transaction.total < 0 ? "REFUNDED" : "PAID"}</p>
        <p>================================</p>
        <div class="center">
          <p>Thank you for your business!<br>Come back soon.</p>
        </div>
        <script>
          window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
        </script>
      </body>
    </html>`;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      const blob = new Blob([receiptHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${transaction.id}.html`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const getWhatsAppLink = () => {
    const encodedText = encodeURIComponent(fullReceiptText);
    const phoneNum = transaction.customer ? transaction.customer.phone.replace(/[^0-9+]/g, "") : "";
    return `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodedText}`;
  };

  const getEmailLink = () => {
    const subject = encodeURIComponent(`Receipt ${transaction.id} - DiaPalace.com`);
    const encodedText = encodeURIComponent(fullReceiptText);
    return `mailto:?subject=${subject}&body=${encodedText}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullReceiptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const statusLabel = transaction.isVoided ? "VOIDED" : transaction.total < 0 ? "REFUNDED" : "PAID";
  const statusPill = transaction.isVoided ? "pill-coral" : transaction.total < 0 ? "pill-honey" : "pill-mint";

  return (
    <div className="g-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={trapRef}
        className="g-panel-2 pop flex max-h-[90vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-[30px] p-6 md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Paper receipt — a slice of bright paper floating in liquid glass */}
        <div className="max-h-[440px] flex-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 font-mono text-[10px] text-zinc-900 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
          <div className="mb-4 text-center">
            <h4 className="text-sm font-bold leading-none tracking-wider">DIAPALACE.COM</h4>
            <span className="text-[9px] font-medium text-zinc-500">Retail Operations</span>
            <p className="text-[8px] text-zinc-500">Accra, Ghana</p>
          </div>

          <div className="mb-3 flex flex-col gap-1 border-y border-dashed border-zinc-300 py-3">
            <div><strong>RECEIPT ID:</strong> {transaction.id}</div>
            <div><strong>DATE:</strong> {formattedDate}</div>
            <div><strong>OPERATOR:</strong> {transaction.operator}</div>
            <div><strong>CUSTOMER:</strong> {transaction.customer ? `${transaction.customer.name} (${transaction.customer.phone})` : "Walk-in"}</div>
          </div>

          <div className="mb-3 flex flex-col gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wide underline">Items Purchased</span>
            {transaction.items.map((item, idx) => {
              const displaySpecs = item.variation ? ` (${item.variation.size || ""}${item.variation.size && item.variation.color ? "/" : ""}${item.variation.color || ""})` : "";
              return (
                <div key={idx} className="flex items-start justify-between leading-tight">
                  <div className="pr-2">
                    {item.name}
                    {displaySpecs && <span className="block text-[9px] text-zinc-500">{displaySpecs}</span>}
                    <span className="block text-[8px] text-zinc-400">{item.quantity} x GH₵ {item.price.toFixed(2)}</span>
                  </div>
                  <span className="shrink-0 font-bold">GH₵ {(item.quantity * item.price).toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1 border-t border-dashed border-zinc-300 pt-3">
            <div className="flex justify-between"><span>Subtotal</span><span>GH₵ {transaction.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>GH₵ {transaction.discount.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-zinc-300 pt-2.5 text-xs font-bold">
              <span>TOTAL BILL</span>
              <span>GH₵ {transaction.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-0.5 border-t border-dashed border-zinc-300 pt-3 text-[9px] text-zinc-500">
            <div><strong>PAYMENT:</strong> {transaction.paymentMethod} {transaction.momoNetwork ? `(${transaction.momoNetwork})` : ""}</div>
            <div><strong>STATUS:</strong> {statusLabel}</div>
          </div>

          <div className="mt-5 text-center text-[8px] leading-normal text-zinc-400">
            Thank you for your business!<br />Come back soon.
          </div>
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col justify-between gap-5 md:w-56">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">Receipt</h3>
              <div className="flex items-center gap-2">
                <span className={`pill ${statusPill}`}>{statusLabel}</span>
                <button onClick={onClose} className="btn-ico h-8 w-8">
                  <Icon name="x" size={14} />
                </button>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="btn-aurora flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[10px] font-extrabold uppercase tracking-[0.16em]"
            >
              <Icon name="printer" size={15} strokeWidth={2} />
              <span>Print Receipt</span>
            </button>

            <button
              onClick={handleCopy}
              className="btn-ghost flex w-full items-center justify-center gap-2.5 rounded-2xl py-3 text-xs font-bold"
            >
              {copied ? <Icon name="check" size={15} className="text-mint" /> : <Icon name="copy" size={15} />}
              <span>{copied ? "Copied!" : "Copy Receipt"}</span>
            </button>

            <div className="flex flex-col gap-2">
              <span className="lbl">Share digital bill</span>
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-3 rounded-2xl border border-mint/25 bg-mint/[0.06] px-4 py-3 text-xs font-bold text-mint transition-all hover:border-mint/40 hover:bg-mint/[0.12]"
              >
                <Icon name="message" size={15} />
                <span>WhatsApp Message</span>
              </a>
              <a
                href={getEmailLink()}
                className="flex w-full items-center gap-3 rounded-2xl border border-lilac/25 bg-lilac/[0.06] px-4 py-3 text-xs font-bold text-lilac transition-all hover:border-lilac/40 hover:bg-lilac/[0.12]"
              >
                <Icon name="mail" size={15} />
                <span>Email Details</span>
              </a>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-ghost w-full rounded-2xl py-3 text-[10px] font-extrabold uppercase tracking-[0.16em]"
          >
            Done & Close
          </button>
        </div>
      </div>
    </div>
  );
}
