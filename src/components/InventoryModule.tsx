"use client";

import React, { useState } from "react";
import { Plus, Edit2, Trash2, Tag, Save, X, RefreshCw, Layers } from "lucide-react";
import { Product, ProductVariation, db } from "../lib/db";

interface InventoryModuleProps {
  products: Product[];
  categories: string[];
  onProductsChange: (newProducts: Product[]) => void;
  onCategoriesChange: (newCategories: string[]) => void;
}

export default function InventoryModule({
  products,
  categories,
  onProductsChange,
  onCategoriesChange
}: InventoryModuleProps) {
  // Active edit state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form states
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState(categories[0] || "");
  const [formDesc, setFormDesc] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [hasVariations, setHasVariations] = useState(false);
  const [formVariations, setFormVariations] = useState<ProductVariation[]>([]);

  // Category management state
  const [newCategoryName, setNewCategoryName] = useState("");

  // Start adding a new product
  const startAddNew = () => {
    setIsAddingNew(true);
    setEditingProduct(null);
    setFormName("");
    setFormCategory(categories[0] || "");
    setFormDesc("");
    setFormPrice("");
    setFormStock("");
    setHasVariations(false);
    setFormVariations([]);
  };

  // Start editing product
  const startEdit = (prod: Product) => {
    setEditingProduct(prod);
    setIsAddingNew(false);
    setFormName(prod.name);
    setFormCategory(prod.category);
    setFormDesc(prod.description);
    setFormPrice(prod.price.toString());
    setFormStock(prod.stock.toString());
    setHasVariations(prod.variations && prod.variations.length > 0);
    setFormVariations(prod.variations ? [...prod.variations] : []);
  };

  // Add variation row helper
  const addVariationRow = () => {
    setFormVariations((prev) => [
      ...prev,
      { size: "", color: "", price: Number(formPrice) || 0, stock: 0 }
    ]);
  };

  // Update variation row helper
  const updateVariationRow = (index: number, key: keyof ProductVariation, val: any) => {
    setFormVariations((prev) =>
      prev.map((vari, idx) => {
        if (idx === index) {
          return { ...vari, [key]: val };
        }
        return vari;
      })
    );
  };

  // Remove variation row helper
  const removeVariationRow = (index: number) => {
    setFormVariations((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit handler
  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName || !formCategory || !formPrice || !formStock) {
      alert("Please fill in all required fields.");
      return;
    }

    const price = Number(formPrice);
    const stock = Number(formStock);

    if (isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
      alert("Price and stock must be valid non-negative numbers.");
      return;
    }

    let finalVariations: ProductVariation[] = [];
    if (hasVariations) {
      if (formVariations.length === 0) {
        alert("Please configure at least one variation if variations are enabled.");
        return;
      }
      for (const v of formVariations) {
        if (!v.size && !v.color) {
          alert("Each variation must have a size or color specified.");
          return;
        }
        if (v.price < 0 || v.stock < 0) {
          alert("Variation price and stock must be positive numbers.");
          return;
        }
      }
      finalVariations = formVariations;
    }

    const productData: Product = {
      id: editingProduct ? editingProduct.id : `p-${Date.now()}`,
      name: formName,
      category: formCategory,
      description: formDesc,
      price,
      stock: hasVariations ? finalVariations.reduce((acc, v) => acc + v.stock, 0) : stock,
      variations: finalVariations,
      image: "/logo.png"
    };

    let updatedProducts: Product[];
    if (editingProduct) {
      updatedProducts = products.map((p) => (p.id === editingProduct.id ? productData : p));
    } else {
      updatedProducts = [...products, productData];
    }

    onProductsChange(updatedProducts);
    db.saveProducts(updatedProducts);
    
    // Reset states
    setIsAddingNew(false);
    setEditingProduct(null);
  };

  // Delete product
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      const updated = products.filter((p) => p.id !== id);
      onProductsChange(updated);
      db.saveProducts(updated);
      if (editingProduct?.id === id) {
        setEditingProduct(null);
      }
    }
  };

  // Category addition
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    if (categories.some((c) => c.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      alert("Category already exists.");
      return;
    }

    const updated = [...categories, newCategoryName.trim()];
    onCategoriesChange(updated);
    db.saveCategories(updated);
    setNewCategoryName("");
    setFormCategory(newCategoryName.trim());
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row gap-6 relative">
      
      {/* Left Pane: Product Catalog Table (xl:col-span-8) */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Header & Add Button */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/40 p-4 border border-zinc-900 rounded-2xl">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Administrative Catalog
              </h3>
              <p className="text-[10px] text-zinc-500">Manage products, stock values, and variations</p>
            </div>
          </div>
          <button
            onClick={startAddNew}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Item</span>
          </button>
        </div>

        {/* Categories editor bar */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border-zinc-900">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
              Active categories
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {categories.map((c) => (
                <span
                  key={c}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-900 text-[10px] text-zinc-400 font-semibold"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
          <form onSubmit={handleAddCategory} className="flex gap-2 w-full sm:w-auto items-end">
            <div className="flex flex-col gap-1 w-full sm:w-44">
              <label className="text-[8px] uppercase font-bold tracking-wider text-zinc-500">
                New Category
              </label>
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

        {/* Product Catalog list table */}
        <div className="glass-panel rounded-2xl border-zinc-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 text-[9px] font-bold uppercase tracking-wider">
                <th className="py-4 px-5">Item Details</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4">Base Price</th>
                <th className="py-4 px-4">Total Stock</th>
                <th className="py-4 px-4 text-center">Variations</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/55 text-xs">
              {products.length > 0 ? (
                products.map((p) => {
                  const hasVari = p.variations && p.variations.length > 0;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-zinc-900/10 transition-colors ${
                        editingProduct?.id === p.id ? "bg-rose-500/[0.02]" : ""
                      }`}
                    >
                      <td className="py-3.5 px-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-center flex-shrink-0">
                          <Tag className="w-4 h-4 text-zinc-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-200 truncate">{p.name}</div>
                          <div className="text-[10px] text-zinc-500 line-clamp-1">{p.description}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-400">{p.category}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-300">
                        GH₵ {p.price.toFixed(2)}
                      </td>
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
                          <button
                            onClick={() => startEdit(p)}
                            className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-lg border border-zinc-800 hover:border-rose-900/60 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-600 font-medium">
                    No products currently in catalog
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Pane: Add/Edit Panel (xl:col-span-4) */}
      {(isAddingNew || editingProduct) && (
        <div className="w-full xl:w-96 flex flex-col border border-zinc-900 bg-zinc-950/80 rounded-2xl overflow-hidden flex-shrink-0 animate-slide-in-right">
          
          {/* Header */}
          <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              {editingProduct ? "Modify Product details" : "Add Catalog Item"}
            </h3>
            <button
              onClick={() => {
                setIsAddingNew(false);
                setEditingProduct(null);
              }}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto max-h-[calc(100vh-270px)] p-4 flex flex-col gap-4">
            
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                Product Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Shea Butter Skin Pomade"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-rose-400/50"
                required
              />
            </div>

            {/* Category selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                Category *
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-rose-400/50"
                required
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                Description (Optional)
              </label>
              <textarea
                placeholder="Product properties or variation notes..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-rose-400/50 resize-none"
              />
            </div>

            {/* Base Pricing and Stock */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                  Base Price (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="60.00"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  disabled={hasVariations}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-200 focus:outline-none focus:border-rose-400/50 disabled:opacity-40"
                  required={!hasVariations}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                  Base Stock Count *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="30"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  disabled={hasVariations}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-200 focus:outline-none focus:border-rose-400/50 disabled:opacity-40"
                  required={!hasVariations}
                />
              </div>
            </div>

            {/* Has Variations Toggle */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900/10 border border-zinc-900/60 mt-1">
              <input
                type="checkbox"
                id="toggle-variations"
                checked={hasVariations}
                onChange={(e) => {
                  setHasVariations(e.target.checked);
                  if (e.target.checked && formVariations.length === 0) {
                    addVariationRow();
                  }
                }}
                className="accent-rose-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="toggle-variations" className="text-xs font-bold text-zinc-300 cursor-pointer">
                Product has variations (Sizes/Colors)
              </label>
            </div>

            {/* Variations Builder */}
            {hasVariations && (
              <div className="flex flex-col gap-2 border-t border-zinc-900 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                    Product Variations
                  </span>
                  <button
                    type="button"
                    onClick={addVariationRow}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add option</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {formVariations.map((vari, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-zinc-900 bg-zinc-900/20 flex flex-col gap-2 relative"
                    >
                      <button
                        type="button"
                        onClick={() => removeVariationRow(idx)}
                        className="absolute top-2 right-2 text-zinc-600 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Spec details */}
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <label className="text-[8px] uppercase tracking-wide text-zinc-500">Size</label>
                          <input
                            type="text"
                            placeholder="M, L, 250ml"
                            value={vari.size || ""}
                            onChange={(e) => updateVariationRow(idx, "size", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-rose-400/50 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] uppercase tracking-wide text-zinc-500">Color</label>
                          <input
                            type="text"
                            placeholder="e.g. Red"
                            value={vari.color || ""}
                            onChange={(e) => updateVariationRow(idx, "color", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-rose-400/50 font-bold"
                          />
                        </div>
                      </div>

                      {/* Pricing / Stock */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[8px] uppercase tracking-wide text-zinc-500">Price (GH₵)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={vari.price}
                            onChange={(e) => updateVariationRow(idx, "price", Number(e.target.value))}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-rose-400/50"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] uppercase tracking-wide text-zinc-500">Stock Count</label>
                          <input
                            type="number"
                            value={vari.stock}
                            onChange={(e) => updateVariationRow(idx, "stock", Number(e.target.value))}
                            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg px-2.5 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-rose-400/50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Button */}
            <button
              type="submit"
              className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
            >
              <Save className="w-4 h-4" />
              <span>Save Product Data</span>
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
