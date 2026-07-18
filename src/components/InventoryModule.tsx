"use client";

import React, { useState, useMemo } from "react";
import { GlassTile, Icon, toneForCategory } from "./glass/icons";
import { Product, ProductVariation, db } from "../lib/db";
import { useToast } from "./Toasts";
import { useDebounce } from "../hooks/useDebounce";
import ConfirmDialog from "./ConfirmDialog";

interface InventoryModuleProps {
  products: Product[];
  categories: string[];
  onProductsChange: (newProducts: Product[]) => void;
  onCategoriesChange: (newCategories: string[]) => void;
}

const PAGE_SIZE = 10;

export default function InventoryModule({
  products,
  categories,
  onProductsChange,
  onCategoriesChange
}: InventoryModuleProps) {
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState(categories[0] || "");
  const [formDesc, setFormDesc] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [hasVariations, setHasVariations] = useState(false);
  const [formVariations, setFormVariations] = useState<ProductVariation[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const debouncedSearch = useDebounce(searchQuery, 250);

  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [products, debouncedSearch]);

  const pageCount = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const paged = filteredProducts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const startAddNew = () => {
    setIsAddingNew(true);
    setEditingProduct(null);
    setFormName(""); setFormCategory(categories[0] || ""); setFormDesc(""); setFormPrice(""); setFormStock("");
    setHasVariations(false); setFormVariations([]); setErrors({});
  };

  const startEdit = (prod: Product) => {
    setEditingProduct(prod);
    setIsAddingNew(false);
    setFormName(prod.name); setFormCategory(prod.category); setFormDesc(prod.description);
    setFormPrice(prod.price.toString()); setFormStock(prod.stock.toString());
    setHasVariations(prod.variations && prod.variations.length > 0);
    setFormVariations(prod.variations ? [...prod.variations] : []);
    setErrors({});
  };

  const cancelForm = () => {
    setIsAddingNew(false);
    setEditingProduct(null);
    setErrors({});
  };

  const addVariationRow = () => {
    setFormVariations((prev) => [...prev, { size: "", color: "", price: Number(formPrice) || 0, stock: 0 }]);
  };

  const updateVariationRow = <K extends keyof ProductVariation>(index: number, key: K, val: ProductVariation[K]) => {
    setFormVariations((prev) => prev.map((vari, idx) => (idx === index ? { ...vari, [key]: val } : vari)));
  };

  const removeVariationRow = (index: number) => {
    setFormVariations((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formName.trim()) e.name = "Product name is required";
    if (!formCategory) e.category = "Category is required";
    if (!formPrice || isNaN(Number(formPrice)) || Number(formPrice) < 0) e.price = "Valid price required";
    if (!formStock || isNaN(Number(formStock)) || Number(formStock) < 0) e.stock = "Valid stock count required";
    if (hasVariations) {
      if (formVariations.length === 0) e.variations = "At least one variation required";
      formVariations.forEach((v, i) => {
        if (!v.size && !v.color) e[`v${i}`] = "Size or color required";
        if (v.price < 0 || v.stock < 0) e[`v${i}`] = "Invalid price or stock";
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast("Please fix the form errors.", "error");
      return;
    }

    const price = Number(formPrice);
    const stock = Number(formStock);
    let finalVariations: ProductVariation[] = [];
    if (hasVariations) {
      finalVariations = formVariations.map((v) => ({
        ...v,
        price: v.price || price,
        stock: v.stock || 0,
      }));
    }

    const productData: Product = {
      id: editingProduct ? editingProduct.id : `p-${Date.now()}`,
      name: formName.trim(),
      category: formCategory,
      description: formDesc.trim(),
      price,
      stock: hasVariations ? finalVariations.reduce((acc, v) => acc + v.stock, 0) : stock,
      variations: finalVariations,
      image: "/logo.png"
    };

    let updatedProducts: Product[];
    if (editingProduct) {
      updatedProducts = products.map((p) => (p.id === editingProduct.id ? productData : p));
      toast("Product updated.", "success");
    } else {
      updatedProducts = [...products, productData];
      toast("Product added to catalog.", "success");
    }

    onProductsChange(updatedProducts);
    db.saveProducts(updatedProducts);
    cancelForm();
  };

  const handleDelete = (id: string) => {
    const updated = products.filter((p) => p.id !== id);
    onProductsChange(updated);
    db.saveProducts(updated);
    if (editingProduct?.id === id) cancelForm();
    toast("Product deleted.", "info");
  };

  const handleBatchDelete = () => {
    const count = selectedIds.size;
    const updated = products.filter((p) => !selectedIds.has(p.id));
    onProductsChange(updated);
    db.saveProducts(updated);
    setSelectedIds(new Set());
    setBatchDeleteConfirm(false);
    toast(`${count} products deleted.`, "info");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((p) => p.id)));
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    if (categories.some((c) => c.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      toast("Category already exists.", "warning");
      return;
    }
    const updated = [...categories, newCategoryName.trim()];
    onCategoriesChange(updated);
    db.saveCategories(updated);
    setNewCategoryName("");
    setFormCategory(newCategoryName.trim());
    toast("Category added.", "success");
  };

  const inputCls = (hasError?: string) =>
    `w-full rounded-xl px-3 py-2 text-xs font-semibold ${hasError ? "!border-coral/60" : ""}`;

  return (
    <div className="relative flex flex-1 flex-col gap-4 xl:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        {/* Header */}
        <div className="g-panel flex flex-col items-stretch justify-between gap-3 rounded-3xl p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <GlassTile name="layers" tone="violet" size={38} />
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">Administrative Catalog</h3>
              <p className="num mt-0.5 text-[10px] text-faint">{products.length} products · {categories.length} categories</p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setBatchDeleteConfirm(true)}
                className="btn-danger flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold"
              >
                <Icon name="trash" size={13} />
                <span>Delete ({selectedIds.size})</span>
              </button>
            )}
            <button
              onClick={startAddNew}
              className="btn-aurora flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em]"
            >
              <Icon name="plus" size={14} strokeWidth={2.2} />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="g-panel flex flex-col justify-between gap-3 rounded-3xl p-4 sm:flex-row sm:items-center">
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <div className="relative w-full sm:w-56">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
                <Icon name="search" size={13} />
              </span>
              <input
                type="text"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                className="w-full rounded-xl py-2 pl-9 pr-3 text-[11px] font-semibold"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <span key={c} className="pill pill-plain">{c}</span>
              ))}
            </div>
          </div>
          <form onSubmit={handleAddCategory} className="flex w-full items-end gap-2 sm:w-auto">
            <div className="flex w-full flex-col gap-1 sm:w-44">
              <label className="lbl !text-[8px]">New category</label>
              <input
                type="text"
                placeholder="e.g. Perfumes"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="rounded-xl px-3 py-1.5 text-[11px] font-semibold"
              />
            </div>
            <button type="submit" className="btn-ico h-8 w-8 shrink-0" title="Add category">
              <Icon name="plus" size={13} />
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="g-panel overflow-x-auto rounded-3xl">
          <table className="gtab min-w-[760px]">
            <thead>
              <tr>
                <th className="w-10 !pl-5 !pr-2">
                  <input type="checkbox" checked={selectedIds.size === paged.length && paged.length > 0} onChange={toggleSelectAll} />
                </th>
                <th>Item</th>
                <th>Category</th>
                <th>Base Price</th>
                <th>Stock</th>
                <th className="text-center">Variations</th>
                <th className="!pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length > 0 ? (
                paged.map((p) => {
                  const hasVari = p.variations && p.variations.length > 0;
                  return (
                    <tr key={p.id} className={editingProduct?.id === p.id ? "bg-lilac/[0.05]" : ""}>
                      <td className="!pl-5 !pr-2">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <GlassTile tone={toneForCategory(p.category)} size={34}>
                            <span className="!text-[9px]">{p.category.substring(0, 2).toUpperCase()}</span>
                          </GlassTile>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-ink">{p.name}</div>
                            <div className="line-clamp-1 text-[10px] text-faint">{p.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="font-semibold">{p.category}</td>
                      <td className="num font-bold text-ink">GH₵ {p.price.toFixed(2)}</td>
                      <td className={`num font-bold ${p.stock < 10 ? "text-honey" : "text-ink"}`}>{p.stock}</td>
                      <td className="text-center">
                        {hasVari ? (
                          <span className="pill pill-lilac">{p.variations.length} options</span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="!pr-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => startEdit(p)} className="btn-ico h-8 w-8" title="Edit">
                            <Icon name="edit" size={13} />
                          </button>
                          <button onClick={() => setConfirmDelete(p.id)} className="btn-ico h-8 w-8 hover:!border-coral/40 hover:!bg-coral/10 hover:!text-coral" title="Delete">
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={7} className="!py-16 text-center text-faint">No products found</td></tr>
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

      {/* ------- Editor panel ------- */}
      {(isAddingNew || editingProduct) && (
        <div className="g-panel pop flex w-full flex-col overflow-hidden rounded-[28px] xl:w-96 xl:shrink-0">
          <div className="flex items-center justify-between border-b border-white/[0.07] p-4">
            <div className="flex items-center gap-2.5">
              <GlassTile name={editingProduct ? "edit" : "plus"} tone="violet" size={30} />
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">
                {editingProduct ? "Modify Product" : "Add Catalog Item"}
              </h3>
            </div>
            <button onClick={cancelForm} className="btn-ico h-8 w-8">
              <Icon name="x" size={14} />
            </button>
          </div>

          <form onSubmit={handleProductSubmit} className="flex max-h-[calc(100vh-260px)] flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-1.5">
              <label className="lbl">Product name *</label>
              <input type="text" placeholder="e.g. Shea Butter Skin Pomade" value={formName} onChange={(e) => setFormName(e.target.value)} className={inputCls(errors.name)} />
              {errors.name && <span className="text-[10px] font-semibold text-coral">{errors.name}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="lbl">Category *</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className={inputCls(errors.category)}>
                {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="lbl">Description</label>
              <textarea placeholder="Product properties…" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} className="w-full resize-none rounded-xl px-3 py-2 text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="lbl">Base price (GH₵) *</label>
                <input type="number" step="0.01" min="0" placeholder="60.00" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} disabled={hasVariations} className={`num ${inputCls(errors.price)} disabled:opacity-40`} />
                {errors.price && <span className="text-[10px] font-semibold text-coral">{errors.price}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="lbl">Base stock *</label>
                <input type="number" min="0" placeholder="30" value={formStock} onChange={(e) => setFormStock(e.target.value)} disabled={hasVariations} className={`num ${inputCls(errors.stock)} disabled:opacity-40`} />
                {errors.stock && <span className="text-[10px] font-semibold text-coral">{errors.stock}</span>}
              </div>
            </div>

            <label htmlFor="toggle-variations" className="g-deep flex cursor-pointer items-center gap-3 rounded-2xl p-3.5">
              <input
                type="checkbox"
                id="toggle-variations"
                checked={hasVariations}
                onChange={(e) => { setHasVariations(e.target.checked); if (e.target.checked && formVariations.length === 0) addVariationRow(); }}
              />
              <span className="text-xs font-bold text-ink">Product has variations</span>
            </label>

            {hasVariations && (
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-3">
                <div className="flex items-center justify-between">
                  <span className="lbl">Variations</span>
                  <button type="button" onClick={addVariationRow} className="flex items-center gap-1 text-[11px] font-bold text-ice transition-colors hover:text-ink">
                    <Icon name="plus" size={12} /><span>Add option</span>
                  </button>
                </div>
                {errors.variations && <span className="text-[10px] font-semibold text-coral">{errors.variations}</span>}
                <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
                  {formVariations.map((vari, idx) => (
                    <div key={idx} className="g-deep relative flex flex-col gap-2 rounded-2xl p-3">
                      <button type="button" onClick={() => removeVariationRow(idx)} className="btn-ico absolute right-2 top-2 h-6 w-6 !rounded-lg hover:!text-coral">
                        <Icon name="x" size={11} />
                      </button>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="lbl !text-[8px]">Size</label>
                          <input type="text" placeholder="M, L, 250ml" value={vari.size || ""} onChange={(e) => updateVariationRow(idx, "size", e.target.value)} className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-[10px] font-bold" />
                        </div>
                        <div>
                          <label className="lbl !text-[8px]">Color</label>
                          <input type="text" placeholder="e.g. Red" value={vari.color || ""} onChange={(e) => updateVariationRow(idx, "color", e.target.value)} className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-[10px] font-bold" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="lbl !text-[8px]">Price (GH₵)</label>
                          <input type="number" step="0.01" value={vari.price} onChange={(e) => updateVariationRow(idx, "price", Number(e.target.value))} className="num mt-1 w-full rounded-lg px-2.5 py-1.5 text-[10px]" />
                        </div>
                        <div>
                          <label className="lbl !text-[8px]">Stock</label>
                          <input type="number" value={vari.stock} onChange={(e) => updateVariationRow(idx, "stock", Number(e.target.value))} className="num mt-1 w-full rounded-lg px-2.5 py-1.5 text-[10px]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="btn-aurora mt-1 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[10px] font-extrabold uppercase tracking-[0.16em]">
              <Icon name="save" size={14} strokeWidth={2} /><span>Save Product</span>
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (confirmDelete) { handleDelete(confirmDelete); setConfirmDelete(null); } }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={batchDeleteConfirm}
        title="Delete Selected Products"
        message={`Delete ${selectedIds.size} selected products? This action cannot be undone.`}
        confirmLabel="Delete All"
        variant="danger"
        onConfirm={handleBatchDelete}
        onCancel={() => setBatchDeleteConfirm(false)}
      />
    </div>
  );
}
