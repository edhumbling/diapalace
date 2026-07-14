"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ToastProvider } from "../components/Toasts";
import LoginScreen from "../components/LoginScreen";
import Sidebar from "../components/Sidebar";
import POSModule, { type CartItem } from "../components/POSModule";
import PaymentModal from "../components/PaymentModal";
import ReceiptModal from "../components/ReceiptModal";
import InventoryModule from "../components/InventoryModule";
import CustomersModule from "../components/CustomersModule";
import AnalyticsModule from "../components/AnalyticsModule";
import { db, Product, Customer, Transaction } from "../lib/db";

export default function Home() {
  const [operator, setOperator] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("pos");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [checkoutCart, setCheckoutCart] = useState<CartItem[] | null>(null);
  const [checkoutCustomer, setCheckoutCustomer] = useState<Customer | null>(null);
  const [checkoutDiscount, setCheckoutDiscount] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = localStorage.getItem("dp_theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("dp_theme", theme);
  }, [theme]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const sessionOperator = db.getSession();
    if (sessionOperator) {
      setOperator(sessionOperator);
    }
    setProducts(db.getProducts());
    setCategories(db.getCategories());
    setCustomers(db.getCustomers());
    setTransactions(db.getTransactions());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const handleLoginSuccess = (operatorName: string) => {
    setOperator(operatorName);
    setProducts(db.getProducts());
    setCategories(db.getCategories());
    setCustomers(db.getCustomers());
    setTransactions(db.getTransactions());
  };

  const handleLogout = () => {
    db.setSession(null);
    setOperator(null);
  };

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  const triggerCheckoutFlow = (cartItems: CartItem[], customer: Customer | null, discount?: number) => {
    setCheckoutCart(cartItems);
    setCheckoutCustomer(customer);
    setCheckoutDiscount(discount ?? 0);
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = (
    paymentMethod: "Cash" | "Mobile Money",
    momoNetwork?: "MTN" | "Telecel" | "AT"
  ) => {
    if (!checkoutCart || !operator) return;

    const subtotal = checkoutCart.reduce((acc, item) => {
      const price = item.variation ? item.variation.price : item.product.price;
      return acc + price * item.quantity;
    }, 0);
    const total = subtotal - checkoutDiscount;

    const updatedProducts = products.map((prod) => {
      const checkoutItems = checkoutCart.filter((item) => item.product.id === prod.id);
      if (checkoutItems.length === 0) return prod;

      const newVariations = prod.variations ? [...prod.variations] : [];
      let baseStockDeduction = 0;

      for (const item of checkoutItems) {
        if (item.variationIndex !== undefined && newVariations[item.variationIndex]) {
          newVariations[item.variationIndex] = {
            ...newVariations[item.variationIndex],
            stock: Math.max(0, newVariations[item.variationIndex].stock - item.quantity)
          };
        } else {
          baseStockDeduction += item.quantity;
        }
      }

      const newTotalStock = prod.variations && prod.variations.length > 0
        ? newVariations.reduce((acc, v) => acc + v.stock, 0)
        : Math.max(0, prod.stock - baseStockDeduction);

      return { ...prod, variations: newVariations, stock: newTotalStock };
    });

    setProducts(updatedProducts);
    db.saveProducts(updatedProducts);

    const newTransaction: Transaction = {
      id: `DP-TX-${Date.now().toString().slice(-6)}`,
      customer: checkoutCustomer
        ? { id: checkoutCustomer.id, name: checkoutCustomer.name, phone: checkoutCustomer.phone }
        : undefined,
      items: checkoutCart.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        variation: item.variation
          ? { size: item.variation.size, color: item.variation.color }
          : undefined,
        quantity: item.quantity,
        price: item.variation ? item.variation.price : item.product.price
      })),
      subtotal,
      discount: checkoutDiscount,
      total,
      paymentMethod,
      momoNetwork,
      timestamp: new Date().toISOString(),
      isVoided: false,
      operator
    };

    const updatedTransactions = [newTransaction, ...transactions];
    setTransactions(updatedTransactions);
    db.saveTransactions(updatedTransactions);

    setShowPaymentModal(false);
    setCheckoutCart(null);
    setCheckoutCustomer(null);
    setCheckoutDiscount(0);
    setActiveReceipt(newTransaction);
  };

  const handleVoidTransaction = useCallback((txId: string) => {
    const targetTx = transactions.find((tx) => tx.id === txId);
    if (!targetTx) return;

    setTransactions((prev) => {
      const updated = prev.map((tx) => tx.id === txId ? { ...tx, isVoided: true } : tx);
      db.saveTransactions(updated);
      return updated;
    });

    const voidUpdatedProducts = products.map((prod) => {
      const txItems = targetTx.items.filter((i) => i.productId === prod.id);
      if (txItems.length === 0) return prod;
      const newVariations = prod.variations ? [...prod.variations] : [];
      let baseStockIncrement = 0;
      for (const txItem of txItems) {
        if (txItem.variation && prod.variations) {
          const idx = prod.variations.findIndex((v) => v.size === txItem.variation?.size && v.color === txItem.variation?.color);
          if (idx !== -1) { newVariations[idx] = { ...newVariations[idx], stock: newVariations[idx].stock + txItem.quantity }; }
        } else { baseStockIncrement += txItem.quantity; }
      }
      const newTotalStock = prod.variations && prod.variations.length > 0
        ? newVariations.reduce((a, v) => a + v.stock, 0) : prod.stock + baseStockIncrement;
      return { ...prod, variations: newVariations, stock: newTotalStock };
    });

    setProducts(voidUpdatedProducts);
    db.saveProducts(voidUpdatedProducts);
  }, [transactions, products]);

  const handleRefundTransaction = useCallback((txId: string) => {
    const targetTx = transactions.find((tx) => tx.id === txId);
    if (!targetTx || targetTx.isVoided) return;
    const refundTx: Transaction = {
      ...targetTx, id: `DP-RF-${Date.now().toString().slice(-6)}`,
      total: -Math.abs(targetTx.total), timestamp: new Date().toISOString(), isVoided: false,
    };
    setTransactions((prev) => { const updated = [refundTx, ...prev]; db.saveTransactions(updated); return updated; });

    const refundUpdatedProducts = products.map((prod) => {
      const txItems = targetTx.items.filter((i) => i.productId === prod.id);
      if (txItems.length === 0) return prod;
      const newVariations = prod.variations ? [...prod.variations] : [];
      let baseStockIncrement = 0;
      for (const txItem of txItems) {
        if (txItem.variation && prod.variations) {
          const idx = prod.variations.findIndex((v) => v.size === txItem.variation?.size && v.color === txItem.variation?.color);
          if (idx !== -1) { newVariations[idx] = { ...newVariations[idx], stock: newVariations[idx].stock + txItem.quantity }; }
        } else { baseStockIncrement += txItem.quantity; }
      }
      const newTotalStock = prod.variations && prod.variations.length > 0
        ? newVariations.reduce((a, v) => a + v.stock, 0) : prod.stock + baseStockIncrement;
      return { ...prod, variations: newVariations, stock: newTotalStock };
    });

    setProducts(refundUpdatedProducts);
    db.saveProducts(refundUpdatedProducts);
  }, [transactions, products]);

  const handleProductsChange = (newProds: Product[]) => {
    setProducts(newProds);
  };

  const handleCategoriesChange = (newCats: string[]) => {
    setCategories(newCats);
  };

  const handleCustomersChange = (newCusts: Customer[]) => {
    setCustomers(newCusts);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") { setActiveTab("pos"); e.preventDefault(); }
      if (e.key === "2") { setActiveTab("inventory"); e.preventDefault(); }
      if (e.key === "3") { setActiveTab("customers"); e.preventDefault(); }
      if (e.key === "4") { setActiveTab("analytics"); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const renderActiveModule = () => {
    switch (activeTab) {
      case "pos":
        return (
          <POSModule
            products={products}
            categories={categories}
            customers={customers}
            onCheckout={triggerCheckoutFlow}
          />
        );
      case "inventory":
        return (
          <InventoryModule
            products={products}
            categories={categories}
            onProductsChange={handleProductsChange}
            onCategoriesChange={handleCategoriesChange}
          />
        );
      case "customers":
        return (
          <CustomersModule
            customers={customers}
            transactions={transactions}
            onCustomersChange={handleCustomersChange}
            onViewReceipt={setActiveReceipt}
          />
        );
      case "analytics":
        return (
          <AnalyticsModule
            transactions={transactions}
            onVoidTransaction={handleVoidTransaction}
            onRefundTransaction={handleRefundTransaction}
            onViewReceipt={setActiveReceipt}
          />
        );
      default:
        return (
          <POSModule
            products={products}
            categories={categories}
            customers={customers}
            onCheckout={triggerCheckoutFlow}
          />
        );
    }
  };

  const getModuleTitle = () => {
    switch (activeTab) {
      case "pos": return "Sales Register";
      case "inventory": return "Product & Stock Inventory";
      case "customers": return "Customer directory";
      case "analytics": return "Sales Analytics & Reports";
      default: return "Operations Workspace";
    }
  };

  if (!operator) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const completedTransactions = transactions.filter((tx) => !tx.isVoided && tx.total >= 0);
  const salesTotal = completedTransactions.reduce((acc, tx) => acc + tx.total, 0);
  const inventoryValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock < 10).length;

  const moduleDescriptions: Record<string, string> = {
    pos: "Fast retail checkout with live stock protection and customer-linked receipts.",
    inventory: "Catalog control, stock counts, category setup, and variation pricing.",
    customers: "Client profiles, notes, phone lookup, and purchase history.",
    analytics: "Revenue pulse, payment mix, receipt history, and void control."
  };

  return (
    <ToastProvider>
      <div className="retail-texture flex min-h-screen bg-background text-foreground flex-col md:flex-row relative overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <div className="relative z-10 flex-1 flex flex-col min-w-0 pb-24 md:pb-0">
          <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-4 py-3 md:px-8 md:py-5">
            <div className="flex flex-col gap-3 md:gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-300">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Operations
                </div>
                <h2 className="mt-1 text-[1.65rem] font-black leading-tight tracking-tight text-zinc-200 md:text-3xl">
                  {getModuleTitle()}
                </h2>
                <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-zinc-500 md:text-sm">
                  {moduleDescriptions[activeTab]} Press <kbd className="px-1 py-0.5 rounded border border-zinc-800 text-[9px] font-mono">1</kbd>-<kbd className="px-1 py-0.5 rounded border border-zinc-800 text-[9px] font-mono">4</kbd> to switch tabs.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2 xl:w-[620px]">
                {[
                  { label: "Sales", value: `GH₵ ${salesTotal.toFixed(0)}` },
                  { label: "Receipts", value: completedTransactions.length.toString() },
                  { label: "Catalog", value: products.length.toString() },
                  { label: "Low stock", value: lowStockCount.toString() }
                ].map((metric) => (
                  <div key={metric.label} className="metric-card rounded-2xl px-2.5 py-2 md:px-4 md:py-3">
                    <div className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500 md:text-[9px] md:tracking-[0.18em]">
                      {metric.label}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs font-black text-zinc-200 md:text-base">
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:max-h-[calc(100vh-154px)] md:p-8">
            <div className="mb-4 hidden items-center justify-between rounded-2xl border border-zinc-900 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-500 md:flex">
              <div className="font-medium">
                Inventory value:{" "}
                <span className="font-mono font-black text-zinc-200">GH₵ {inventoryValue.toFixed(2)}</span>
              </div>
              <div className="font-mono">
                {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </div>
            </div>
            <div key={activeTab} className="animate-fade-in-blur flex min-h-0 flex-1 flex-col">
              {renderActiveModule()}
            </div>
          </main>
        </div>

        {showPaymentModal && (
          <PaymentModal
            totalBill={checkoutCart
              ? checkoutCart.reduce((acc, item) => {
                  const price = item.variation ? item.variation.price : item.product.price;
                  return acc + price * item.quantity;
                }, 0) - checkoutDiscount
              : 0}
            subtotal={checkoutCart
              ? checkoutCart.reduce((acc, item) => {
                  const price = item.variation ? item.variation.price : item.product.price;
                  return acc + price * item.quantity;
                }, 0)
              : 0}
            discount={checkoutDiscount}
            linkedCustomer={checkoutCustomer}
            onClose={() => {
              setShowPaymentModal(false);
              setCheckoutCart(null);
              setCheckoutCustomer(null);
              setCheckoutDiscount(0);
            }}
            onComplete={handlePaymentComplete}
          />
        )}

        {activeReceipt && (
          <ReceiptModal
            transaction={activeReceipt}
            onClose={() => setActiveReceipt(null)}
          />
        )}
      </div>
    </ToastProvider>
  );
}
