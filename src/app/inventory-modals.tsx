"use client";

import { useState } from "react";
import { Check, FileSpreadsheet, PackageOpen, Upload, X } from "lucide-react";
import type { Product } from "@/lib/pos-data";

type ProductInput = Omit<Product, "id">;
export type BulkRow = { name: string; description: string; price: number; quantity: number; category: string };

function ModalFrame({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal inventory-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><p className="modal-eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}</section></div>;
}

export function ProductEditorModal({ product, onClose, onSave }: { product?: Product; onClose: () => void; onSave: (product: ProductInput) => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [quantity, setQuantity] = useState(product ? String(product.stock) : "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [reorderAt, setReorderAt] = useState(product ? String(product.reorderAt) : "0");
  const [error, setError] = useState("");

  const save = () => {
    if (!name.trim() || price === "" || Number(price) < 0 || Number(quantity || 0) < 0) {
      setError("Product name, selling price, and a valid quantity are required.");
      return;
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      sku: product?.sku ?? `DP-${Date.now().toString().slice(-6)}`,
      category: category.trim(),
      price: Number(price),
      cost: product?.cost ?? 0,
      stock: Number(quantity || 0),
      reorderAt: Number(reorderAt || 0),
      unit: product?.unit ?? "piece",
    });
  };

  return <ModalFrame title={product ? "Edit product" : "Add product"} eyebrow="Notebook inventory" onClose={onClose}>
    {error && <div className="auth-error" style={{ margin: "1rem 1.35rem 0" }}>{error}</div>}
    <div className="form-grid">
      <label className="wide">Product name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Caro White" /></label>
      <label className="wide">Size / description<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. 500ml, S/S 200ml, blue" /></label>
      <label>Selling price (GH₵)<input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="50" /></label>
      <label>Quantity<input type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="4" /></label>
      <label className="wide">Category <span className="field-optional">optional</span><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Skin Care" /></label>
      <label>Low-stock threshold <span className="field-optional">optional</span><input type="number" min="0" step="1" value={reorderAt} onChange={(event) => setReorderAt(event.target.value)} /></label>
    </div>
    <p className="modal-note">SKU and internal product IDs are handled automatically. Your product wording is kept exactly as entered.</p>
    <div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={save}><Check size={17} /> {product ? "Save changes" : "Save product"}</button></div>
  </ModalFrame>;
}

export function BulkOpeningInventoryModal({ onClose, onSave }: { onClose: () => void; onSave: (rows: BulkRow[]) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !/^product\b/i.test(line)).map((line) => {
    const values = line.split(/\t|\s*\|\s*|\s*,\s*/).map((value) => value.trim());
    return { name: values[0] ?? "", description: values[1] ?? "", price: Number(values[2] ?? 0), quantity: Number(values[3] ?? 0), category: values[4] ?? "" };
  });

  const save = () => {
    if (!rows.length || rows.some((row) => !row.name || !Number.isFinite(row.price) || row.price < 0 || !Number.isInteger(row.quantity) || row.quantity < 0)) {
      setError("Review each row. Use: Product | Description / Size | Price | Quantity | Category (optional).");
      return;
    }
    onSave(rows);
  };

  return <ModalFrame title="Import opening inventory" eyebrow="Verified notebook migration" onClose={onClose}>
    <div className="bulk-inventory-intro"><FileSpreadsheet size={20} /><p>Paste rows from the notebook. Nothing is saved until you review and confirm the entries.</p></div>
    <label className="bulk-textarea-label">Paste rows<textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder={'Midnight Powder | 600g | 40 | 4\nCaro White | 500ml | 50 | 4\nDodo | 500ml | 65 | 9'} /></label>
    {error && <div className="auth-error" style={{ margin: "0 1.35rem" }}>{error}</div>}
    {rows.length > 0 && <div className="bulk-preview"><div className="bulk-preview-head"><strong>Review {rows.length} entries</strong><span>Opening stock only</span></div><div className="table-scroll"><table><thead><tr><th>Product</th><th>Description / Size</th><th>Price</th><th>Qty</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.name}-${index}`}><td>{row.name}</td><td>{row.description || "-"}</td><td>GH₵ {row.price.toFixed(2)}</td><td>{row.quantity}</td></tr>)}</tbody></table></div></div>}
    <div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!rows.length} onClick={save}><Upload size={17} /> Confirm and save</button></div>
  </ModalFrame>;
}

export function StockCountModal({ products, onClose, onSave }: { products: Product[]; onClose: () => void; onSave: (rows: Array<{ productId: string; physicalQuantity: number }>, reason: string) => void }) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(products.map((product) => [product.id, String(product.stock)])));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const save = () => {
    const rows = products.map((product) => ({ productId: product.id, physicalQuantity: Number(quantities[product.id]) })).filter((row) => Number.isInteger(row.physicalQuantity) && row.physicalQuantity >= 0);
    if (!reason.trim() || rows.length !== products.length) { setError("Enter a valid physical quantity for every row and a reason for the count."); return; }
    onSave(rows, reason.trim());
  };

  return <ModalFrame title="Stock count" eyebrow="Physical verification" onClose={onClose}>
    <div className="bulk-inventory-intro"><PackageOpen size={20} /><p>Compare the system quantity with what is physically on the shelf. Differences require a reason and are recorded as controlled adjustments.</p></div>
    <div className="stock-count-table table-scroll"><table><thead><tr><th>Product</th><th>System qty</th><th>Physical qty</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.description || product.sku}</small></td><td>{product.stock}</td><td><input type="number" min="0" step="1" value={quantities[product.id]} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: event.target.value }))} /></td></tr>)}</tbody></table></div>
    <label className="stock-count-reason">Reason for count / differences<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Monthly physical count" /></label>
    {error && <div className="auth-error" style={{ margin: "0 1.35rem" }}>{error}</div>}
    <div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={save}><Check size={17} /> Review and commit</button></div>
  </ModalFrame>;
}
