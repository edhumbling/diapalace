"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Banknote,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CreditCard,
  Download,
  Landmark,
  LogOut,
  Menu,
  Minus,
  MoreHorizontal,
  PackageOpen,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  Search,
  Settings,
  ShoppingCart,
  Smartphone,
  Store,
  Trash2,
  Truck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";

type View = "checkout" | "inventory" | "customers" | "sales" | "purchases" | "expenses" | "reconciliation" | "reports" | "settings";
type PaymentMethod = "Cash" | "MTN MoMo" | "Telecel Cash" | "AirtelTigo Money" | "Card / POS" | "Bank transfer" | "Credit";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  reorderAt: number;
  unit: string;
};

type Customer = { id: string; name: string; phone: string; credit: number; visits: number };
type CartItem = { productId: string; name: string; price: number; qty: number; stock: number };
type Sale = { id: string; date: string; items: CartItem[]; total: number; method: PaymentMethod; customer: string; operator: string };
type Purchase = { id: string; supplier: string; date: string; amount: number; status: "Received" | "Pending" };
type Expense = { id: string; description: string; category: string; date: string; amount: number };

const seedProducts: Product[] = [
  { id: "p1", name: "Classic denim jacket", sku: "DP-1042", category: "Apparel", price: 420, cost: 280, stock: 12, reorderAt: 5, unit: "piece" },
  { id: "p2", name: "Everyday crew sweater", sku: "DP-3011", category: "Apparel", price: 285, cost: 170, stock: 7, reorderAt: 8, unit: "piece" },
  { id: "p3", name: "Canvas tote bag", sku: "DP-2088", category: "Accessories", price: 95, cost: 48, stock: 18, reorderAt: 6, unit: "piece" },
  { id: "p4", name: "Leather card wallet", sku: "DP-4017", category: "Accessories", price: 160, cost: 92, stock: 4, reorderAt: 5, unit: "piece" },
  { id: "p5", name: "Ribbed cotton dress", sku: "DP-5018", category: "Dresses", price: 365, cost: 210, stock: 23, reorderAt: 6, unit: "piece" },
  { id: "p6", name: "Linen co-ord set", sku: "DP-6102", category: "Dresses", price: 540, cost: 330, stock: 9, reorderAt: 4, unit: "piece" },
  { id: "p7", name: "Minimal hoop earrings", sku: "DP-7104", category: "Jewellery", price: 75, cost: 32, stock: 31, reorderAt: 8, unit: "pair" },
  { id: "p8", name: "Silk head scarf", sku: "DP-8020", category: "Accessories", price: 120, cost: 58, stock: 16, reorderAt: 5, unit: "piece" },
];

const seedCustomers: Customer[] = [
  { id: "c1", name: "Ama Serwaa", phone: "024 555 0192", credit: 0, visits: 18 },
  { id: "c2", name: "Kojo Mensah", phone: "055 318 4420", credit: 240, visits: 11 },
  { id: "c3", name: "Nana Owusu", phone: "020 771 2605", credit: 0, visits: 8 },
  { id: "c4", name: "Walk-in customer", phone: "", credit: 0, visits: 0 },
];

const seedSales: Sale[] = [
  { id: "DP-8841", date: "Today, 10:42 AM", items: [{ productId: "p3", name: "Canvas tote bag", price: 95, qty: 1, stock: 18 }], total: 95, method: "MTN MoMo", customer: "Ama Serwaa", operator: "Jordan Lee" },
  { id: "DP-8840", date: "Today, 9:58 AM", items: [{ productId: "p1", name: "Classic denim jacket", price: 420, qty: 1, stock: 12 }], total: 420, method: "Cash", customer: "Walk-in customer", operator: "Jordan Lee" },
  { id: "DP-8839", date: "Yesterday, 5:16 PM", items: [{ productId: "p5", name: "Ribbed cotton dress", price: 365, qty: 1, stock: 23 }], total: 365, method: "Card / POS", customer: "Nana Owusu", operator: "Abena K." },
  { id: "DP-8838", date: "Yesterday, 3:04 PM", items: [{ productId: "p7", name: "Minimal hoop earrings", price: 75, qty: 2, stock: 31 }], total: 150, method: "Cash", customer: "Kojo Mensah", operator: "Abena K." },
];

const seedPurchases: Purchase[] = [
  { id: "PO-2047", supplier: "Accra Apparel Hub", date: "Today", amount: 3840, status: "Pending" },
  { id: "PO-2046", supplier: "Kumasi Leather Works", date: "Yesterday", amount: 2160, status: "Received" },
  { id: "PO-2045", supplier: "Cape Coast Textiles", date: "Oct 18, 2024", amount: 4920, status: "Received" },
];

const seedExpenses: Expense[] = [
  { id: "EX-109", description: "Shop electricity", category: "Utilities", date: "Today", amount: 180 },
  { id: "EX-108", description: "Courier delivery", category: "Logistics", date: "Yesterday", amount: 65 },
  { id: "EX-107", description: "Packaging supplies", category: "Supplies", date: "Oct 18, 2024", amount: 240 },
];

const navGroups = [
  { label: "Sell", items: [{ id: "checkout", label: "Checkout", icon: ShoppingCart }] },
  { label: "Manage", items: [{ id: "inventory", label: "Inventory", icon: PackageOpen }, { id: "customers", label: "Customers", icon: UsersRound }, { id: "purchases", label: "Purchases", icon: Truck }, { id: "expenses", label: "Expenses", icon: WalletCards }] },
  { label: "Understand", items: [{ id: "sales", label: "Sales history", icon: ReceiptText }, { id: "reconciliation", label: "Cash-up", icon: Landmark }, { id: "reports", label: "Reports", icon: BarChart3 }] },
];

const money = (amount: number) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", currencyDisplay: "symbol", maximumFractionDigits: 2 }).format(amount).replace("GHS", "GH₵");
const todayLabel = new Intl.DateTimeFormat("en-GH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return <button className="icon-btn" aria-label={label} onClick={onClick}>{children}</button>;
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "blue" }) {
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children}</span>;
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div>{eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}<h2 id="modal-title">{title}</h2></div><IconButton label="Close dialog" onClick={onClose}><X size={20} /></IconButton></div>{children}</section></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("checkout");
  const [products, setProducts] = useState(seedProducts);
  const [customers, setCustomers] = useState(seedCustomers);
  const [sales, setSales] = useState(seedSales);
  const [purchases, setPurchases] = useState(seedPurchases);
  const [expenses, setExpenses] = useState(seedExpenses);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All items");
  const [customerId, setCustomerId] = useState("c4");
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [cashReceived, setCashReceived] = useState(0);
  const [mobileReference, setMobileReference] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [modal, setModal] = useState<"product" | "customer" | "expense" | "purchase" | "adjust" | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [shiftOpen, setShiftOpen] = useState(true);
  const [countedCash, setCountedCash] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(15);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate the register from browser storage once. */
    try {
      const saved = window.localStorage.getItem("diapalace-pos-state");
      if (saved) {
        const state = JSON.parse(saved);
        if (state.products) setProducts(state.products);
        if (state.customers) setCustomers(state.customers);
        if (state.sales) setSales(state.sales);
        if (state.purchases) setPurchases(state.purchases);
        if (state.expenses) setExpenses(state.expenses);
        if (typeof state.taxEnabled === "boolean") setTaxEnabled(state.taxEnabled);
        if (typeof state.taxRate === "number") setTaxRate(state.taxRate);
      }
    } catch { /* Local storage is optional; the register still works without it. */ }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("diapalace-pos-state", JSON.stringify({ products, customers, sales, purchases, expenses, taxEnabled, taxRate }));
  }, [products, customers, sales, purchases, expenses, taxEnabled, taxRate, hydrated]);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = taxEnabled ? Math.max(0, (subtotal - discount) * (taxRate / 100)) : 0;
  const total = Math.max(0, subtotal - discount + tax);
  const categories = ["All items", ...Array.from(new Set(products.map((product) => product.category)))];
  const filteredProducts = products.filter((product) => {
    const term = search.toLowerCase();
    return (product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term)) && (category === "All items" || product.category === category);
  });
  const lowStock = products.filter((product) => product.stock <= product.reorderAt);
  const todaySales = sales.filter((sale) => sale.date.startsWith("Today"));
  const cashSales = todaySales.filter((sale) => sale.method === "Cash").reduce((sum, sale) => sum + sale.total, 0);
  const expectedCash = 250 + cashSales;

  function addToCart(product: Product) {
    if (product.stock < 1) { notify(`${product.name} is out of stock.`); return; }
    setCart((current) => {
      const found = current.find((item) => item.productId === product.id);
      if (found) return current.map((item) => item.productId === product.id ? { ...item, qty: Math.min(item.qty + 1, product.stock) } : item);
      return [...current, { productId: product.id, name: product.name, price: product.price, qty: 1, stock: product.stock }];
    });
  }

  function changeQty(productId: string, amount: number) {
    setCart((current) => current.map((item) => item.productId === productId ? { ...item, qty: Math.max(0, Math.min(item.qty + amount, item.stock)) } : item).filter((item) => item.qty > 0));
  }

  function completeSale() {
    if (!cart.length) return;
    if (paymentMethod === "Cash" && cashReceived < total) { notify("Cash received must cover the bill."); return; }
    if ((paymentMethod !== "Cash" && paymentMethod !== "Credit") && !mobileReference.trim()) { notify("Add the payment reference before completing."); return; }
    const sale: Sale = { id: `DP-${String(8842 + sales.length).padStart(4, "0")}`, date: `Today, ${new Intl.DateTimeFormat("en-GH", { hour: "numeric", minute: "2-digit" }).format(new Date())}`, items: cart, total, method: paymentMethod, customer: customers.find((customer) => customer.id === customerId)?.name ?? "Walk-in customer", operator: "Jordan Lee" };
    setSales((current) => [sale, ...current]);
    setProducts((current) => current.map((product) => { const item = cart.find((cartItem) => cartItem.productId === product.id); return item ? { ...product, stock: Math.max(0, product.stock - item.qty) } : product; }));
    if (paymentMethod === "Credit") setCustomers((current) => current.map((customer) => customer.id === customerId ? { ...customer, credit: customer.credit + total } : customer));
    setCart([]); setDiscount(0); setCashReceived(0); setMobileReference(""); setPaymentOpen(false); setReceipt(sale); notify(`Sale ${sale.id} completed successfully.`);
  }

  function navigate(nextView: View) { setView(nextView); setMobileNavOpen(false); setReceipt(null); }

  return <div className="pos-app">
    <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
      <div className="sidebar-brand"><span className="brand-mark">D</span><span><strong>DiaPalace</strong><small>Retail operations</small></span><IconButton label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={19} /></IconButton></div>
      <div className="store-switcher"><span className="store-avatar"><Store size={17} /></span><span><strong>Osu flagship</strong><small>Register 01</small></span><ChevronDown size={16} /></div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navGroups.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => { const ItemIcon = item.icon; return <button key={item.id} className={`nav-link ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id as View)}><ItemIcon size={19} /><span>{item.label}</span>{item.id === "inventory" && lowStock.length > 0 && <em>{lowStock.length}</em>}</button>; })}</div>)}
        <div className="nav-group nav-bottom"><p>Workspace</p><button className={`nav-link ${view === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings size={19} /><span>Settings</span></button><button className="nav-link" onClick={() => notify("Help centre opening soon.")}><CircleAlert size={19} /><span>Help centre</span></button></div>
      </nav>
      <div className="sidebar-footer"><div className="avatar">JL</div><span><strong>Jordan Lee</strong><small>Administrator</small></span><IconButton label="Sign out" onClick={() => notify("Sign out is ready for your production auth integration.")}><LogOut size={17} /></IconButton></div>
    </aside>

    <div className="app-main">
      <header className="topbar"><div className="topbar-left"><IconButton label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={22} /></IconButton><div className="crumb"><span>Osu flagship</span><span>/</span><strong>{navGroups.flatMap((group) => group.items).find((item) => item.id === view)?.label ?? "Settings"}</strong></div></div><div className="topbar-right"><span className="sync-state"><span className="sync-dot" /> Saved locally</span><IconButton label="Notifications" onClick={() => notify("No new notifications. You are all caught up.")}><Bell size={20} /></IconButton><div className="topbar-date"><CalendarDays size={16} />{todayLabel}</div></div></header>
      <main className="page-content">
        {view === "checkout" && <CheckoutView products={filteredProducts} categories={categories} category={category} setCategory={setCategory} search={search} setSearch={setSearch} cart={cart} addToCart={addToCart} changeQty={changeQty} setCart={setCart} customers={customers} customerId={customerId} setCustomerId={setCustomerId} discount={discount} setDiscount={setDiscount} subtotal={subtotal} tax={tax} total={total} taxEnabled={taxEnabled} taxRate={taxRate} onPay={() => cart.length && setPaymentOpen(true)} receipt={receipt} onNewSale={() => setReceipt(null)} />}
        {view === "inventory" && <InventoryView products={products} lowStock={lowStock} search={search} setSearch={setSearch} onAdd={() => setModal("product")} onAdjust={(product) => { setModal("adjust"); setAdjustProduct(product); }} />}
        {view === "customers" && <CustomersView customers={customers} onAdd={() => setModal("customer")} />}
        {view === "sales" && <SalesView sales={sales} onNotify={notify} />}
        {view === "purchases" && <PurchasesView purchases={purchases} onAdd={() => setModal("purchase")} />}
        {view === "expenses" && <ExpensesView expenses={expenses} onAdd={() => setModal("expense")} />}
        {view === "reconciliation" && <ReconciliationView sales={sales} shiftOpen={shiftOpen} setShiftOpen={setShiftOpen} expectedCash={expectedCash} countedCash={countedCash} setCountedCash={setCountedCash} onNotify={notify} />}
        {view === "reports" && <ReportsView sales={sales} products={products} expenses={expenses} />}
        {view === "settings" && <SettingsView taxEnabled={taxEnabled} setTaxEnabled={setTaxEnabled} taxRate={taxRate} setTaxRate={setTaxRate} onNotify={notify} />}
      </main>
    </div>

    {paymentOpen && <PaymentModal total={total} subtotal={subtotal} discount={discount} tax={tax} method={paymentMethod} setMethod={setPaymentMethod} cashReceived={cashReceived} setCashReceived={setCashReceived} reference={mobileReference} setReference={setMobileReference} onClose={() => setPaymentOpen(false)} onComplete={completeSale} />}
    {modal === "product" && <ProductModal onClose={() => setModal(null)} onSave={(product) => { setProducts((current) => [...current, { ...product, id: `p${Date.now()}` }]); setModal(null); notify("Product added to inventory."); }} />}
    {modal === "customer" && <CustomerModal onClose={() => setModal(null)} onSave={(customer) => { setCustomers((current) => [...current, { ...customer, id: `c${Date.now()}`, credit: 0, visits: 0 }]); setModal(null); notify("Customer profile created."); }} />}
    {modal === "purchase" && <PurchaseModal onClose={() => setModal(null)} onSave={(purchase) => { setPurchases((current) => [{ ...purchase, id: `PO-${2048 + current.length}` }, ...current]); setModal(null); notify("Purchase order recorded."); }} />}
    {modal === "expense" && <ExpenseModal onClose={() => setModal(null)} onSave={(expense) => { setExpenses((current) => [{ ...expense, id: `EX-${110 + current.length}` }, ...current]); setModal(null); notify("Expense recorded."); }} />}
    {modal === "adjust" && adjustProduct && <AdjustStockModal product={adjustProduct} onClose={() => setModal(null)} onSave={(amount) => { setProducts((current) => current.map((product) => product.id === adjustProduct.id ? { ...product, stock: Math.max(0, product.stock + amount) } : product)); setModal(null); notify("Stock count updated."); }} />}
    {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
  </div>;
}

function CheckoutView({ products, categories, category, setCategory, search, setSearch, cart, addToCart, changeQty, setCart, customers, customerId, setCustomerId, discount, setDiscount, subtotal, tax, total, taxEnabled, taxRate, onPay, receipt, onNewSale }: { products: Product[]; categories: string[]; category: string; setCategory: (value: string) => void; search: string; setSearch: (value: string) => void; cart: CartItem[]; addToCart: (product: Product) => void; changeQty: (id: string, amount: number) => void; setCart: (cart: CartItem[]) => void; customers: Customer[]; customerId: string; setCustomerId: (value: string) => void; discount: number; setDiscount: (value: number) => void; subtotal: number; tax: number; total: number; taxEnabled: boolean; taxRate: number; onPay: () => void; receipt: Sale | null; onNewSale: () => void }) {
  if (receipt) return <div className="success-screen"><div className="success-icon"><Check size={34} /></div><p className="eyebrow">Payment complete</p><h1>Sale recorded</h1><p className="success-copy">Receipt <strong>{receipt.id}</strong> is ready. Stock levels and the register have been updated.</p><div className="receipt-card"><div><span>Customer</span><strong>{receipt.customer}</strong></div><div><span>Payment</span><strong>{receipt.method}</strong></div><div><span>Total</span><strong>{money(receipt.total)}</strong></div><div><span>Operator</span><strong>{receipt.operator}</strong></div></div><div className="success-actions"><button className="button primary" onClick={onNewSale}><Plus size={18} /> New sale</button><button className="button secondary"><Printer size={18} /> Print receipt</button><button className="button ghost"><Download size={18} /> Download</button></div></div>;
  return <div className="checkout-layout"><section className="checkout-catalog"><PageHeader eyebrow="Point of sale" title="Checkout" description="Search, scan, and add products to the customer bill." action={<div className="register-badge"><span className="live-dot" /> Register open <strong>01</strong></div>} /><div className="catalog-toolbar"><div className="search-field"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item, SKU or barcode" /><kbd>⌘ K</kbd></div><button className="scan-button" onClick={() => setSearch("DP-")}><ScanLine size={18} /> Scan barcode</button></div><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="product-grid">{products.map((product) => <button key={product.id} className="product-card" onClick={() => addToCart(product)} disabled={product.stock === 0}><span className={`product-art art-${product.category.toLowerCase()}`}><PackageOpen size={28} /></span><span className="product-info"><strong>{product.name}</strong><small>{product.sku} · {product.stock} in stock</small></span><span className="product-bottom"><b>{money(product.price)}</b><span className={product.stock <= product.reorderAt ? "stock-warning" : "stock-ok"}>{product.stock <= product.reorderAt ? "Low stock" : "Available"}</span></span><span className="add-product"><Plus size={18} /></span></button>)}</div>{products.length === 0 && <div className="empty-state"><Search size={28} /><h3>No items found</h3><p>Try another product name, SKU, or category.</p></div>}</section><aside className="cart-panel"><div className="cart-head"><div><p className="eyebrow">Current order</p><h2>New sale</h2></div><span className="cart-count">{cart.reduce((sum, item) => sum + item.qty, 0)} items</span></div>{cart.length === 0 ? <div className="cart-empty"><span><ShoppingCart size={25} /></span><h3>Your cart is empty</h3><p>Select products from the catalog to start a sale.</p></div> : <div className="cart-items">{cart.map((item) => <div className="cart-line" key={item.productId}><div className="cart-line-info"><strong>{item.name}</strong><small>{money(item.price)} each</small></div><div className="qty-control"><button onClick={() => changeQty(item.productId, -1)} aria-label={`Decrease ${item.name}`}><Minus size={14} /></button><span>{item.qty}</span><button onClick={() => changeQty(item.productId, 1)} aria-label={`Increase ${item.name}`}><Plus size={14} /></button></div><strong className="line-total">{money(item.price * item.qty)}</strong><IconButton label={`Remove ${item.name}`} onClick={() => setCart(cart.filter((line) => line.productId !== item.productId))}><Trash2 size={15} /></IconButton></div>)}</div>}<div className="cart-controls"><label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.credit > 0 ? ` · Owes ${money(customer.credit)}` : ""}</option>)}</select></label><label>Discount<input type="number" min="0" value={discount || ""} onChange={(event) => setDiscount(Math.min(subtotal, Number(event.target.value) || 0))} placeholder="GH₵ 0.00" /></label></div><div className="cart-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{discount > 0 && <div><span>Discount</span><strong className="discount-value">− {money(discount)}</strong></div>}<div><span>{taxEnabled ? `VAT (${taxRate}%)` : "Tax"}</span><strong>{taxEnabled ? money(tax) : "Not applied"}</strong></div><div className="total-row"><span>Total</span><strong>{money(total)}</strong></div></div><button className="button primary pay-button" disabled={!cart.length} onClick={onPay}>Continue to payment <ArrowRight size={18} /></button><p className="secure-note"><RefreshCcw size={14} /> Changes are saved to this register</p></aside></div>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</div>; }

function InventoryView({ products, lowStock, search, setSearch, onAdd, onAdjust }: { products: Product[]; lowStock: Product[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onAdjust: (product: Product) => void }) { return <><PageHeader eyebrow="Product control" title="Inventory" description="Keep every product, price, and stock count accurate." action={<button className="button primary" onClick={onAdd}><Plus size={18} /> Add product</button>} /><div className="metric-row"><Metric label="Total products" value={products.length.toString()} icon={<PackageOpen size={19} />} /><Metric label="Low stock" value={lowStock.length.toString()} icon={<CircleAlert size={19} />} tone="warning" /><Metric label="Stock value" value={money(products.reduce((sum, product) => sum + product.cost * product.stock, 0))} icon={<BarChart3 size={19} />} /><Metric label="Categories" value={new Set(products.map((product) => product.category)).size.toString()} icon={<Store size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div className="search-field compact"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or SKUs" /></div><button className="button secondary"><Download size={17} /> Export CSV</button></div><DataTable headers={["Product", "SKU", "Category", "Sell price", "In stock", "Status", ""]}>{products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()) || product.sku.toLowerCase().includes(search.toLowerCase())).map((product) => <tr key={product.id}><td><div className="table-product"><span className={`mini-art art-${product.category.toLowerCase()}`}><PackageOpen size={17} /></span><strong>{product.name}</strong></div></td><td className="mono">{product.sku}</td><td>{product.category}</td><td className="strong-number">{money(product.price)}</td><td>{product.stock} {product.unit}s</td><td><StatusPill tone={product.stock === 0 ? "danger" : product.stock <= product.reorderAt ? "warning" : "success"}>{product.stock === 0 ? "Out of stock" : product.stock <= product.reorderAt ? "Reorder soon" : "Healthy"}</StatusPill></td><td><button className="table-action" onClick={() => onAdjust(product)}>Adjust stock</button></td></tr>)}</DataTable></section></>; }

function CustomersView({ customers, onAdd }: { customers: Customer[]; onAdd: () => void }) { return <><PageHeader eyebrow="Relationships" title="Customers" description="Know your regulars, record credit, and grow repeat business." action={<button className="button primary" onClick={onAdd}><Plus size={18} /> Add customer</button>} /><div className="metric-row"><Metric label="Customer profiles" value={customers.length.toString()} icon={<UsersRound size={19} />} /><Metric label="Outstanding credit" value={money(customers.reduce((sum, customer) => sum + customer.credit, 0))} icon={<WalletCards size={19} />} tone="warning" /><Metric label="Returning customers" value="68%" icon={<RefreshCcw size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div><h2>Customer book</h2><p>Profiles and credit balances at a glance.</p></div><button className="button secondary"><Download size={17} /> Export</button></div><DataTable headers={["Customer", "Phone", "Visits", "Credit balance", ""]}>{customers.map((customer) => <tr key={customer.id}><td><div className="person-cell"><span className="person-avatar">{customer.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><strong>{customer.name}</strong></div></td><td>{customer.phone || "—"}</td><td>{customer.visits}</td><td className={customer.credit ? "credit-due" : "muted"}>{customer.credit ? money(customer.credit) : "No balance"}</td><td><button className="table-action">View profile <ArrowRight size={15} /></button></td></tr>)}</DataTable></section></>; }

function SalesView({ sales, onNotify }: { sales: Sale[]; onNotify: (message: string) => void }) { return <><PageHeader eyebrow="Transactions" title="Sales history" description="Every receipt, payment method, and operator in one auditable record." action={<button className="button secondary" onClick={() => onNotify("Sales report exported.")}><Download size={17} /> Export report</button>} /><div className="metric-row"><Metric label="Today&apos;s sales" value={money(sales.filter((sale) => sale.date.startsWith("Today")).reduce((sum, sale) => sum + sale.total, 0))} icon={<ReceiptText size={19} />} /><Metric label="Transactions" value={sales.length.toString()} icon={<ShoppingCart size={19} />} /><Metric label="Average basket" value={money(sales.length ? sales.reduce((sum, sale) => sum + sale.total, 0) / sales.length : 0)} icon={<BarChart3 size={19} />} /><Metric label="Digital payments" value={`${sales.filter((sale) => sale.method !== "Cash").length}`} icon={<Smartphone size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div><h2>Recent transactions</h2><p>Receipts are numbered and linked to the operator who completed them.</p></div><button className="filter-button">All dates <ChevronDown size={16} /></button></div><DataTable headers={["Receipt", "Time", "Customer", "Payment", "Amount", "Operator", ""]}>{sales.map((sale) => <tr key={sale.id}><td className="mono strong-number">{sale.id}</td><td>{sale.date}</td><td>{sale.customer}</td><td><PaymentBadge method={sale.method} /></td><td className="strong-number">{money(sale.total)}</td><td>{sale.operator}</td><td><IconButton label={`More options for ${sale.id}`} onClick={() => onNotify(`Receipt ${sale.id} selected.`)}><MoreHorizontal size={18} /></IconButton></td></tr>)}</DataTable></section></>; }

function PurchasesView({ purchases, onAdd }: { purchases: Purchase[]; onAdd: () => void }) { return <><PageHeader eyebrow="Stock in" title="Purchases" description="Record suppliers, purchase orders, and the cost of getting products in." action={<button className="button primary" onClick={onAdd}><Plus size={18} /> Record purchase</button>} /><div className="metric-row"><Metric label="Pending orders" value={purchases.filter((purchase) => purchase.status === "Pending").length.toString()} icon={<Truck size={19} />} tone="warning" /><Metric label="This month" value={money(purchases.reduce((sum, purchase) => sum + purchase.amount, 0))} icon={<Banknote size={19} />} /><Metric label="Active suppliers" value="8" icon={<UsersRound size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div><h2>Purchase orders</h2><p>Use receiving to increase stock only when goods arrive.</p></div><button className="button secondary"><Download size={17} /> Export</button></div><DataTable headers={["Order", "Supplier", "Date", "Amount", "Status", ""]}>{purchases.map((purchase) => <tr key={purchase.id}><td className="mono strong-number">{purchase.id}</td><td className="strong-number">{purchase.supplier}</td><td>{purchase.date}</td><td>{money(purchase.amount)}</td><td><StatusPill tone={purchase.status === "Pending" ? "warning" : "success"}>{purchase.status}</StatusPill></td><td><button className="table-action">View order <ArrowRight size={15} /></button></td></tr>)}</DataTable></section></>; }

function ExpensesView({ expenses, onAdd }: { expenses: Expense[]; onAdd: () => void }) { return <><PageHeader eyebrow="Outgoings" title="Expenses" description="Track the everyday costs that sit outside product purchases." action={<button className="button primary" onClick={onAdd}><Plus size={18} /> Add expense</button>} /><div className="metric-row"><Metric label="This month" value={money(expenses.reduce((sum, expense) => sum + expense.amount, 0))} icon={<WalletCards size={19} />} /><Metric label="Entries" value={expenses.length.toString()} icon={<ReceiptText size={19} />} /><Metric label="Largest category" value="Supplies" icon={<PackageOpen size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div><h2>Expense log</h2><p>Keep operating costs visible for a more honest profit picture.</p></div><button className="filter-button">This month <ChevronDown size={16} /></button></div><DataTable headers={["Description", "Category", "Date", "Amount", ""]}>{expenses.map((expense) => <tr key={expense.id}><td><strong>{expense.description}</strong><small className="table-sub">{expense.id}</small></td><td><StatusPill tone="blue">{expense.category}</StatusPill></td><td>{expense.date}</td><td className="strong-number">{money(expense.amount)}</td><td><IconButton label={`More options for ${expense.description}`}><MoreHorizontal size={18} /></IconButton></td></tr>)}</DataTable></section></>; }

function ReconciliationView({ sales, shiftOpen, setShiftOpen, expectedCash, countedCash, setCountedCash, onNotify }: { sales: Sale[]; shiftOpen: boolean; setShiftOpen: (value: boolean) => void; expectedCash: number; countedCash: number; setCountedCash: (value: number) => void; onNotify: (message: string) => void }) { const variance = countedCash - expectedCash; return <><PageHeader eyebrow="End of shift" title="Cash-up & reconciliation" description="Close the register with confidence. Compare expected takings to what is in the drawer." action={<StatusPill tone={shiftOpen ? "success" : "neutral"}>{shiftOpen ? "Shift open" : "Shift closed"}</StatusPill>} /><div className="cashup-layout"><section className="panel cashup-main"><div className="cashup-title"><span className="section-icon"><Landmark size={22} /></span><div><h2>Register 01 · Osu flagship</h2><p>Jordan Lee · Opened today at 8:00 AM</p></div></div><div className="cashup-breakdown"><div><span>Opening float</span><strong>{money(250)}</strong><small>Cash in drawer at open</small></div><div><span>Cash sales</span><strong>{money(sales.filter((sale) => sale.method === "Cash").reduce((sum, sale) => sum + sale.total, 0))}</strong><small>{sales.filter((sale) => sale.method === "Cash").length} cash transactions</small></div><div><span>Expected cash</span><strong>{money(expectedCash)}</strong><small>Opening float + cash sales</small></div></div><div className="cash-count"><label>Counted cash in drawer<input type="number" min="0" value={countedCash || ""} onChange={(event) => setCountedCash(Number(event.target.value) || 0)} placeholder="Enter amount" /></label><div className={`variance ${countedCash ? (variance === 0 ? "even" : variance > 0 ? "over" : "short") : "empty"}`}><span>{countedCash ? variance === 0 ? "Balanced" : variance > 0 ? "Over" : "Short" : "Awaiting count"}</span><strong>{countedCash ? `${variance >= 0 ? "+" : "−"} ${money(Math.abs(variance))}` : "—"}</strong></div></div><div className="cashup-actions"><button className="button secondary" onClick={() => onNotify("Cash-up worksheet printed.")}><Printer size={17} /> Print worksheet</button><button className="button primary" disabled={!countedCash || !shiftOpen} onClick={() => { setShiftOpen(false); onNotify("Shift closed and reconciliation saved."); }}>Close shift <ArrowRight size={17} /></button></div></section><aside className="panel cashup-side"><p className="eyebrow">Control checks</p><h2>Before you close</h2><ul className="check-list"><li><span className="check okay"><Check size={15} /></span><span><strong>All sales recorded</strong><small>{sales.length} transactions in this register</small></span></li><li><span className="check okay"><Check size={15} /></span><span><strong>Digital payments separated</strong><small>MoMo, card, and bank transfer excluded</small></span></li><li><span className="check pending"><CircleAlert size={15} /></span><span><strong>Count physical cash</strong><small>Enter the drawer total to compare</small></span></li></ul><div className="cashup-tip"><CircleAlert size={17} /><p><strong>Tip</strong> Keep the signed cash-up worksheet with the day&apos;s receipts.</p></div></aside></div></>; }

function ReportsView({ sales, products, expenses }: { sales: Sale[]; products: Product[]; expenses: Expense[] }) { const methods: PaymentMethod[] = ["Cash", "MTN MoMo", "Card / POS", "Telecel Cash"]; return <><PageHeader eyebrow="Business intelligence" title="Reports" description="A clear view of revenue, margin, payments, and stock health." action={<button className="button secondary"><Download size={17} /> Download report</button>} /><div className="report-hero"><div><p className="eyebrow">October 2024 · all registers</p><h2>Revenue overview</h2><strong>{money(sales.reduce((sum, sale) => sum + sale.total, 0) + 21840)}</strong><span className="trend">↗ 18.6% vs. last month</span></div><div className="report-bars">{[38, 48, 42, 61, 54, 78, 64, 88, 71, 92, 83, 100].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div></div><div className="report-grid"><section className="panel report-card"><div className="panel-heading"><div><h2>Payment mix</h2><p>Where today&apos;s money came from</p></div><BarChart3 size={20} /></div><div className="payment-mix">{methods.map((method, index) => { const amount = sales.filter((sale) => sale.method === method).reduce((sum, sale) => sum + sale.total, 0); return <div key={method}><div className="mix-label"><span>{method}</span><strong>{money(amount)}</strong></div><div className="mix-track"><span style={{ width: `${Math.max(8, Math.min(100, amount / 6))}%` }} className={`mix-${index}`} /></div></div>; })}</div></section><section className="panel report-card"><div className="panel-heading"><div><h2>Stock health</h2><p>Items that need a decision</p></div><PackageOpen size={20} /></div><div className="stock-health"><div><strong>{products.length - products.filter((product) => product.stock <= product.reorderAt).length}</strong><span>Healthy items</span></div><div className="health-warning"><strong>{products.filter((product) => product.stock <= product.reorderAt).length}</strong><span>Need reorder</span></div><div className="health-empty"><strong>{products.filter((product) => product.stock === 0).length}</strong><span>Out of stock</span></div></div><button className="text-button">Open inventory <ArrowRight size={16} /></button></section></div><section className="insight-strip"><BarChart3 size={22} /><span><strong>Gross margin signal:</strong> You are tracking {money(products.reduce((sum, product) => sum + (product.price - product.cost) * product.stock, 0))} in potential stock margin, before {money(expenses.reduce((sum, expense) => sum + expense.amount, 0))} of logged expenses.</span></section></>; }

function SettingsView({ taxEnabled, setTaxEnabled, taxRate, setTaxRate, onNotify }: { taxEnabled: boolean; setTaxEnabled: (value: boolean) => void; taxRate: number; setTaxRate: (value: number) => void; onNotify: (message: string) => void }) { return <><PageHeader eyebrow="Control centre" title="Settings" description="Tune DiaPalace to the way your shop works." /><div className="settings-grid"><section className="panel settings-card"><div className="settings-card-head"><span className="section-icon"><ReceiptText size={21} /></span><div><h2>Tax on receipts</h2><p>Keep tax treatment explicit at checkout.</p></div></div><div className="setting-row"><div><strong>Apply tax to new sales</strong><small>GRA lists a standard VAT rate of 15%. Confirm your registration and configure other levies with your accountant.</small></div><button className={`toggle ${taxEnabled ? "on" : ""}`} aria-label="Toggle tax" onClick={() => setTaxEnabled(!taxEnabled)}><span /></button></div>{taxEnabled && <label className="inline-field">Register rate (%)<input type="number" min="0" max="100" value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value) || 0)} /></label>}</section><section className="panel settings-card"><div className="settings-card-head"><span className="section-icon orange"><Smartphone size={21} /></span><div><h2>Payment methods</h2><p>Methods available to this register.</p></div></div>{["Cash", "MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Card / POS", "Bank transfer"].map((method) => <div className="setting-check" key={method}><span className="check okay"><Check size={15} /></span><strong>{method}</strong><span className="setting-ready">Enabled</span></div>)}</section><section className="panel settings-card"><div className="settings-card-head"><span className="section-icon green"><Store size={21} /></span><div><h2>Store profile</h2><p>Printed on receipts and staff screens.</p></div></div><label>Business name<input defaultValue="DiaPalace" /></label><label>Store location<input defaultValue="Osu, Accra" /></label><label>Receipt footer<input defaultValue="Thank you for shopping with DiaPalace." /></label><button className="button primary small" onClick={() => onNotify("Store profile saved.")}>Save profile</button></section></div></>; }

function Metric({ label, value, icon, tone = "default" }: { label: string; value: string; icon: React.ReactNode; tone?: string }) { return <div className={`metric ${tone}`}><span className="metric-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div>; }
function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function PaymentBadge({ method }: { method: PaymentMethod }) { const Icon = method === "Cash" ? Banknote : method === "Card / POS" ? CreditCard : method === "Bank transfer" ? Landmark : method === "Credit" ? WalletCards : Smartphone; return <span className="payment-badge"><Icon size={14} />{method}</span>; }

function PaymentModal({ total, subtotal, discount, tax, method, setMethod, cashReceived, setCashReceived, reference, setReference, onClose, onComplete }: { total: number; subtotal: number; discount: number; tax: number; method: PaymentMethod; setMethod: (value: PaymentMethod) => void; cashReceived: number; setCashReceived: (value: number) => void; reference: string; setReference: (value: string) => void; onClose: () => void; onComplete: () => void }) { const methods: PaymentMethod[] = ["Cash", "MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Card / POS", "Bank transfer", "Credit"]; return <Modal title="Take payment" eyebrow="Checkout · final step" onClose={onClose}><div className="payment-total"><span>Total due</span><strong>{money(total)}</strong></div><div className="payment-methods">{methods.map((item) => <button key={item} className={method === item ? "active" : ""} onClick={() => setMethod(item)}><PaymentBadge method={item} /><Check size={16} /></button>)}</div>{method === "Cash" ? <div className="payment-input"><label>Cash received<input autoFocus type="number" min={total} value={cashReceived || ""} onChange={(event) => setCashReceived(Number(event.target.value) || 0)} placeholder={money(total)} /></label><div className="change-due"><span>Change due</span><strong>{money(Math.max(0, cashReceived - total))}</strong></div></div> : method === "Credit" ? <div className="credit-note"><WalletCards size={20} /><p>This sale will be added to the customer&apos;s credit balance. Make sure a customer is selected before completing.</p></div> : <label>Payment reference<input autoFocus value={reference} onChange={(event) => setReference(event.target.value)} placeholder={method.includes("MoMo") || method.includes("Cash") ? "e.g. MoMo confirmation or phone number" : "e.g. transaction reference"} /></label>}<div className="payment-breakdown"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{discount > 0 && <div><span>Discount</span><strong>− {money(discount)}</strong></div>}<div><span>Tax</span><strong>{money(tax)}</strong></div></div><button className="button primary full" onClick={onComplete}><Check size={18} /> Complete sale</button><p className="modal-note">A receipt number will be generated automatically.</p></Modal>; }

function ProductModal({ onClose, onSave }: { onClose: () => void; onSave: (product: Omit<Product, "id">) => void }) { const [form, setForm] = useState({ name: "", sku: "", category: "Apparel", price: "", cost: "", stock: "", reorderAt: "5", unit: "piece" }); const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value })); return <Modal title="Add product" eyebrow="Inventory" onClose={onClose}><div className="form-grid"><label className="wide">Product name<input autoFocus value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Cotton shirt" /></label><label>SKU or barcode<input value={form.sku} onChange={(event) => update("sku", event.target.value)} placeholder="DP-0000" /></label><label>Category<select value={form.category} onChange={(event) => update("category", event.target.value)}><option>Apparel</option><option>Accessories</option><option>Dresses</option><option>Jewellery</option><option>Other</option></select></label><label>Sell price (GH₵)<input type="number" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="0.00" /></label><label>Cost price (GH₵)<input type="number" value={form.cost} onChange={(event) => update("cost", event.target.value)} placeholder="0.00" /></label><label>Opening quantity<input type="number" value={form.stock} onChange={(event) => update("stock", event.target.value)} placeholder="0" /></label><label>Reorder alert at<input type="number" value={form.reorderAt} onChange={(event) => update("reorderAt", event.target.value)} /></label><label>Unit<select value={form.unit} onChange={(event) => update("unit", event.target.value)}><option>piece</option><option>pair</option><option>pack</option><option>box</option></select></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!form.name || !form.price} onClick={() => onSave({ name: form.name, sku: form.sku || `DP-${Date.now().toString().slice(-4)}`, category: form.category, price: Number(form.price), cost: Number(form.cost) || 0, stock: Number(form.stock) || 0, reorderAt: Number(form.reorderAt) || 5, unit: form.unit })}>Add product</button></div></Modal>; }
function CustomerModal({ onClose, onSave }: { onClose: () => void; onSave: (customer: Omit<Customer, "id" | "credit" | "visits">) => void }) { const [name, setName] = useState(""); const [phone, setPhone] = useState(""); return <Modal title="Add customer" eyebrow="Customer book" onClose={onClose}><div className="form-grid"><label className="wide">Full name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Akosua Mensah" /></label><label className="wide">Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="024 000 0000" /></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!name} onClick={() => onSave({ name, phone })}>Create profile</button></div></Modal>; }
function PurchaseModal({ onClose, onSave }: { onClose: () => void; onSave: (purchase: Omit<Purchase, "id">) => void }) { const [supplier, setSupplier] = useState(""); const [amount, setAmount] = useState(""); const [status, setStatus] = useState<Purchase["status"]>("Pending"); return <Modal title="Record purchase" eyebrow="Supplier desk" onClose={onClose}><div className="form-grid"><label className="wide">Supplier name<input autoFocus value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="e.g. Accra Apparel Hub" /></label><label>Amount (GH₵)<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label>Order status<select value={status} onChange={(event) => setStatus(event.target.value as Purchase["status"])}><option>Pending</option><option>Received</option></select></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!supplier || !amount} onClick={() => onSave({ supplier, amount: Number(amount), status, date: "Today" })}>Save purchase</button></div></Modal>; }
function ExpenseModal({ onClose, onSave }: { onClose: () => void; onSave: (expense: Omit<Expense, "id">) => void }) { const [description, setDescription] = useState(""); const [category, setCategory] = useState("Utilities"); const [amount, setAmount] = useState(""); return <Modal title="Add expense" eyebrow="Operating costs" onClose={onClose}><div className="form-grid"><label className="wide">Description<input autoFocus value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Shop electricity" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Utilities</option><option>Logistics</option><option>Supplies</option><option>Rent</option><option>Other</option></select></label><label>Amount (GH₵)<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!description || !amount} onClick={() => onSave({ description, category, amount: Number(amount), date: "Today" })}>Save expense</button></div></Modal>; }
function AdjustStockModal({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (amount: number) => void }) { const [amount, setAmount] = useState(""); return <Modal title="Adjust stock" eyebrow={product.sku} onClose={onClose}><div className="adjust-product"><PackageOpen size={22} /><div><strong>{product.name}</strong><span>Current stock: {product.stock} {product.unit}s</span></div></div><label>Adjustment quantity<input autoFocus type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Use a negative number for a stock loss" /></label><p className="modal-note">Use this for counts, damages, returns, or corrections. Every adjustment should have a note in production.</p><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!amount || Number(amount) === 0} onClick={() => onSave(Number(amount))}>Save adjustment</button></div></Modal>; }
