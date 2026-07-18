"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ToastProvider } from "../components/Toasts";
import NeuralField from "../components/glass/NeuralField";
import LoginScreen from "../components/LoginScreen";
import Sidebar from "../components/Sidebar";
import POSModule, { type CartItem } from "../components/POSModule";
import PaymentModal from "../components/PaymentModal";
import ReceiptModal from "../components/ReceiptModal";
import InventoryModule from "../components/InventoryModule";
import CustomersModule from "../components/CustomersModule";
import AnalyticsModule from "../components/AnalyticsModule";
import { db, Product, Customer, Transaction } from "../lib/db";

const MODULE_META: Record<string, { title: string; blurb: string; accent: string }> = {
  pos: {
    title: "Sales Register",
    blurb: "Fast retail checkout with live stock protection and customer-linked receipts.",
    accent: "var(--ice)",
  },
  inventory: {
    title: "Inventory",
    blurb: "Catalog control, stock counts, category setup, and variation pricing.",
    accent: "var(--lilac)",
  },
  customers: {
    title: "Customers",
    blurb: "Client profiles, notes, phone lookup, and purchase history.",
    accent: "var(--coral)",
  },
  analytics: {
    title: "Reports",
    blurb: "Revenue pulse, payment mix, receipt history, and void control.",
    accent: "var(--mint)",
  },
};

export default function Home() {
  const [operator, setOperator] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("pos");

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
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
      case "inventory":
        return (
          <InventoryModule
            products={products}
            categories={categories}
            onProductsChange={setProducts}
            onCategoriesChange={setCategories}
          />
        );
      case "customers":
        return (
          <CustomersModule
            customers={customers}
            transactions={transactions}
            onCustomersChange={setCustomers}
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

  if (!operator) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const meta = MODULE_META[activeTab] ?? MODULE_META.pos;

  const completedTransactions = transactions.filter((tx) => !tx.isVoided && tx.total >= 0);
  const salesTotal = completedTransactions.reduce((acc, tx) => acc + tx.total, 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock < 10).length;

  const metrics = [
    { label: "Sales", value: `GH₵ ${salesTotal.toFixed(0)}`, dot: "var(--ice)" },
    { label: "Receipts", value: completedTransactions.length.toString(), dot: "var(--lilac)" },
    { label: "Catalog", value: products.length.toString(), dot: "var(--sky)" },
    { label: "Low stock", value: lowStockCount.toString(), dot: "var(--honey)" },
  ];

  return (
    <ToastProvider>
      <div className="relative min-h-screen text-ink lg:h-screen lg:overflow-hidden">
        <NeuralField />

        <div className="relative z-10 flex h-full">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onLogout={handleLogout}
            operator={operator}
          />

          <div className="flex min-w-0 flex-1 flex-col lg:h-screen">
            <header className="px-4 pt-4 md:px-6">
              <div className="g-panel rise flex flex-col gap-4 rounded-[26px] px-5 py-4 md:px-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="lbl flex items-center gap-2" style={{ color: meta.accent }}>
                    <span
                      className="pulse-dot inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: meta.accent, color: meta.accent }}
                    />
                    DiaPalace Operations
                  </div>
                  <h2 className="font-display mt-1 text-2xl font-bold leading-tight tracking-tight text-ink md:text-[28px]">
                    {meta.title}
                  </h2>
                  <p className="mt-1 hidden max-w-xl text-xs leading-relaxed text-dim md:block">
                    {meta.blurb}{" "}
                    <span className="text-faint">
                      Press <span className="kbd">1</span>–<span className="kbd">4</span> to glide between modules.
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 xl:w-[540px] xl:shrink-0">
                  {metrics.map((m) => (
                    <div key={m.label} className="g-chip rounded-2xl px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full" style={{ background: m.dot }} />
                        <span className="truncate text-[8px] font-extrabold uppercase tracking-[0.14em] text-faint md:text-[9px]">
                          {m.label}
                        </span>
                      </div>
                      <div className="num mt-1 truncate text-sm font-bold text-ink md:text-base">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 pb-32 pt-4 md:px-6 lg:pb-6">
              <div key={activeTab} className="rise flex min-h-0 flex-1 flex-col">
                {renderActiveModule()}
              </div>
            </main>
          </div>
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
