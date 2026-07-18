"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { GlassTile, Icon, toneForCategory } from "./glass/icons";
import { Product, ProductVariation, Customer } from "../lib/db";
import { useToast } from "./Toasts";
import { useDebounce } from "../hooks/useDebounce";
import { useFocusTrap } from "../hooks/useFocusTrap";

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
  const variationTrapRef = useFocusTrap(!!activeVariationProduct);

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
  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);

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
    <div className="relative flex flex-1 flex-col gap-4">
      {/* Mobile segmented control */}
      <div className="g-panel flex w-full rounded-2xl p-1 lg:hidden">
        {(["catalog", "cart"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`relative flex-1 rounded-xl py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-all ${
              mobileTab === tab ? "bg-white/[0.1] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" : "text-faint"
            }`}
          >
            {tab === "catalog" ? "Catalog" : "Cart"}
            {tab === "cart" && cartCount > 0 && (
              <span className="pill-ice ml-2 inline-grid h-4 min-w-4 place-items-center rounded-full border px-1 text-[9px]">
                {cartCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-5 lg:flex-row">
        {/* ------- Catalog ------- */}
        <div className={`flex-1 flex-col gap-4 ${mobileTab !== "catalog" ? "hidden lg:flex" : "flex"}`}>
          <div className="g-panel flex flex-col items-stretch justify-between gap-3 rounded-3xl p-3.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
                <Icon name="search" size={15} />
              </span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl py-2.5 pl-10 pr-10 text-[13px] font-semibold"
              />
              <span className="kbd absolute right-3 top-1/2 -translate-y-1/2">/</span>
            </div>
            <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto">
              {["All", ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 rounded-xl border px-3.5 py-2 text-[11px] font-extrabold transition-all ${
                    selectedCategory === cat
                      ? "border-ice/40 bg-ice/10 text-ice shadow-[0_0_18px_-4px_rgba(103,232,249,0.5)]"
                      : "border-white/[0.07] bg-white/[0.03] text-dim hover:border-white/[0.14] hover:text-ink"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 pr-0 sm:grid-cols-2 lg:max-h-[calc(100vh-270px)] lg:overflow-y-auto lg:pr-1.5 xl:grid-cols-3">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((prod, i) => {
                const outOfStock = prod.stock <= 0;
                return (
                  <button
                    key={prod.id}
                    onClick={() => !outOfStock && handleProductClick(prod)}
                    disabled={outOfStock}
                    className={`g-panel sheen group flex flex-col justify-between rounded-3xl p-4 text-left transition-all duration-200 ${
                      outOfStock
                        ? "cursor-not-allowed opacity-40 saturate-50"
                        : "hover:-translate-y-0.5 hover:border-white/[0.2] hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.9)] active:scale-[0.99]"
                    }`}
                    style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <GlassTile tone={toneForCategory(prod.category)} size={46}>
                        <span>{prod.category.substring(0, 2).toUpperCase()}</span>
                      </GlassTile>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-faint">
                            {prod.category}
                          </span>
                          {prod.variations && prod.variations.length > 0 && (
                            <span className="pill pill-plain !py-0.5 !px-1.5 !text-[8px]">Variants</span>
                          )}
                        </div>
                        <h3 className="text-[13px] font-bold leading-snug text-ink transition-colors group-hover:text-ice">
                          {prod.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-faint">
                          {prod.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                      <span className="num text-[13px] font-bold text-ice">
                        GH₵ {prod.price.toFixed(2)}
                      </span>
                      <span className={`pill ${outOfStock ? "pill-coral" : prod.stock < 10 ? "pill-honey" : "pill-plain"}`}>
                        {outOfStock ? "Out of stock" : `${prod.stock} left`}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="g-panel col-span-full rounded-3xl py-16 text-center text-sm text-faint">
                No products found for &quot;{selectedCategory}&quot;
              </div>
            )}
          </div>
        </div>

        {/* ------- Cart ------- */}
        <div className={`w-full flex-col overflow-hidden rounded-[28px] lg:flex lg:w-[21.5rem] xl:w-[23rem] lg:shrink-0 g-panel ${mobileTab !== "cart" ? "hidden lg:flex" : "flex"}`}>
          <div className="flex items-center justify-between border-b border-white/[0.07] p-4">
            <div className="flex items-center gap-2.5">
              <GlassTile name="cart" tone="cyan" size={30} />
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink">
                Cart <span className="num text-ice">({cartCount})</span>
              </h3>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="btn-ico h-8 w-8 hover:!text-coral" title="Clear cart">
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-b border-white/[0.07] p-4">
            <label className="lbl">Link customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-xs font-semibold"
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div className="flex max-h-[380px] flex-1 flex-col gap-2 overflow-y-auto p-4 lg:max-h-none">
            {cart.length > 0 ? (
              cart.map((item) => {
                const itemPrice = item.variation ? item.variation.price : item.product.price;
                const displayVariation = item.variation
                  ? `${item.variation.size || ""}${item.variation.size && item.variation.color ? " / " : ""}${item.variation.color || ""}`
                  : "";
                return (
                  <div key={item.id} className="g-deep flex items-center justify-between gap-2 rounded-2xl p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <GlassTile tone={toneForCategory(item.product.category)} size={22}>
                          <span className="!text-[7px]">{item.product.category.substring(0, 1)}</span>
                        </GlassTile>
                        <h4 className="truncate text-xs font-bold text-ink">{item.product.name}</h4>
                      </div>
                      {displayVariation && (
                        <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-lilac">
                          {displayVariation}
                        </span>
                      )}
                      <div className="num mt-1 text-[10px] text-faint">GH₵ {itemPrice.toFixed(2)} ea</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQuantity(item.id, -1)} className="btn-ico h-7 w-7 !rounded-lg">
                        <Icon name="minus" size={12} />
                      </button>
                      <span className="num w-5 text-center text-xs font-bold text-ink">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="btn-ico h-7 w-7 !rounded-lg">
                        <Icon name="plus" size={12} />
                      </button>
                      <button onClick={() => removeCartItem(item.id)} className="btn-ico ml-1 h-7 w-8 !rounded-lg hover:!text-coral">
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-14 text-center">
                <GlassTile name="cart" tone="slate" size={52} className="glass-tile-clear opacity-50" />
                <p className="mt-4 text-xs font-bold text-dim">Cart is empty</p>
                <p className="mt-1 text-[10px] text-faint">Tap a product to add it</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3.5 border-t border-white/[0.07] p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="lbl">Discount (GH₵)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0.00"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="num w-full rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div className="flex flex-[1.3] flex-col gap-1 text-xs">
                <div className="flex items-center justify-between text-dim">
                  <span>Subtotal</span>
                  <span className="num">GH₵ {subtotal.toFixed(2)}</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex items-center justify-between text-mint">
                    <span>Discount</span>
                    <span className="num">−GH₵ {discountValue.toFixed(2)}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between border-t border-white/[0.08] pt-1.5 text-[13px] font-bold text-ink">
                  <span>Total</span>
                  <span className="num text-ice">GH₵ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckoutSubmit}
              disabled={cart.length === 0}
              className="btn-aurora flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
            >
              <Icon name="card" size={15} strokeWidth={2} />
              <span>Proceed to Payment</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------- Variation picker ------- */}
      {activeVariationProduct && (
        <div className="g-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setActiveVariationProduct(null)}>
          <div
            ref={variationTrapRef}
            className="g-panel-2 pop flex w-full max-w-md flex-col gap-5 rounded-[28px] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <GlassTile tone={toneForCategory(activeVariationProduct.category)} size={38}>
                  <span className="!text-[10px]">{activeVariationProduct.category.substring(0, 2).toUpperCase()}</span>
                </GlassTile>
                <div>
                  <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-ink">Select variation</h3>
                  <p className="mt-0.5 text-[10px] text-faint">{activeVariationProduct.name}</p>
                </div>
              </div>
              <button onClick={() => setActiveVariationProduct(null)} className="btn-ico h-8 w-8">
                <Icon name="x" size={14} />
              </button>
            </div>

            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {activeVariationProduct.variations.map((vari, idx) => {
                const outOfStock = vari.stock <= 0;
                const displaySpecs = `${vari.size || ""}${vari.size && vari.color ? " / " : ""}${vari.color || ""}`;
                return (
                  <button
                    key={idx}
                    onClick={() => !outOfStock && addToCart(activeVariationProduct, idx)}
                    disabled={outOfStock}
                    className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                      outOfStock
                        ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] opacity-40"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-ice/40 hover:bg-ice/[0.06]"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold uppercase text-ink">{displaySpecs}</span>
                      <span className="text-[10px] text-faint">{outOfStock ? "Out of stock" : `${vari.stock} in stock`}</span>
                    </div>
                    <span className="num text-xs font-bold text-ice">GH₵ {vari.price.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
