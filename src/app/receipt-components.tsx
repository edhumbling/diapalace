"use client";

import { useState } from "react";
import { Check, Download, Printer, X } from "lucide-react";
import type { ReceiptData, ReceiptWidth } from "@/lib/receipt-data";
import { brand } from "@/lib/brand";

const receiptMoney = (value: number) => value.toFixed(2);

function receiptDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-GH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ReceiptPreview({ receipt, width = "58mm" }: { receipt: ReceiptData; width?: ReceiptWidth }) {
  return <div className={`receipt-paper receipt-${width === "80mm" ? "80" : "58"}`}>
    <header className="receipt-head"><img src={brand.logo} alt="" className="receipt-logo" /><strong>{receipt.businessName}</strong><span>Retail Operations</span><span>{receipt.branchName}</span>{receipt.businessPhone && <span>Tel: {receipt.businessPhone}</span>}{receipt.branchAddress && <span>{receipt.branchAddress}</span>}</header>
    <div className="receipt-rule" />
    <div className="receipt-meta"><span>Receipt: <strong>#{receipt.receiptNumber}</strong></span><span>{receiptDate(receipt.createdAt)}</span><span>Cashier: {receipt.cashierName}</span>{receipt.customerName && <span>Customer: {receipt.customerName}</span>}</div>
    <div className="receipt-rule" />
    <div className="receipt-items"><div className="receipt-item receipt-item-head"><span>ITEM</span><span>QTY</span><span>AMT</span></div>{receipt.items.map((item) => <div className="receipt-item" key={`${item.productId}-${item.name}`}><span><b>{item.name}</b>{item.description && <small>{item.description}</small>}</span><span>{item.quantity}</span><span>{receiptMoney(item.total)}</span></div>)}</div>
    <div className="receipt-rule" />
    <div className="receipt-totals"><span>Subtotal <b>{receiptMoney(receipt.subtotal)}</b></span><span>Discount <b>{receiptMoney(receipt.discount)}</b></span>{receipt.tax > 0 && <span>Tax <b>{receiptMoney(receipt.tax)}</b></span>}<strong>TOTAL <b>{receiptMoney(receipt.total)}</b></strong></div>
    <div className="receipt-payment"><span>Payment: <b>{receipt.paymentMethod}</b></span><span>Paid: <b>{receiptMoney(receipt.amountPaid)}</b></span><span>Change: <b>{receiptMoney(receipt.change)}</b></span></div>
    <div className="receipt-rule" />
    <footer className="receipt-foot"><span>{receipt.footer}</span><strong>{receipt.businessName}</strong></footer>
  </div>;
}

function pdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makeReceiptPdf(receipt: ReceiptData, width: ReceiptWidth) {
  const lines = [receipt.businessName, "Retail Operations", receipt.branchName, receipt.businessPhone ? `Tel: ${receipt.businessPhone}` : "", "--------------------------------", `Receipt: #${receipt.receiptNumber}`, receiptDate(receipt.createdAt), `Cashier: ${receipt.cashierName}`, "--------------------------------", "ITEM                 QTY       AMT", ...receipt.items.flatMap((item) => [item.description ? `${item.name} ${item.description}` : item.name, `  ${item.quantity}                 ${receiptMoney(item.total)}`]), "--------------------------------", `Subtotal             ${receiptMoney(receipt.subtotal)}`, `Discount             ${receiptMoney(receipt.discount)}`, ...(receipt.tax > 0 ? [`Tax                  ${receiptMoney(receipt.tax)}`] : []), `TOTAL                ${receiptMoney(receipt.total)}`, `Payment: ${receipt.paymentMethod}`, `Paid                 ${receiptMoney(receipt.amountPaid)}`, `Change               ${receiptMoney(receipt.change)}`, "--------------------------------", receipt.footer, receipt.businessName].filter(Boolean);
  const pageWidth = width === "80mm" ? 226.77 : 164.41;
  const pageHeight = Math.max(220, lines.length * 11 + 24);
  const content = [`BT`, `/F1 8 Tf`, `8 ${pageHeight - 16} Td`, ...lines.map((line, index) => `${index ? "0 -11 Td" : ""} (${pdfText(line.slice(0, width === "80mm" ? 42 : 30))}) Tj`), `ET`].join("\n");
  const objects = [`<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`, `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function ReceiptScreen({ receipt, onNewSale, onClose }: { receipt: ReceiptData; onNewSale: () => void; onClose?: () => void }) {
  const [width, setWidth] = useState<ReceiptWidth>(receipt.width ?? "58mm");
  const [printMessage, setPrintMessage] = useState("");
  const printReceipt = () => { setPrintMessage("Print dialog opened. If the printer is unavailable, download a copy below."); window.print(); };
  const downloadReceipt = () => { const url = URL.createObjectURL(makeReceiptPdf(receipt, width)); const link = document.createElement("a"); link.href = url; link.download = `${receipt.receiptNumber}.pdf`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <div className="receipt-screen"><div className="receipt-screen-head"><div><p className="eyebrow">Sale completed</p><h1>Receipt ready</h1><p>Receipt <strong>#{receipt.receiptNumber}</strong> for <strong>GH₵ {receiptMoney(receipt.total)}</strong>.</p></div>{onClose && <button className="icon-btn" aria-label="Close receipt" onClick={onClose}><X size={20} /></button>}</div><div className="receipt-width-control"><span>Printer width</span><button className={width === "58mm" ? "active" : ""} onClick={() => setWidth("58mm")}>58mm</button><button className={width === "80mm" ? "active" : ""} onClick={() => setWidth("80mm")}>80mm</button></div><div className="receipt-preview-shell"><div className="receipt-print-surface"><ReceiptPreview receipt={receipt} width={width} /></div></div><div className="receipt-actions"><button className="button primary" onClick={printReceipt}><Printer size={18} /> Print Receipt</button><button className="button secondary" onClick={downloadReceipt}><Download size={18} /> Download PDF</button><button className="button ghost" onClick={onNewSale}><Check size={18} /> New Sale</button></div>{printMessage && <p className="receipt-print-message">{printMessage}</p>}</div>;
}
