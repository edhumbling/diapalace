"use client";

import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Save, X, Layers, Search } from "lucide-react";
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

const CATEGORY_COLORS: Record<string, string> = {
  Pomades: "from-amber-400 to-orange-500",
  Skincare: "from-emerald-400 to-teal-500",
  Clothing: "from-violet-400 to-purple-500",
};

function getCatGradient(cat: string): string {
  return CATEGORY_COLORS[cat] || "from-blue-400 to-indigo-500";
}

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

  // Validation errors
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
    const updated = products.filter((p) => !selectedIds.has(p.id));
    onProductsChange(updated);
    db.saveProducts(updated);
    setSelectedIds(new Set());
    setBatchDeleteConfirm(false);
    toast(`${selectedIds.size} products deleted.`, "info");
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

  return (
    <div className="flex-1 flex flex-col xl:flex-row gap-6 relative">
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/40 p-4 border border-zinc-900 rounded-2xl">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">Administrative Catalog</h3>
              <p className="text-[10px] text-zinc-500">{products.length} products</p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setBatchDeleteConfirm(true)}
                className="px-3 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-bold hover:bg-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedIds.size})</span>
              </button>
            )}
            <button
              onClick={startAddNew}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Item</span>
            </button>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border-zinc-900">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl pl-9 pr-3 py-2 text-[11px] text-zinc-200 focus:outline-none focus:border-rose-400/50"
              />
            </div>
            <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Categories:</span>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <span key={c} className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-900 text-[10px] text-zinc-400 font-semibold">
                  {c}
                </span>
              ))}
            </div>
          </div>
          <form onSubmit={handleAddCategory} className="flex gap-2 w-full sm:w-auto items-end">
            <div className="flex flex-col gap-1 w-full sm:w-44">
              <label className="text-[8px] uppercase font-bold tracking-wider text-zinc-500">New Category</label>
              <input
                type="text"
                placeholder="e.g. Perfumes"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-1.5 text-[11px] text-zinc-200 focus:outline-none focus:border-rose-400/50"
              />
            </div>
            <button
              type="submit"
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border border-zinc-800 flex items-center justify-center shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        <div className="glass-panel rounded-2xl border-zinc-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
                <th className="py-4 pl-5 pr-2 w-10">
                  <input type="checkbox" checked={selectedIds.size === paged.length && paged.length > 0} onChange={toggleSelectAll} className="accent-rose-500 cursor-pointer" />
                </th>
                <th className="py-4 px-4">Item</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4">Base Price</th>
                <th className="py-4 px-4">Stock</th>
                <th className="py-4 px-4 text-center">Variations</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/55 text-xs">
              {paged.length > 0 ? (
                paged.map((p) => {
                  const hasVari = p.variations && p.variations.length > 0;
                  return (
                    <tr key={p.id} className={`hover:bg-zinc-900/10 transition-colors ${editingProduct?.id === p.id ? "bg-rose-500/[0.02]" : ""}`}>
                      <td className="py-3.5 pl-5 pr-2">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-rose-500 cursor-pointer" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getCatGradient(p.category)} flex items-center justify-center shrink-0 shadow-sm`}>
                            <span className="text-[9px] font-black text-white">{p.category.substring(0, 2).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-200 truncate">{p.name}</div>
                            <div className="text-[10px] text-zinc-500 line-clamp-1">{p.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-400">{p.category}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-300">GH₵ {p.price.toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-300">
                        <span className={p.stock < 10 ? "text-amber-400" : ""}>{p.stock}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {hasVari ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[9px] font-bold">
                            {p.variations.length} options
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete(p.id)} className="p-1.5 rounded-lg border border-zinc-800 hover:border-rose-900/60 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={7} className="py-16 text-center text-zinc-600 font-medium">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 text-xs">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer">Prev</button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${page === i ? "bg-rose-500/10 text-rose-300 border border-rose-500/30" : "text-zinc-500 hover:text-zinc-200 border border-transparent"}`}
              >{i + 1}</button>
            ))}
            <button onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1} className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer">Next</button>
          </div>
        )}
      </div>

      {(isAddingNew || editingProduct) && (
        <div className="w-full xl:w-96 flex flex-col border border-zinc-900 bg-zinc-950/80 rounded-2xl overflow-hidden flex-shrink-0 animate-slide-in-right">
          <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              {editingProduct ? "Modify Product details" : "Add Catalog Item"}
            </h3>
            <button onClick={cancelForm} className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer"><X className="w-4 h-4" /></button>
          </div>

          <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto max-h-[calc(100vh-270px)] p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Product Name *</label>
              <input type="text" placeholder="e.g. Shea Butter Skin Pomade" value={formName} onChange={(e) => setFormName(e.target.value)}
                className={`bg-zinc-950 border ${errors.name ? "border-rose-500/50" : "border-zinc-800"} rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-rose-400/50`} />
              {errors.name && <span className="text-[9px] text-rose-400 font-medium">{errors.name}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Category *</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-rose-400/50">
                {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Description</label>
              <textarea placeholder="Product properties..." value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                rows={2} className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-rose-400/50 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Base Price (GH₵) *</label>
                <input type="number" step="0.01" min="0" placeholder="60.00" value={formPrice} onChange={(e) => setFormPrice(e.target.value)}
                  disabled={hasVariations}
                  className={`bg-zinc-950 border ${errors.price ? "border-rose-500/50" : "border-zinc-800"} rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-200 focus:outline-none focus:border-rose-400/50 disabled:opacity-40`} />
                {errors.price && <span className="text-[9px] text-rose-400 font-medium">{errors.price}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Base Stock *</label>
                <input type="number" min="0" placeholder="30" value={formStock} onChange={(e) => setFormStock(e.target.value)}
                  disabled={hasVariations}
                  className={`bg-zinc-950 border ${errors.stock ? "border-rose-500/50" : "border-zinc-800"} rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-200 focus:outline-none focus:border-rose-400/50 disabled:opacity-40`} />
                {errors.stock && <span className="text-[9px] text-rose-400 font-medium">{errors.stock}</span>}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900/10 border border-zinc-900/60 mt-1">
              <input type="checkbox" id="toggle-variations" checked={hasVariations}
                onChange={(e) => { setHasVariations(e.target.checked); if (e.target.checked && formVariations.length === 0) addVariationRow(); }}
                className="accent-rose-500 w-4 h-4 cursor-pointer" />
              <label htmlFor="toggle-variations" className="text-xs font-bold text-zinc-300 cursor-pointer">Product has variations</label>
            </div>

            {hasVariations && (
              <div className="flex flex-col gap-2 border-t border-zinc-900 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Variations</span>
                  <button type="button" onClick={addVariationRow} className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /><span>Add option</span>
                  </button>
                </div>
                {errors.variations && <span className="text-[9px] text-rose-400 font-medium">{errors.variations}</span>}
                <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {formVariations.map((vari, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-zinc-900 bg-zinc-900/20 flex flex-col gap-2 relative">
                      <button type="button" onClick={() => removeVariationRow(idx)} className="absolute top-2 right-2 text-zinc-600 hover:text-rose-400 p-0.5 rounded cursor-pointer"><X className="w-3 h-3" /></button>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <label className="text-[8px] uppercase tracking-wide text-zinc-500">Size</label>
                          <input type="text" placeholder="M, L, 250ml" value={vari.size || ""}
                            onChange={(e) => updateVariationRow(idx, "size", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-rose-400/50 font-bold" />
                        </div>
                        <div>
                          <label className="text-[8px] uppercase tracking-wide text-zinc-500">Color</label>
                          <input type="text" placeholder="e.g. Red" value={vari.color || ""}
                            onChange={(e) => updateVariationRow(idx, "color", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-rose-400/50 font-bold" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] uppercase tracking-wide text-zinc-500">Price (GH₵)</label>
                          <input type="number" step="0.01" value={vari.price}
                            onChange={(e) => updateVariationRow(idx, "price", Number(e.target.value))}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-rose-400/50" />
                        </div>
                        <div>
                          <label className="text-[8px] uppercase tracking-wide text-zinc-500">Stock</label>
                          <input type="number" value={vari.stock}
                            onChange={(e) => updateVariationRow(idx, "stock", Number(e.target.value))}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-rose-400/50" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/10">
              <Save className="w-4 h-4" /><span>Save Product Data</span>
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
