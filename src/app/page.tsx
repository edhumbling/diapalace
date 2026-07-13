"use client";

import React, { useState, useEffect } from "react";
import LoginScreen from "../components/LoginScreen";
import Sidebar from "../components/Sidebar";
import POSModule from "../components/POSModule";
import PaymentModal from "../components/PaymentModal";
import ReceiptModal from "../components/ReceiptModal";
import InventoryModule from "../components/InventoryModule";
import CustomersModule from "../components/CustomersModule";
import AnalyticsModule from "../components/AnalyticsModule";
import { db, Product, Customer, Transaction } from "../lib/db";

export default function Home() {
  const [operator, setOperator] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("pos");

  // Master lists loaded from mock DB (localStorage)
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Checkout modal control states
  const [checkoutCart, setCheckoutCart] = useState<any[] | null>(null);
  const [checkoutCustomer, setCheckoutCustomer] = useState<Customer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Active Receipt Modal control state
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);

  // Load session and master datasets on mount
  useEffect(() => {
    const sessionOperator = db.getSession();
    if (sessionOperator) {
      setOperator(sessionOperator);
    }
    
    // Load databases
    setProducts(db.getProducts());
    setCategories(db.getCategories());
    setCustomers(db.getCustomers());
    setTransactions(db.getTransactions());
  }, []);

  const handleLoginSuccess = (operatorName: string) => {
    setOperator(operatorName);
    // Reload state on login
    setProducts(db.getProducts());
    setCategories(db.getCategories());
    setCustomers(db.getCustomers());
    setTransactions(db.getTransactions());
  };

  const handleLogout = () => {
    db.setSession(null);
    setOperator(null);
  };

  const triggerCheckoutFlow = (cartItems: any[], customer: Customer | null) => {
    setCheckoutCart(cartItems);
    setCheckoutCustomer(customer);
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = (
    paymentMethod: "Cash" | "Mobile Money",
    momoNetwork?: "MTN" | "Telecel" | "AT",
    referenceText?: string,
    amountPaid?: number
  ) => {
    if (!checkoutCart || !operator) return;

    // 1. Calculate totals
    const subtotal = checkoutCart.reduce((acc, item) => {
      const price = item.variation ? item.variation.price : item.product.price;
      return acc + price * item.quantity;
    }, 0);
    const discount = 0;
    const total = subtotal - discount;

    // 2. Subtract inventory counts
    const updatedProducts = products.map((prod) => {
      // Find items in checkout belonging to this product
      const checkoutItems = checkoutCart.filter((item) => item.product.id === prod.id);
      if (checkoutItems.length === 0) return prod;

      let newVariations = prod.variations ? [...prod.variations] : [];
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

      return {
        ...prod,
        variations: newVariations,
        stock: newTotalStock
      };
    });

    setProducts(updatedProducts);
    db.saveProducts(updatedProducts);

    // 3. Create transaction record
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
      discount,
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

    // 4. Clean up states & display Receipt
    setShowPaymentModal(false);
    setCheckoutCart(null);
    setCheckoutCustomer(null);
    setActiveReceipt(newTransaction);
  };

  const handleVoidTransaction = (txId: string) => {
    const updatedTransactions = transactions.map((tx) => {
      if (tx.id === txId) {
        return { ...tx, isVoided: true };
      }
      return tx;
    });

    setTransactions(updatedTransactions);
    db.saveTransactions(updatedTransactions);

    // Find the voided transaction to replenish stock
    const targetTx = transactions.find((tx) => tx.id === txId);
    if (targetTx) {
      const updatedProducts = products.map((prod) => {
        // Find transaction items belonging to this product
        const txItems = targetTx.items.filter((item) => item.productId === prod.id);
        if (txItems.length === 0) return prod;

        let newVariations = prod.variations ? [...prod.variations] : [];
        let baseStockIncrement = 0;

        for (const item of txItems) {
          if (item.variation && prod.variations) {
            const idx = prod.variations.findIndex(
              (v) => v.size === item.variation?.size && v.color === item.variation?.color
            );
            if (idx !== -1) {
              newVariations[idx] = {
                ...newVariations[idx],
                stock: newVariations[idx].stock + item.quantity
              };
            }
          } else {
            baseStockIncrement += item.quantity;
          }
        }

        const newTotalStock = prod.variations && prod.variations.length > 0
          ? newVariations.reduce((acc, v) => acc + v.stock, 0)
          : prod.stock + baseStockIncrement;

        return {
          ...prod,
          variations: newVariations,
          stock: newTotalStock
        };
      });

      setProducts(updatedProducts);
      db.saveProducts(updatedProducts);
    }
  };

  const handleProductsChange = (newProds: Product[]) => {
    setProducts(newProds);
  };

  const handleCategoriesChange = (newCats: string[]) => {
    setCategories(newCats);
  };

  const handleCustomersChange = (newCusts: Customer[]) => {
    setCustomers(newCusts);
  };

  // Render active module
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
      case "pos":
        return "Register Sales terminal";
      case "inventory":
        return "Product & Stock Inventory";
      case "customers":
        return "Customer directory";
      case "analytics":
        return "Sales Analytics & Reports";
      default:
        return "POS System";
    }
  };

  // Guard Clause: If not logged in, render secure Login Screen
  if (!operator) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Calculate cart total billing for payment modal
  const checkoutTotal = checkoutCart
    ? checkoutCart.reduce((acc, item) => {
        const price = item.variation ? item.variation.price : item.product.price;
        return acc + price * item.quantity;
      }, 0)
    : 0;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 flex-col md:flex-row relative">
      
      {/* Background visual glows */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-rose-500/5 blur-[100px] pointer-events-none" />

      {/* Navigation sidebar (desktop or bottom mobile navigation) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        operatorName={operator}
        onLogout={handleLogout}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        
        {/* Workspace Top Toolbar */}
        <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-200">
              {getModuleTitle()}
            </h2>
            <span className="text-[9px] text-zinc-500 font-medium tracking-wide">
              Logged in as Operator: <span className="text-rose-300 font-semibold">{operator}</span>
            </span>
          </div>
          
          <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-400 bg-zinc-900/40 px-3.5 py-1.5 rounded-xl border border-zinc-900">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </header>

        {/* Dynamic module frame container */}
        <main className="flex-1 p-6 md:p-8 flex flex-col overflow-y-auto max-h-[calc(100vh-68px)]">
          {renderActiveModule()}
        </main>
      </div>

      {/* Checkout Payment Gateway Modal Overlay */}
      {showPaymentModal && (
        <PaymentModal
          totalBill={checkoutTotal}
          linkedCustomer={checkoutCustomer}
          onClose={() => {
            setShowPaymentModal(false);
            setCheckoutCart(null);
            setCheckoutCustomer(null);
          }}
          onComplete={handlePaymentComplete}
        />
      )}

      {/* Digital / Thermal Print Receipt Modal Overlay */}
      {activeReceipt && (
        <ReceiptModal
          transaction={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

    </div>
  );
}
