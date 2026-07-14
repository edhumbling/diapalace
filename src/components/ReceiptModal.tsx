"use client";

import React, { useState } from "react";
import { Printer, MessageSquare, Mail, X, Copy, Check } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={trapRef}
        className="glass-panel w-full max-w-2xl rounded-3xl border border-zinc-800 p-6 flex flex-col md:flex-row gap-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 bg-white text-zinc-950 font-mono text-[10px] p-5 rounded-2xl shadow-inner max-h-[420px] overflow-y-auto border border-zinc-200">
          <div className="text-center mb-4">
            <h4 className="text-sm font-bold tracking-wider leading-none">DIAPALACE.COM</h4>
            <span className="text-[9px] text-zinc-500 font-medium">Retail Operations</span>
            <p className="text-[8px] text-zinc-500">Accra, Ghana</p>
          </div>

          <div className="flex flex-col gap-1 border-t border-b border-dashed border-zinc-300 py-3 mb-3">
            <div><strong>RECEIPT ID:</strong> {transaction.id}</div>
            <div><strong>DATE:</strong> {formattedDate}</div>
            <div><strong>OPERATOR:</strong> {transaction.operator}</div>
            <div><strong>CUSTOMER:</strong> {transaction.customer ? `${transaction.customer.name} (${transaction.customer.phone})` : "Walk-in"}</div>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            <span className="font-bold underline text-[9px] uppercase tracking-wide">Items Purchased</span>
            {transaction.items.map((item, idx) => {
              const displaySpecs = item.variation ? ` (${item.variation.size || ""}${item.variation.size && item.variation.color ? "/" : ""}${item.variation.color || ""})` : "";
              return (
                <div key={idx} className="flex justify-between items-start leading-tight">
                  <div className="pr-2">
                    {item.name}
                    {displaySpecs && <span className="text-zinc-500 text-[9px] block">{displaySpecs}</span>}
                    <span className="text-zinc-400 text-[8px] block">{item.quantity} x GH₵ {item.price.toFixed(2)}</span>
                  </div>
                  <span className="font-bold shrink-0">GH₵ {(item.quantity * item.price).toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-dashed border-zinc-300 pt-3 flex flex-col gap-1">
            <div className="flex justify-between"><span>Subtotal</span><span>GH₵ {transaction.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>GH₵ {transaction.discount.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-xs border-t border-zinc-300 pt-2.5">
              <span>TOTAL BILL</span>
              <span>GH₵ {transaction.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-zinc-300 mt-4 pt-3 flex flex-col gap-0.5 text-zinc-500 text-[9px]">
            <div><strong>PAYMENT:</strong> {transaction.paymentMethod} {transaction.momoNetwork ? `(${transaction.momoNetwork})` : ""}</div>
            <div><strong>STATUS:</strong> {statusLabel}</div>
          </div>

          <div className="text-center mt-5 text-[8px] text-zinc-400 leading-normal">
            Thank you for your business!<br />Come back soon.
          </div>
        </div>

        <div className="w-full md:w-60 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">Receipt Actions</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>

            <button
              onClick={handleCopy}
              className="w-full py-3 rounded-xl border border-zinc-800 hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "Copied!" : "Copy Receipt"}</span>
            </button>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Share Digital Bill</span>
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-3 px-4 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Message</span>
              </a>
              <a
                href={getEmailLink()}
                className="w-full py-3 rounded-xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 text-violet-400 text-xs font-semibold flex items-center gap-3 px-4 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Email Details</span>
              </a>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-zinc-800 hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-900/10 transition-all cursor-pointer"
          >
            Done & Close
          </button>
        </div>
      </div>
    </div>
  );
}
