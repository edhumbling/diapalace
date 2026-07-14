"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard } from "lucide-react";
import { Product, ProductVariation, Customer } from "../lib/db";
import { useToast } from "./Toasts";
import { useDebounce } from "../hooks/useDebounce";

interface POSModuleProps {
  products: Product[];
  categories: string[];
  customers: Customer[];
  onCheckout: (cartItems: CartItem[], linkedCustomer: Customer | null, discount?: number) => void;
}

export interface CartItem {
  id: string;
  product: Product;
  variationIndex?: number;
  variation?: ProductVariation;
  quantity: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Pomades: "from-amber-400 to-orange-500",
  Skincare: "from-emerald-400 to-teal-500",
  Clothing: "from-violet-400 to-purple-500",
};

function getProductGradient(category: string): string {
  return CATEGORY_COLORS[category] || "from-blue-400 to-indigo-500";
}

export default function POSModule({
  products,
  categories,
  customers,
  onCheckout
}: POSModuleProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [activeVariationProduct, setActiveVariationProduct] = useState<Product | null>(null);
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");
  const [discount, setDiscount] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === "All" || prod.category === selectedCategory;
    const matchesSearch = prod.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                          prod.category.toLowerCase().includes(debouncedSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const subtotal = cart.reduce((acc, item) => {
    const price = item.variation ? item.variation.price : item.product.price;
    return acc + price * item.quantity;
  }, 0);

  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = subtotal - discountValue;

  const handleProductClick = (product: Product) => {
    if (product.variations && product.variations.length > 0) {
      setActiveVariationProduct(product);
    } else {
      addToCart(product);
    }
  };

  const addToCart = (product: Product, variationIndex?: number) => {
    const variation = variationIndex !== undefined ? product.variations[variationIndex] : undefined;
    const cartItemId = variationIndex !== undefined ? `${product.id}-${variationIndex}` : product.id;
    const maxStock = variation ? variation.stock : product.stock;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === cartItemId);
      if (existing) {
        if (existing.quantity >= maxStock) {
          toast(`Only ${maxStock} left in stock.`, "warning");
          return prevCart;
        }
        return prevCart.map((item) =>
          item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { id: cartItemId, product, variationIndex, variation, quantity: 1 }];
    });

    setActiveVariationProduct(null);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + delta;
            const maxStock = item.variation ? item.variation.stock : item.product.stock;
            if (newQty <= 0) return null;
            if (newQty > maxStock) {
              toast(`Cannot exceed available stock of ${maxStock}.`, "warning");
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeCartItem = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
    toast("Item removed from cart.", "info");
  };

  const clearCart = () => {
    setCart([]);
    setDiscount("");
    toast("Cart cleared.", "info");
  };

  const handleCheckoutSubmit = () => {
    if (cart.length === 0) {
      toast("Your cart is empty. Please add products to check out.", "warning");
      return;
    }
    onCheckout(cart, selectedCustomer, discountValue);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 relative">
      <div className="flex lg:hidden bg-zinc-900/40 p-1 rounded-2xl border border-zinc-900 w-full mb-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileTab("catalog")}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
            mobileTab === "catalog"
              ? "bg-rose-500/10 border border-rose-500/20 text-rose-300 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >Catalog</button>
        <button
          type="button"
          onClick={() => setMobileTab("cart")}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all relative cursor-pointer ${
            mobileTab === "cart"
              ? "bg-rose-500/10 border border-rose-500/20 text-rose-300 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <span>Cart</span>
          {cart.length > 0 && (
            <span className="absolute top-1/2 -translate-y-1/2 right-4 bg-rose-500 text-white text-[9px] font-black rounded-full w-4.5 h-4.5 flex items-center justify-center animate-pulse shadow-md shadow-rose-500/30">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        <div className={`flex-1 flex flex-col gap-5 ${mobileTab !== "catalog" ? "hidden lg:flex" : "flex"}`}>
          <div className="premium-panel flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-2xl">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                ref={searchRef}
                type="text"
                placeholder='Search products... (Press "/" to focus)'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full">
              {["All", ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black border transition-all shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-sm"
                      : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800"
                  }`}
                >{cat}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto md:max-h-[calc(100vh-330px)] pr-1 md:pr-2 pb-28 md:pb-0">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((prod) => {
                const outOfStock = prod.stock <= 0;
                return (
                  <div
                    key={prod.id}
                    onClick={() => !outOfStock && handleProductClick(prod)}
                    className={`premium-panel p-3 rounded-xl flex flex-col justify-between border cursor-pointer hover:border-rose-400/40 transition-all duration-200 group ${
                      outOfStock ? "opacity-50 cursor-not-allowed border-zinc-900" : "border-zinc-900 bg-zinc-900/10 interactive-click"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getProductGradient(prod.category)} shadow-sm`}>
                        <span className="text-sm font-black text-white drop-shadow-sm">
                          {prod.category.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            {prod.category}
                          </span>
                          {prod.variations && prod.variations.length > 0 && (
                            <span className="rounded-md border border-zinc-900 bg-zinc-950 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">Variants</span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-zinc-200 line-clamp-2 group-hover:text-rose-300 transition-colors">
                          {prod.name}
                        </h3>
                        <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                          {prod.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-zinc-900/60">
                      <span className="text-sm font-semibold text-rose-300 font-mono whitespace-nowrap">
                        GH₵ {prod.price.toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase text-right ${prod.stock < 10 ? "text-amber-400" : "text-zinc-500"}`}>
                        {outOfStock ? "Out of Stock" : `${prod.stock} left`}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-20 text-center text-zinc-500 text-sm premium-panel rounded-2xl">
                No products found for &quot;{selectedCategory}&quot;
              </div>
            )}
          </div>
        </div>

        <div className={`w-full lg:w-[22rem] xl:w-[23rem] flex flex-col border border-zinc-900 bg-zinc-950/80 rounded-3xl overflow-hidden flex-shrink-0 shadow-xl ${mobileTab !== "cart" ? "hidden lg:flex" : "flex"}`}>
          <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-200">
                Cart ({cart.reduce((a, b) => a + b.quantity, 0)})
              </h3>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors cursor-pointer" title="Clear all">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-4 border-b border-zinc-900 bg-zinc-950/20 flex flex-col gap-2">
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Link Customer Profile</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-3 py-2.5 text-xs font-semibold text-zinc-300 focus:outline-none"
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px] p-4 flex flex-col gap-3">
            {cart.length > 0 ? (
              cart.map((item) => {
                const itemPrice = item.variation ? item.variation.price : item.product.price;
                const displayVariation = item.variation
                  ? `${item.variation.size || ""}${item.variation.size && item.variation.color ? " / " : ""}${item.variation.color || ""}`
                  : "";
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/20 border border-zinc-900/60">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${getProductGradient(item.product.category)} flex items-center justify-center shrink-0`}>
                          <span className="text-[6px] font-black text-white">{item.product.category.substring(0, 1)}</span>
                        </div>
                        <h4 className="text-xs font-black text-zinc-200 truncate">{item.product.name}</h4>
                      </div>
                      {displayVariation && <span className="text-[9px] text-rose-300 font-semibold uppercase">{displayVariation}</span>}
                      <div className="text-[10px] text-zinc-500 font-mono mt-1">GH₵ {itemPrice.toFixed(2)} ea</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold text-zinc-200 w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeCartItem(item.id)} className="text-zinc-600 hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer ml-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600 py-16">
                <ShoppingCart className="w-8 h-8 text-zinc-800 mb-2" />
                <p className="text-xs font-medium">Cart is empty</p>
                <p className="text-[9px] text-zinc-700 mt-1">Tap a product to add</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">Discount (GH₵)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.00"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-200 focus:outline-none focus:border-rose-400/50"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5 text-xs pt-4">
                <div className="flex items-center justify-between text-zinc-500 font-medium">
                  <span>Subtotal</span>
                  <span className="font-mono">GH₵ {subtotal.toFixed(2)}</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex items-center justify-between text-emerald-400 font-medium">
                    <span>Discount</span>
                    <span className="font-mono">-GH₵ {discountValue.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-zinc-200 font-bold border-t border-zinc-900/60 pt-2 text-sm mt-1">
                  <span>Total</span>
                  <span className="font-mono text-rose-300">GH₵ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckoutSubmit}
              disabled={cart.length === 0}
              className="primary-action w-full py-4 rounded-xl text-xs font-semibold uppercase tracking-[0.14em] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proceed to Payment</span>
            </button>
          </div>
        </div>
      </div>

      {activeVariationProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveVariationProduct(null)}>
          <div className="glass-panel w-full max-w-md rounded-2xl border border-zinc-800 p-6 flex flex-col gap-6 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-zinc-900 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Select Variation</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">{activeVariationProduct.name}</p>
              </div>
              <button onClick={() => setActiveVariationProduct(null)} className="text-zinc-400 hover:text-zinc-200 text-xs font-bold">Cancel</button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Available Variations</span>
              <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto">
                {activeVariationProduct.variations.map((vari, idx) => {
                  const outOfStock = vari.stock <= 0;
                  const displaySpecs = `${vari.size || ""}${vari.size && vari.color ? " / " : ""}${vari.color || ""}`;
                  return (
                    <button
                      key={idx}
                      onClick={() => !outOfStock && addToCart(activeVariationProduct, idx)}
                      disabled={outOfStock}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                        outOfStock
                          ? "opacity-40 border-zinc-900 bg-zinc-950 cursor-not-allowed"
                          : "border-zinc-800 bg-zinc-900/20 hover:border-rose-400/40 hover:bg-zinc-900/60 cursor-pointer"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-zinc-200 uppercase">{displaySpecs}</span>
                        <span className="text-[10px] text-zinc-500">{outOfStock ? "Out of Stock" : `${vari.stock} in stock`}</span>
                      </div>
                      <span className="text-xs font-bold text-rose-300 font-mono">GH₵ {vari.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
