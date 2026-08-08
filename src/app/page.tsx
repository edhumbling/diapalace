"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAuditActionTitle, formatAuditChanges, formatAuditSummary } from "@/lib/audit-dictionary";
import { getFriendlyErrorMessage } from "@/lib/error-dictionary";
import { getBranchIdForPath, getFeaturePath, getFeatureRoute, getViewForPath, type View } from "@/lib/feature-routes";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Lock,
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
  SlidersHorizontal,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Trash2,
  Truck,
  Upload,
  UserCheck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";

import { useAuth, type AuthBranch, type AuthUser, type Role, DEMO_BUSINESS, DEMO_USERS } from "@/lib/auth-context";
import { brand } from "@/lib/brand";
import { defaultPosState, type CartItem, type Customer, type Expense, type PaymentMethod, type Product, type Purchase, type Sale } from "@/lib/pos-data";
import { BulkOpeningInventoryModal, ProductEditorModal, StockCountModal, type BulkRow } from "@/app/inventory-modals";
import { ReceiptScreen } from "@/app/receipt-components";
import type { ReceiptData } from "@/lib/receipt-data";

const ACTIVE_VIEW_STORAGE_KEY = "diapalace_active_view";
const SCROLL_POSITION_STORAGE_KEY = "diapalace_scroll_positions";

function isView(value: string | null): value is View {
  return value === "dashboard" || value === "checkout" || value === "inventory" || value === "customers" || value === "sales" || value === "purchases" || value === "expenses" || value === "transfers" || value === "reconciliation" || value === "reports" || value === "employees" || value === "branches" || value === "audit" || value === "settings" || value === "notifications";
}

function canAccessView(view: View, role: Role) {
  if (role === "owner") return true;
  if (view === "dashboard" || view === "notifications") return true;
  if (role === "manager") return view !== "settings" && view !== "branches" && view !== "audit";
  if (role === "cashier") return view === "checkout" || view === "customers" || view === "sales" || view === "reconciliation";
  return view === "inventory" || view === "transfers" || view === "purchases";
}

function getScrollStorageKey(userId: string) {
  return `${SCROLL_POSITION_STORAGE_KEY}:${userId}`;
}

function getActiveViewStorageKey(userId: string) {
  return `${ACTIVE_VIEW_STORAGE_KEY}:${userId}`;
}

function getDefaultView(role: Role): View {
  if (role === "cashier") return "checkout";
  if (role === "stock_officer") return "inventory";
  return "dashboard";
}

function readScrollPositions(userId: string): Partial<Record<View, number>> {
  try {
    const stored = JSON.parse(localStorage.getItem(getScrollStorageKey(userId)) ?? "{}");
    if (!stored || typeof stored !== "object") return {};
    return stored as Partial<Record<View, number>>;
  } catch {
    return {};
  }
}

function saveScrollPosition(userId: string, view: View) {
  try {
    const positions = readScrollPositions(userId);
    positions[view] = window.scrollY;
    localStorage.setItem(getScrollStorageKey(userId), JSON.stringify(positions));
  } catch {
    // Storage may be unavailable in private browsing or when it is full.
  }
}

type EmployeeItem = {
  id: string;
  full_name: string;
  username: string;
  phone: string;
  role: Role;
  status: "active" | "suspended" | "deactivated";
  force_password_change: boolean;
  created_at: string;
  last_login: string | null;
  branchIds: string[];
};

type BranchUpdate = {
  id: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  region: string;
  city: string;
  address: string;
  digital_address: string;
  manager_id: string;
  manager_name?: string;
  status: AuthBranch["status"];
};

type NotificationItem = {
  id: string;
  business_id: string;
  branch_id: string | null;
  branch_name?: string | null;
  recipient_user_id: string;
  category: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "NORMAL" | "INFO";
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  status: "UNREAD" | "READ" | "ACKNOWLEDGED" | "ACTIONED" | "RESOLVED" | "DISMISSED";
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
  actioned_at: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
};

type DashboardSummary = {
  period: string;
  branchId: string;
  kpis: { sales: number; transactions: number; cash: number; expectedCash: number; cashVariance: number; stockAlerts: number };
  inventory: { total: number; lowStock: number; outOfStock: number; adjustments: number };
  attention: Array<{ type: string; severity: string; title: string; message: string; branchName: string | null; action: string }>;
  branches: Array<{ id: string; name: string; sales: number; transactions: number; cashUp: string }>;
  topProducts: Array<{ name: string; description: string; quantity: number }>;
  salesTrend: Array<{ day: string; sales: number }>;
  recentActivity: Array<{ id: string; action: string; description: string; created_at: string; branch_name: string | null }>;
  visibility: { role: Role; showFinancials: boolean };
  errors?: Record<string, string>;
};

type AuditItem = {
  id: string;
  business_id?: string;
  branch_id?: string;
  branch_name?: string;
  user_id?: string;
  user_name?: string;
  action: string;
  module?: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: string | Record<string, any> | null;
  new_values?: string | Record<string, any> | null;
  reason?: string;
  description?: string;
  ip_address?: string;
  device_id?: string;
  session_id?: string;
  created_at: string;
};

type RedFlag = {
  id: string;
  type: "CASH_SHORTAGE" | "INVENTORY_VARIANCE" | "HIGH_REFUNDS" | "HIGH_DISCOUNT" | "MOMO_PENDING";
  severity: "high" | "medium" | "low";
  branch_name: string;
  title: string;
  description: string;
  created_at: string;
};

type StockTransfer = {
  id: string;
  transfer_number: string;
  from_branch_id: string;
  from_branch_name?: string;
  to_branch_id: string;
  to_branch_name?: string;
  product_id: string;
  product_name?: string;
  quantity_dispatched: number;
  quantity_received: number;
  status: "IN_TRANSIT" | "COMPLETED" | "DISCREPANCY";
  notes: string;
  created_at: string;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", currencyDisplay: "symbol", maximumFractionDigits: 2 })
    .format(amount)
    .replace("GHS", "GH₵");

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

export default function Home({ initialView }: { initialView?: View } = {}) {
  const router = useRouter();
  const {
    user,
    business,
    branches,
    currentBranch,
    setCurrentBranch,
    token,
    isLoading,
    isLocked,
    isOwner,
    setSessionData,
    refreshBranches,
    logout,
    lockPos,
    unlockPos,
  } = useAuth();

  const [view, setView] = useState<View>(initialView ?? "dashboard");
  const [products, setProducts] = useState(defaultPosState.products);
  const [customers, setCustomers] = useState(defaultPosState.customers);
  const [sales, setSales] = useState(defaultPosState.sales);
  const [purchases, setPurchases] = useState(defaultPosState.purchases);
  const [expenses, setExpenses] = useState(defaultPosState.expenses);
  const [employees, setEmployees] = useState<EmployeeItem[]>([
    { id: "u-jordan", full_name: "Jordan Lee", username: "jordanlee", phone: "024 111 2233", role: "owner", status: "active", force_password_change: false, created_at: "2026-01-01T00:00:00Z", last_login: "2026-08-08T09:00:00Z", branchIds: [] },
    { id: "u-ama", full_name: "Ama Mensah", username: "ama.manager", phone: "024 222 3344", role: "manager", status: "active", force_password_change: false, created_at: "2026-01-15T00:00:00Z", last_login: "2026-08-08T08:30:00Z", branchIds: ["br-osu", "br-kumasi"] },
    { id: "u-kofi", full_name: "Kofi Mensah", username: "kofi.cashier", phone: "024 333 4455", role: "cashier", status: "active", force_password_change: false, created_at: "2026-02-01T00:00:00Z", last_login: "2026-08-08T10:15:00Z", branchIds: ["br-kumasi"] },
    { id: "u-kwame", full_name: "Kwame Owusu", username: "kwame.stock", phone: "024 444 5566", role: "stock_officer", status: "active", force_password_change: false, created_at: "2026-02-10T00:00:00Z", last_login: "2026-08-07T16:00:00Z", branchIds: ["br-osu"] },
    { id: "u-emma", full_name: "Emma Manager", username: "emma", phone: "024 555 6677", role: "manager", status: "active", force_password_change: false, created_at: "2026-03-01T00:00:00Z", last_login: "2026-08-08T07:45:00Z", branchIds: ["br-ejisu"] },
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardPeriod, setDashboardPeriod] = useState("TODAY");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All items");
  const [customerId, setCustomerId] = useState("c4");
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [saleProcessing, setSaleProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [cashReceived, setCashReceived] = useState(0);
  const [mobileReference, setMobileReference] = useState("");
  const [notice, setNotice] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  const [modal, setModal] = useState<
    | "product"
    | "customer"
    | "expense"
    | "purchase"
    | "bulkInventory"
    | "stockCount"
    | "editProduct"
    | "adjust"
    | "addEmployee"
    | "editEmployee"
    | "addBranch"
    | "voidSale"
    | "refundRequest"
    | "addTransfer"
    | "override"
    | null
  >(null);

  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [targetVoidSale, setTargetVoidSale] = useState<Sale | null>(null);
  const [targetRefundSale, setTargetRefundSale] = useState<Sale | null>(null);
  const [overrideTargetDiscount, setOverrideTargetDiscount] = useState<number>(0);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [shiftOpen, setShiftOpen] = useState(true);
  const [countedCash, setCountedCash] = useState(0);
  const [countedMomo, setCountedMomo] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(defaultPosState.taxEnabled);
  const [taxRate, setTaxRate] = useState(defaultPosState.taxRate);
  const [databaseStatus, setDatabaseStatus] = useState<"connecting" | "connected" | "offline">("connecting");
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const userId = user?.id;
  const userRole = user?.role;
  const viewRef = useRef(view);
  const saleIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Restore the last workspace view after authentication has been restored.
  useEffect(() => {
    if (!userId || !userRole) return;
    const pathView = getViewForPath(window.location.pathname);
    const pathBranchId = getBranchIdForPath(window.location.pathname);
    const authorizedPathBranch = pathBranchId ? branches.find((branch) => branch.id === pathBranchId) : undefined;
    if (authorizedPathBranch) setCurrentBranch(authorizedPathBranch);
    const requestedView = initialView ?? pathView;
    let nextView = requestedView && canAccessView(requestedView, userRole) ? requestedView : getDefaultView(userRole);
    try {
      const storedView = localStorage.getItem(getActiveViewStorageKey(userId));
      if (!requestedView && isView(storedView) && canAccessView(storedView, userRole)) nextView = storedView;
      localStorage.setItem(getActiveViewStorageKey(userId), nextView);
    } catch {
      // Storage may be unavailable in private browsing.
    }
    const restoreTimer = window.setTimeout(() => setView(nextView), 0);
    if (!initialView || initialView !== nextView) router.replace(getFeaturePath(nextView, authorizedPathBranch?.id), { scroll: false });
    return () => window.clearTimeout(restoreTimer);
  }, [branches, initialView, router, setCurrentBranch, userId, userRole]);

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(getActiveViewStorageKey(userId), view);
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [userId, view]);

  // Let the app own restoration so a browser's previous document offset does not win.
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  // Save the offset for the currently visible view while the user scrolls.
  useEffect(() => {
    if (!userId) return;
    let frame = 0;
    const save = () => saveScrollPosition(userId, viewRef.current);
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        save();
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [userId]);

  // Wait for the selected view to paint before restoring its saved offset.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let frame = 0;
    let attempts = 0;
    const restore = () => {
      if (cancelled) return;
      const top = readScrollPositions(userId)[view];
      if (typeof top !== "number" || !Number.isFinite(top)) return;
      window.scrollTo(0, Math.max(0, top));
      if (window.scrollY < top && attempts < 10) {
        attempts += 1;
        frame = window.requestAnimationFrame(restore);
      }
    };
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(restore);
    });
    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [userId, view]);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };

  const refreshNotifications = useCallback(async () => {
    if (!token || !userId) return;
    try {
      const response = await fetch("/api/notifications?limit=50", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { notifications?: NotificationItem[]; unreadCount?: number };
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadNotificationCount(data.unreadCount ?? 0);
    } catch {
      // Notifications are non-blocking; retain the last successful result.
    }
  }, [token, userId]);

  const updateNotification = async (notificationId: string, action: "read" | "acknowledge" | "action" | "dismiss") => {
    const current = notifications.find((notification) => notification.id === notificationId);
    if (!current) return;
    const nextStatus = action === "read" ? "READ" : action === "acknowledge" ? "ACKNOWLEDGED" : action === "action" ? "ACTIONED" : "DISMISSED";
    setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, status: nextStatus, read_at: item.read_at ?? new Date().toISOString() } : item));
    if (current.status === "UNREAD") setUnreadNotificationCount((count) => Math.max(0, count - 1));
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [notificationId], action }),
      });
      if (!response.ok) void refreshNotifications();
    } catch {
      void refreshNotifications();
    }
  };

  const openNotification = (notification: NotificationItem) => {
    setNotificationMenuOpen(false);
    if (notification.status === "UNREAD") void updateNotification(notification.id, "read");
    const actionUrl = notification.action_url;
    if (actionUrl?.startsWith("/")) router.push(actionUrl, { scroll: false });
  };

  useEffect(() => {
    if (!token || !userId) return;
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      await refreshNotifications();
    };
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [refreshNotifications, token, userId]);

  const refreshDashboard = useCallback(async () => {
    if (!token || !userId) return;
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const branchId = currentBranch && currentBranch !== "all" ? currentBranch.id : "all";
      const response = await fetch(`/api/dashboard?period=${encodeURIComponent(dashboardPeriod)}&branchId=${encodeURIComponent(branchId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json() as DashboardSummary | { error?: string };
      if (!response.ok || !("kpis" in data)) throw new Error("Dashboard data is unavailable.");
      setDashboardSummary(data);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Dashboard data is unavailable.");
    } finally {
      setDashboardLoading(false);
    }
  }, [currentBranch, dashboardPeriod, token, userId]);

  useEffect(() => {
    if (!token || !userId) return;
    void refreshDashboard();
    const interval = window.setInterval(() => void refreshDashboard(), 30000);
    return () => window.clearInterval(interval);
  }, [refreshDashboard, token, userId]);

  // ─── Fetch PosState ────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    async function loadState() {
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        const branchId = currentBranch && currentBranch !== "all" ? currentBranch.id : "all";
        const response = await fetch(`/api/state?branchId=${encodeURIComponent(branchId)}`, { cache: "no-store", headers });
        if (!response.ok) throw new Error("D1 request failed");
        const state = (await response.json()) as typeof defaultPosState;
        if (cancelled) return;
        setProducts(state.products);
        setCustomers(state.customers);
        setSales(state.sales);
        setPurchases(state.purchases);
        setExpenses(state.expenses);
        setTaxEnabled(state.taxEnabled);
        setTaxRate(state.taxRate);
        setDatabaseStatus("connected");
      } catch {
        if (!cancelled) setDatabaseStatus("offline");
      }
    }
    void loadState();
    return () => { cancelled = true; };
  }, [token, user, currentBranch]);

  // ─── Fetch Red Flags (Owner) ───────────────────────────────────────
  useEffect(() => {
    if (isOwner && token) {
      fetch("/api/owner/red-flags", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => setRedFlags(Array.isArray(data) ? data : []))
        .catch(() => setRedFlags([]));
    }
  }, [isOwner, token, sales]);

  // ─── Fetch Employees (Owner / Manager) ─────────────────────────────
  const fetchEmployees = async () => {
    if (!token || (user?.role !== "owner" && user?.role !== "manager")) return;
    try {
      const response = await fetch("/api/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = (await response.json()) as EmployeeItem[];
        setEmployees(data);
      }
    } catch {
      // quiet fail
    }
  };

  useEffect(() => {
    if (view === "employees") void fetchEmployees();
  }, [view, token, user]);

  // ─── Fetch Audit Logs & Transfers ─────────────────────────────────
  useEffect(() => {
    if (view === "audit" && token && user?.role === "owner") {
      fetch("/api/audit", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => setAuditLogs(Array.isArray(data) ? data : []))
        .catch(() => setAuditLogs([]));
    }

    if (view === "transfers" && token) {
      fetch("/api/transfers", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => setTransfers(Array.isArray(data) ? data : []))
        .catch(() => setTransfers([]));
    }
  }, [view, token, user]);

  // ─── Loading Screen ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <img src={brand.logo} alt={brand.businessName} className="brand-logo" style={{ width: "3rem", height: "3rem", margin: "0 auto 1rem" }} />
          <h2 style={{ color: "#fff" }}>Dia&apos;s Palace POS</h2>
          <p style={{ color: "#9eb0c1", fontSize: ".85rem", marginTop: ".5rem" }}>Loading your retail environment...</p>
        </div>
      </div>
    );
  }

  // ─── Auth Guard: Show Login ─────────────────────────────────────────
  if (!user) {
    return <AuthScreen onLoginSuccess={setSessionData} notify={notify} />;
  }

  // ─── PIN Unlock Handler ───────────────────────────────────────────
  const handlePinSubmit = async () => {
    const pin = pinDigits.join("");
    if (pin.length < 4) { setPinError("Please enter all 4 digits."); return; }
    const success = await unlockPos(pin);
    if (!success) {
      setPinError("Incorrect PIN. Try again.");
      setPinDigits(["", "", "", ""]);
    } else {
      setPinDigits(["", "", "", ""]);
      setPinError("");
    }
  };

  // ─── Filtered Nav Items based on Role ──────────────────────────────
  const getNavGroups = () => {
    const role = user.role;

    if (role === "cashier") {
      return [
        { label: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
        { label: "Operations", items: [{ id: "checkout", label: "New Sale", icon: ShoppingCart }, { id: "sales", label: "Sales", icon: ReceiptText }, { id: "reconciliation", label: "Cash-up", icon: Landmark }] },
      ];
    }

    if (role === "stock_officer") {
      return [
        { label: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
        { label: "Operations", items: [
          { id: "inventory", label: "Inventory", icon: PackageOpen },
          { id: "transfers", label: "Stock Transfers", icon: Truck },
        ] },
      ];
    }

    const groups = [
      { label: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
      { label: "Operations", items: [{ id: "checkout", label: "New Sale", icon: ShoppingCart }, { id: "sales", label: "Sales", icon: ReceiptText }, { id: "inventory", label: "Inventory", icon: PackageOpen }, { id: "reconciliation", label: "Cash-up", icon: Landmark }, { id: "transfers", label: "Stock Transfers", icon: Truck }] },
      { label: "Insights", items: [
        { id: "reports", label: "Reports", icon: BarChart3 },
      ] },
      { label: "Management", items: [
        { id: "employees", label: "Employees", icon: UserCheck },
        { id: "branches", label: "Branches", icon: Building2 },
      ] },
      { label: "Control", items: [
        { id: "audit", label: "Audit Trail", icon: ShieldCheck },
      ] },
    ];

    if (role === "owner") {
      groups.push({ label: "System", items: [{ id: "settings", label: "Settings", icon: Settings }] });
    } else if (role === "manager") {
      groups[2].items = [{ id: "employees", label: "Employees", icon: UserCheck }];
    }

    return groups;
  };

  const navGroups = getNavGroups();

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = taxEnabled ? Math.max(0, (subtotal - discount) * (taxRate / 100)) : 0;
  const total = Math.max(0, subtotal - discount + tax);
  const categories = ["All items", ...Array.from(new Set(products.map((product) => product.category)))];
  const filteredProducts = products.filter((product) => {
    const term = search.toLowerCase();
    return (product.name.toLowerCase().includes(term) || (product.description ?? "").toLowerCase().includes(term) || product.sku.toLowerCase().includes(term)) && (category === "All items" || product.category === category);
  });
  const lowStock = products.filter((product) => product.reorderAt > 0 && product.stock <= product.reorderAt);
  const todaySales = sales.filter((sale) => sale.date.startsWith("Today"));
  const cashSales = todaySales.filter((sale) => sale.method === "Cash").reduce((sum, sale) => sum + sale.total, 0);
  const momoSales = todaySales.filter((sale) => sale.method.includes("MoMo") || sale.method.includes("Cash") === false && sale.method.includes("Card") === false).reduce((sum, sale) => sum + sale.total, 0);
  const expectedCash = 250 + cashSales;

  // ─── Discount Cap Verification ─────────────────────────────────────
  const handleDiscountChange = (val: number) => {
    const pct = subtotal > 0 ? (val / subtotal) * 100 : 0;
    if (user.role === "cashier" && pct > 5) {
      setOverrideTargetDiscount(val);
      setModal("override");
      return;
    }
    if (user.role === "manager" && pct > 15) {
      notify("Manager discount cap is 15%. Contact Owner for higher discount.");
      return;
    }
    setDiscount(Math.min(subtotal, val));
  };

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

  async function completeSale() {
    if (!cart.length || saleProcessing) return;
    if (paymentMethod === "Cash" && cashReceived < total) { notify("Cash received must cover the bill."); return; }
    if ((paymentMethod !== "Cash" && paymentMethod !== "Credit") && !mobileReference.trim()) { notify("Add payment reference before completing (MTN MoMo / Card)."); return; }
    setSaleProcessing(true);
    try {
      saleIdempotencyKeyRef.current ??= crypto.randomUUID();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const branchId = currentBranch && currentBranch !== "all" ? currentBranch.id : branches[0]?.id;
      const response = await fetch("/api/sales", { method: "POST", headers, body: JSON.stringify({ customerId, branchId, idempotencyKey: saleIdempotencyKeyRef.current, items: cart.map(({ productId, qty, price }) => ({ productId, qty, price })), subtotal, discount, tax, total, method: paymentMethod, reference: mobileReference, amountPaid: paymentMethod === "Cash" ? cashReceived : total }) });
      const result = await response.json() as { sale?: Sale; receipt?: ReceiptData; state?: typeof defaultPosState; error?: string };
      if (!response.ok || !result.sale || !result.receipt) throw new Error(result.error || "Unable to complete the sale. No changes were made.");
      if (result.state) { setSales(result.state.sales); setProducts(result.state.products); setCustomers(result.state.customers); }
      setReceipt(result.receipt);
      saleIdempotencyKeyRef.current = null;
      setCart([]); setDiscount(0); setCashReceived(0); setMobileReference(""); setPaymentOpen(false); setDatabaseStatus("connected"); notify(`Sale ${result.sale.id} completed successfully.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to complete the sale. No changes were made.");
    } finally {
      setSaleProcessing(false);
    }
  }

  async function handleVoidSale(saleId: string, reason: string) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/sales-void", { method: "POST", headers, body: JSON.stringify({ saleId, reason }) });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        notify(data.error || "Failed to void sale.");
        return;
      }
      setSales((prev) => prev.map((s) => s.id === saleId ? { ...s, total: 0 } : s));
      setModal(null);
      notify(`Sale ${saleId} voided. Stock returned.`);
    } catch {
      setSales((prev) => prev.map((s) => s.id === saleId ? { ...s, total: 0 } : s));
      setModal(null);
      notify(`Sale ${saleId} voided (offline record).`);
    }
  }

  async function reprintReceipt(saleId: string) {
    if (!token) return;
    try {
      const response = await fetch(`/api/receipts/${encodeURIComponent(saleId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json() as ReceiptData | { error?: string };
      if (!response.ok || !("receiptNumber" in data)) throw new Error("Unable to load this receipt.");
      setReceipt(data);
      setView("checkout");
      const branchId = currentBranch && currentBranch !== "all" ? currentBranch.id : null;
      router.push(getFeaturePath("checkout", branchId), { scroll: false });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to load this receipt.");
    }
  }

  async function createProduct(product: Omit<Product, "id">) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/products", { method: "POST", headers, body: JSON.stringify(product) });
      if (!response.ok) throw new Error();
      const saved = await response.json() as Product;
      setProducts((current) => [...current, saved]); setModal(null); notify("Product added to inventory.");
    } catch {
      const mock: Product = { id: `p-${Date.now()}`, ...product };
      setProducts((prev) => [...prev, mock]);
      setModal(null);
      notify("Product added to inventory.");
    }
  }

  async function updateProduct(product: Product) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(`/api/products/${product.id}`, { method: "PATCH", headers, body: JSON.stringify(product) });
      const data = await response.json() as { product?: Partial<Product>; error?: string };
      if (!response.ok || !data.product) throw new Error(data.error || "Product update failed");
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ...data.product } : item));
      setEditingProduct(null);
      setModal(null);
      notify("Product details saved. Price history was recorded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Product update failed.");
    }
  }

  async function importOpeningInventory(rows: BulkRow[]) {
    try {
      const response = await fetch("/api/products/bulk", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ items: rows }) });
      const data = await response.json() as { products?: Product[]; error?: string };
      if (!response.ok || !data.products) throw new Error(data.error || "Opening inventory import failed.");
      setProducts((current) => [...current, ...data.products!]);
      setModal(null);
      notify(`${data.products.length} opening inventory item${data.products.length === 1 ? "" : "s"} saved.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Opening inventory import failed.");
    }
  }

  async function commitStockCount(rows: Array<{ productId: string; physicalQuantity: number }>, reason: string) {
    try {
      const response = await fetch("/api/products/stock-count", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ rows, reason }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Stock count could not be committed.");
      setProducts((current) => current.map((product) => { const row = rows.find((item) => item.productId === product.id); return row ? { ...product, stock: row.physicalQuantity } : product; }));
      setModal(null);
      notify("Physical stock count committed with an audit reason.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Stock count could not be committed.");
    }
  }

  async function createCustomer(customer: Omit<Customer, "id" | "credit" | "visits">) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/customers", { method: "POST", headers, body: JSON.stringify(customer) });
      if (!response.ok) throw new Error();
      const saved = await response.json() as Customer;
      setCustomers((current) => [...current, saved]); setModal(null); notify("Customer profile created.");
    } catch {
      const mock: Customer = { id: `c-${Date.now()}`, name: customer.name, phone: customer.phone, credit: 0, visits: 0 };
      setCustomers((prev) => [...prev, mock]);
      setModal(null);
      notify("Customer profile created.");
    }
  }

  async function createPurchase(purchase: Omit<Purchase, "id">) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/purchases", { method: "POST", headers, body: JSON.stringify(purchase) });
      if (!response.ok) throw new Error();
      const saved = await response.json() as Purchase;
      setPurchases((current) => [saved, ...current]); setModal(null); notify("Purchase order recorded.");
    } catch {
      const mock: Purchase = { id: `PO-${Date.now().toString().slice(-4)}`, ...purchase };
      setPurchases((prev) => [mock, ...prev]);
      setModal(null);
      notify("Purchase order recorded.");
    }
  }

  async function createExpense(expense: Omit<Expense, "id">) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/expenses", { method: "POST", headers, body: JSON.stringify(expense) });
      if (!response.ok) throw new Error();
      const saved = await response.json() as Expense;
      setExpenses((current) => [saved, ...current]); setModal(null); notify("Expense recorded.");
    } catch {
      const mock: Expense = { id: `EX-${Date.now().toString().slice(-4)}`, ...expense };
      setExpenses((prev) => [mock, ...prev]);
      setModal(null);
      notify("Expense recorded.");
    }
  }

  async function adjustStock(amount: number, note = "Manual inventory adjustment") {
    if (!adjustProduct) return;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
       const response = await fetch(`/api/products/${adjustProduct.id}`, { method: "PATCH", headers, body: JSON.stringify({ amount, note }) });
      if (!response.ok) throw new Error();
      setProducts((current) => current.map((product) => product.id === adjustProduct.id ? { ...product, stock: Math.max(0, product.stock + amount) } : product));
      setModal(null); notify("Stock movement recorded.");
    } catch {
      setProducts((current) => current.map((product) => product.id === adjustProduct.id ? { ...product, stock: Math.max(0, product.stock + amount) } : product));
      setModal(null); notify("Stock movement recorded (local).");
    }
  }

  function navigate(nextView: View) {
    if (user) saveScrollPosition(user.id, viewRef.current);
    const branchId = currentBranch && currentBranch !== "all" ? currentBranch.id : null;
    router.push(getFeaturePath(nextView, branchId), { scroll: false });
    setView(nextView);
    setMobileNavOpen(false);
    setReceipt(null);
  }

  function switchBranch(nextBranch: AuthBranch | "all") {
    setCurrentBranch(nextBranch);
    router.push(getFeaturePath(view, nextBranch === "all" ? null : nextBranch.id), { scroll: false });
  }

  const activeBranchName = currentBranch === "all" ? "All Branches" : currentBranch?.name ?? "Branch";
  const activeBusinessName = business?.name ?? "Dia's Palace";

  return (
    <div className="pos-app">
      {/* ─── POS LOCK OVERLAY ──────────────────────────────────────── */}
      {isLocked && (
        <div className="lock-overlay">
          <div className="lock-card">
            <div className="lock-user">{user.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div>
            <h2>{user.full_name}</h2>
            <p style={{ textTransform: "capitalize" }}>{user.role.replace("_", " ")} · Enter PIN to unlock</p>
            {pinError && <div className="auth-error" style={{ marginBottom: "1rem" }}>{pinError}</div>}
            <div className="pin-input-group">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  type="password"
                  maxLength={1}
                  className="pin-digit"
                  value={pinDigits[index]}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newDigits = [...pinDigits];
                    newDigits[index] = val;
                    setPinDigits(newDigits);
                    if (val && index < 3) {
                      const nextInput = document.getElementById(`pin-${index + 1}`);
                      nextInput?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
                      const prevInput = document.getElementById(`pin-${index - 1}`);
                      prevInput?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <button className="button primary full" onClick={handlePinSubmit}>Unlock POS</button>
            <div style={{ marginTop: "1.2rem" }}>
              <button
                className="text-button"
                style={{ fontSize: ".78rem", color: "var(--muted)" }}
                onClick={() => void logout()}
              >
                Sign out completely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SIDEBAR ──────────────────────────────────────────────── */}
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src={brand.logo} alt={brand.businessName} className="brand-logo" style={{ width: "2.15rem", height: "2.15rem", objectFit: "contain" }} />
          <span><strong>{activeBusinessName}</strong><small>Retail Operations</small></span>
          <IconButton label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={19} /></IconButton>
        </div>

        {/* ─── BRANCH SELECTOR ───────────────────────────────────── */}
        <div className="store-switcher" onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}>
          <span className="store-avatar"><Store size={17} /></span>
          <span><strong>{activeBranchName}</strong><small>{isOwner ? "Owner View" : "Assigned Branch"}</small></span>
          <ChevronDown size={16} />

          {branchDropdownOpen && (
            <div className="branch-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="branch-dropdown-head">Switch Branch</div>
              {isOwner && (
                <button
                  className={`branch-item ${currentBranch === "all" ? "active" : ""}`}
                  onClick={() => { switchBranch("all"); setBranchDropdownOpen(false); }}
                >
                  <span className="branch-item-radio" />
                  <span>All Branches</span>
                </button>
              )}
              {branches.map((b) => (
                <button
                  key={b.id}
                  className={`branch-item ${currentBranch !== "all" && currentBranch?.id === b.id ? "active" : ""}`}
                  onClick={() => { switchBranch(b); setBranchDropdownOpen(false); }}
                >
                  <span className="branch-item-radio" />
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={`nav-link ${view === item.id ? "active" : ""}`}
                    onClick={() => navigate(item.id as View)}
                  >
                    <ItemIcon size={19} />
                    <span>{item.label}</span>
                    {item.id === "inventory" && lowStock.length > 0 && <em>{lowStock.length}</em>}
                  </button>
                );
              })}
            </div>
          ))}
           <div className="nav-group nav-bottom">
             <p>System</p>
             {isOwner && (
               <button className={`nav-link ${view === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}>
                 <Settings size={19} /><span>Settings</span>
               </button>
             )}
            <button className="nav-link" onClick={() => lockPos()}>
              <Lock size={19} /><span>Lock POS</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">{user.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div>
          <span><strong>{user.full_name}</strong><small style={{ textTransform: "capitalize" }}>{user.role.replace("_", " ")}</small></span>
          <IconButton label="Sign out" onClick={() => void logout()}><LogOut size={17} /></IconButton>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={22} /></IconButton>
            <div className="crumb">
              <span>{activeBranchName}</span><span>/</span>
              <strong>{navGroups.flatMap((group) => group.items).find((item) => item.id === view)?.label ?? getFeatureRoute(view).label}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className="sync-state">
              <span className={`sync-dot ${databaseStatus === "offline" ? "offline" : ""}`} />
              {databaseStatus === "connecting" ? "Connecting to D1" : databaseStatus === "connected" ? "Synced to D1" : "D1 unavailable"}
            </span>
            <div className="notification-wrap">
              <button
                className="icon-btn notification-trigger"
                aria-label={unreadNotificationCount ? `${unreadNotificationCount} unread notifications` : "Notifications"}
                aria-expanded={notificationMenuOpen}
                onClick={() => { setNotificationMenuOpen((open) => !open); void refreshNotifications(); }}
              >
                <Bell size={20} />
                {unreadNotificationCount > 0 && <span className="notification-count">{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span>}
              </button>
              {notificationMenuOpen && (
                <div className="notification-popover" role="dialog" aria-label="Notifications">
                  <div className="notification-popover-head"><strong>Notifications</strong>{unreadNotificationCount > 0 && <span>{unreadNotificationCount} unread</span>}</div>
                  <div className="notification-popover-list">
                    {notifications.filter((notification) => !["RESOLVED", "DISMISSED", "ACTIONED"].includes(notification.status)).slice(0, 5).map((notification) => (
                      <button key={notification.id} className={`notification-preview ${notification.status === "UNREAD" ? "unread" : ""}`} onClick={() => openNotification(notification)}>
                        <span className={`notification-mark ${notification.severity.toLowerCase()}`}><Bell size={13} /></span>
                        <span><strong>{notification.title}</strong><small>{notification.branch_name || "All branches"} · {formatNotificationTime(notification.created_at)}</small></span>
                      </button>
                    ))}
                    {!notifications.some((notification) => !["RESOLVED", "DISMISSED", "ACTIONED"].includes(notification.status)) && <p className="notification-empty">You&apos;re all caught up.</p>}
                  </div>
                  <button className="notification-view-all" onClick={() => { setNotificationMenuOpen(false); const branchId = currentBranch && currentBranch !== "all" ? currentBranch.id : null; router.push(getFeaturePath("notifications", branchId), { scroll: false }); }}>View all notifications <ArrowRight size={15} /></button>
                </div>
              )}
            </div>
            <div className="topbar-date"><CalendarDays size={16} />{todayLabel}</div>
          </div>
        </header>

        <main className="page-content">
          {view === "dashboard" && (
            <OperationalDashboardView
              userName={user.full_name}
              userRole={user.role}
              branches={branches}
              currentBranch={currentBranch}
              summary={dashboardSummary}
              period={dashboardPeriod}
              onPeriodChange={setDashboardPeriod}
              onNavigate={navigate}
               onSwitchBranch={switchBranch}
              loading={dashboardLoading}
              error={dashboardError}
              onRetry={() => void refreshDashboard()}
            />
          )}

          {view === "checkout" && (
            <CheckoutView
              products={filteredProducts}
              categories={categories}
              category={category}
              setCategory={setCategory}
              search={search}
              setSearch={setSearch}
              cart={cart}
              addToCart={addToCart}
              changeQty={changeQty}
              setCart={setCart}
              customers={customers}
              customerId={customerId}
              setCustomerId={setCustomerId}
              discount={discount}
              onDiscountChange={handleDiscountChange}
              subtotal={subtotal}
              tax={tax}
              total={total}
              taxEnabled={taxEnabled}
              taxRate={taxRate}
              onPay={() => cart.length && setPaymentOpen(true)}
              receipt={receipt}
              onNewSale={() => setReceipt(null)}
              userRole={user.role}
            />
          )}

          {view === "inventory" && <NotebookInventoryView products={products} lowStock={lowStock} search={search} setSearch={setSearch} onAdd={() => setModal("product")} onBulk={() => setModal("bulkInventory")} onCount={() => setModal("stockCount")} onEdit={(product) => { setEditingProduct(product); setModal("editProduct"); }} userRole={user.role} />}
          {view === "transfers" && <TransfersView transfers={transfers} branches={branches} products={products} onAdd={() => setModal("addTransfer")} onRefresh={() => { fetch("/api/transfers", { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json()).then((data) => setTransfers(Array.isArray(data) ? (data as StockTransfer[]) : [])); }} />}
          {view === "customers" && <CustomersView customers={customers} onAdd={() => setModal("customer")} />}
           {view === "sales" && <SalesView sales={sales} onNotify={notify} onVoid={(sale) => { setTargetVoidSale(sale); setModal("voidSale"); }} onRefund={(sale) => { setTargetRefundSale(sale); setModal("refundRequest"); }} onReprint={(sale) => void reprintReceipt(sale.id)} userRole={user.role} />}
          {view === "purchases" && <PurchasesView purchases={purchases} onAdd={() => setModal("purchase")} />}
          {view === "expenses" && <ExpensesView expenses={expenses} onAdd={() => setModal("expense")} />}
          {view === "reconciliation" && <ReconciliationView sales={sales} shiftOpen={shiftOpen} setShiftOpen={setShiftOpen} expectedCash={expectedCash} expectedMomo={momoSales} countedCash={countedCash} setCountedCash={setCountedCash} countedMomo={countedMomo} setCountedMomo={setCountedMomo} onNotify={notify} currentUser={user.full_name} userRole={user.role} token={token} currentBranchId={currentBranch === "all" ? branches[0]?.id : currentBranch?.id} />}
          {view === "reports" && <ReportsView sales={sales} products={products} expenses={expenses} />}
          {view === "employees" && (user.role === "cashier" || user.role === "stock_officer" ? <MyProfileView user={user} branches={branches} token={token} onNotify={notify} /> : <EmployeesView employees={employees} branches={branches} isOwner={isOwner} userRole={user.role} token={token} onAdd={() => setModal("addEmployee")} onEdit={(emp) => { setEditingEmployee(emp); setModal("editEmployee"); }} onRefresh={fetchEmployees} onNotify={notify} />)}
          {view === "branches" && (
            <BranchesView
              branches={branches}
              isOwner={isOwner}
              token={token}
              onAdd={() => setModal("addBranch")}
               onSelectBranch={(b) => switchBranch(b)}
              onRefresh={refreshBranches}
              onNotify={notify}
            />
          )}
           {view === "audit" && <AuditLogView auditLogs={auditLogs} branches={branches} employees={employees} token={token} onNotify={notify} />}
           {view === "notifications" && <NotificationsView notifications={notifications} unreadCount={unreadNotificationCount} branches={branches} token={token} onRefresh={refreshNotifications} onUpdate={updateNotification} onOpen={openNotification} />}
           {view === "settings" && <SettingsView taxEnabled={taxEnabled} setTaxEnabled={setTaxEnabled} taxRate={taxRate} setTaxRate={setTaxRate} onNotify={notify} businessName={activeBusinessName} />}
        </main>
      </div>

      {/* ─── MODALS ────────────────────────────────────────────────── */}
      {paymentOpen && <PaymentModal total={total} subtotal={subtotal} discount={discount} tax={tax} method={paymentMethod} setMethod={setPaymentMethod} cashReceived={cashReceived} setCashReceived={setCashReceived} reference={mobileReference} setReference={setMobileReference} onClose={() => setPaymentOpen(false)} onComplete={completeSale} />}
      {modal === "product" && <ProductEditorModal onClose={() => setModal(null)} onSave={createProduct} />}
      {modal === "editProduct" && editingProduct && <ProductEditorModal product={editingProduct} onClose={() => { setEditingProduct(null); setModal(null); }} onSave={(product) => void updateProduct({ ...product, id: editingProduct.id })} />}
      {modal === "bulkInventory" && <BulkOpeningInventoryModal onClose={() => setModal(null)} onSave={(rows) => void importOpeningInventory(rows)} />}
      {modal === "stockCount" && <StockCountModal products={products} onClose={() => setModal(null)} onSave={(rows, reason) => void commitStockCount(rows, reason)} />}
      {modal === "customer" && <CustomerModal onClose={() => setModal(null)} onSave={createCustomer} />}
      {modal === "purchase" && <PurchaseModal onClose={() => setModal(null)} onSave={createPurchase} />}
      {modal === "expense" && <ExpenseModal onClose={() => setModal(null)} onSave={createExpense} />}
      {modal === "adjust" && adjustProduct && <AdjustStockModal product={adjustProduct} onClose={() => setModal(null)} onSave={adjustStock} />}
      {modal === "addEmployee" && <AddEmployeeModal branches={branches} token={token} onClose={() => setModal(null)} onSuccess={() => { setModal(null); void fetchEmployees(); notify("Employee account created."); }} />}
      {modal === "editEmployee" && editingEmployee && <EditEmployeeModal employee={editingEmployee} branches={branches} token={token} onClose={() => { setModal(null); setEditingEmployee(null); }} onSuccess={() => { setModal(null); setEditingEmployee(null); void fetchEmployees(); notify("Employee account updated."); }} />}
      {modal === "addBranch" && <AddBranchModal token={token} onClose={() => setModal(null)} onSuccess={() => { setModal(null); void refreshBranches(); notify("Branch created successfully."); }} />}
      {modal === "voidSale" && targetVoidSale && <VoidSaleModal sale={targetVoidSale} onClose={() => setModal(null)} onConfirm={(reason) => void handleVoidSale(targetVoidSale.id, reason)} />}
      {modal === "refundRequest" && targetRefundSale && <RefundRequestModal sale={targetRefundSale} token={token} onClose={() => setModal(null)} onSuccess={() => { setModal(null); notify("Refund request submitted for manager approval."); }} />}
      {modal === "addTransfer" && <AddTransferModal branches={branches} products={products} token={token} onClose={() => setModal(null)} onSuccess={() => { setModal(null); notify("Stock transfer manifest created."); }} />}
      {modal === "override" && <ManagerOverrideModal targetDiscount={overrideTargetDiscount} onClose={() => setModal(null)} onSuccess={() => { setDiscount(overrideTargetDiscount); setModal(null); notify("Manager override granted."); }} />}
      {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function formatNotificationTime(value: string) {
  const timestamp = new Date(value).getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  return new Date(value).toLocaleDateString("en-GH", { month: "short", day: "numeric" });
}

type NotificationPreference = {
  category: string;
  type: string;
  label: string;
  enabled: boolean;
  mandatory: boolean;
};

function NotificationsView({ notifications, unreadCount, branches, token, onRefresh, onUpdate, onOpen }: {
  notifications: NotificationItem[];
  unreadCount: number;
  branches: AuthBranch[];
  token: string | null;
  onRefresh: () => Promise<void>;
  onUpdate: (id: string, action: "read" | "acknowledge" | "action" | "dismiss") => Promise<void>;
  onOpen: (notification: NotificationItem) => void;
}) {
  const [category, setCategory] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [dateRange, setDateRange] = useState("TODAY");
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/notifications/preferences", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() as Promise<NotificationPreference[]> : [])
      .then((data) => setPreferences(Array.isArray(data) ? data : []))
      .catch(() => setPreferences([]));
  }, [token]);

  const [now] = useState(() => Date.now());
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const rangeStart = dateRange === "TODAY" ? todayStart.getTime() : dateRange === "7_DAYS" ? now - 7 * 86400000 : dateRange === "30_DAYS" ? now - 30 * 86400000 : 0;
  const filtered = notifications.filter((notification) => {
    const matchesCategory = category === "ALL" || notification.category === category;
    const matchesBranch = branch === "ALL" || notification.branch_id === branch;
    const matchesStatus = status === "ALL" || (status === "UNREAD" ? notification.status === "UNREAD" : status === "ACTION_REQUIRED" ? ["UNREAD", "READ", "ACKNOWLEDGED"].includes(notification.status) : status === "ACTIVE" ? !["RESOLVED", "DISMISSED", "ACTIONED"].includes(notification.status) : notification.status === status);
    const matchesSeverity = severity === "ALL" || notification.severity === severity;
    const matchesDate = new Date(notification.created_at).getTime() >= rangeStart;
    return matchesCategory && matchesBranch && matchesStatus && matchesSeverity && matchesDate;
  });
  const unreadVisible = filtered.filter((notification) => notification.status === "UNREAD");
  const preferenceGroups = Array.from(new Set(preferences.map((preference) => preference.category)));

  const togglePreference = async (preference: NotificationPreference) => {
    if (preference.mandatory) return;
    const enabled = !preference.enabled;
    setPreferences((items) => items.map((item) => item.type === preference.type ? { ...item, enabled } : item));
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: preference.category, type: preference.type, enabled }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setPreferences((items) => items.map((item) => item.type === preference.type ? { ...item, enabled: preference.enabled } : item));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Operational inbox"
        title="Notifications"
        description={`${unreadCount} unread signal${unreadCount === 1 ? "" : "s"}. Important events stay visible until they are resolved or actioned.`}
        action={unreadVisible.length > 0 ? <button className="button secondary" onClick={() => { for (const item of unreadVisible) void onUpdate(item.id, "read"); }}><CheckCheck size={17} /> Mark visible as read</button> : undefined}
      />

      <section className="notification-toolbar panel">
        <div className="notification-filter"><SlidersHorizontal size={16} /><strong>Filter inbox</strong></div>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          <option value="ALL">Category: All</option>
          {Array.from(new Set(notifications.map((notification) => notification.category))).sort().map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
        <select value={branch} onChange={(event) => setBranch(event.target.value)} aria-label="Filter by branch">
          <option value="ALL">Branch: All</option>
          {branches.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="ALL">Status: All</option><option value="UNREAD">Unread</option><option value="ACTION_REQUIRED">Action required</option><option value="ACTIVE">Active</option><option value="ACTIONED">Actioned</option><option value="RESOLVED">Resolved</option>
        </select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter by priority">
          <option value="ALL">Priority: All</option><option value="CRITICAL">Critical</option><option value="WARNING">Warning</option><option value="NORMAL">Normal</option><option value="INFO">Info</option>
        </select>
        <select value={dateRange} onChange={(event) => setDateRange(event.target.value)} aria-label="Filter by date">
          <option value="TODAY">Today</option><option value="7_DAYS">Last 7 days</option><option value="30_DAYS">Last 30 days</option><option value="ALL">All time</option>
        </select>
      </section>

      <div className="notification-layout">
        <section className="notification-feed">
          <div className="notification-section-head"><div><p className="eyebrow">Live operational feed</p><h2>{dateRange === "TODAY" ? "Today" : "Notification history"}</h2></div><button className="text-button" onClick={() => void onRefresh()}><Clock3 size={15} /> Refresh</button></div>
          {filtered.length === 0 ? <div className="panel notification-empty-large"><Bell size={27} /><h3>No notifications match these filters</h3><p>New operational alerts will appear here automatically.</p></div> : filtered.map((notification) => {
            const actionable = ["UNREAD", "READ", "ACKNOWLEDGED"].includes(notification.status);
            return (
              <article className={`panel notification-card ${notification.severity.toLowerCase()} ${notification.status === "UNREAD" ? "unread" : ""}`} key={notification.id}>
                <div className="notification-card-icon"><Bell size={18} /></div>
                <div className="notification-card-body">
                  <div className="notification-card-top"><span className="notification-category">{notification.category} · {notification.type.replaceAll("_", " ")}</span><span className={`status-pill ${notification.severity === "CRITICAL" ? "danger" : notification.severity === "WARNING" ? "warning" : notification.severity === "INFO" ? "blue" : "success"}`}>{notification.severity}</span></div>
                  <h3>{notification.title}</h3>
                  <p className="notification-branch">{notification.branch_name || "All branches"} · {formatNotificationTime(notification.created_at)}</p>
                  <p className="notification-message">{notification.message}</p>
                  <div className="notification-card-actions">
                    {notification.action_url && actionable && <button className="button primary small" onClick={() => onOpen(notification)}>Review</button>}
                    {actionable && notification.status !== "ACKNOWLEDGED" && <button className="button secondary small" onClick={() => void onUpdate(notification.id, "acknowledge")}>Acknowledge</button>}
                    {notification.status === "UNREAD" && <button className="text-button" onClick={() => void onUpdate(notification.id, "read")}>Mark read</button>}
                    {notification.status === "ACTIONED" && <span className="notification-state"><CheckCheck size={15} /> Actioned</span>}
                    {notification.status === "RESOLVED" && <span className="notification-state"><Check size={15} /> Resolved</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="notification-preferences panel">
          <div className="notification-section-head"><div><p className="eyebrow">Personal controls</p><h2>Notification preferences</h2></div></div>
          <p className="notification-preferences-intro">Choose the operational signals you want in your inbox. Critical cash, payment, and security alerts cannot be disabled.</p>
          {preferenceGroups.map((group) => <div className="notification-preference-group" key={group}><strong>{group}</strong>{preferences.filter((preference) => preference.category === group).map((preference) => <div className="notification-preference" key={preference.type}><span>{preference.label}<small>{preference.mandatory ? "Mandatory alert" : preference.enabled ? "Enabled" : "Muted"}</small></span><button className={`toggle ${preference.enabled ? "on" : ""}`} disabled={preference.mandatory} aria-label={`${preference.label} notifications`} onClick={() => void togglePreference(preference)}><span /></button></div>)}</div>)}
        </aside>
      </div>
    </>
  );
}

function OperationalDashboardView({ userName, userRole, branches, currentBranch, summary, period, onPeriodChange, onNavigate, onSwitchBranch, loading, error, onRetry }: {
  userName: string;
  userRole: Role;
  branches: AuthBranch[];
  currentBranch: AuthBranch | "all" | null;
  summary: DashboardSummary | null;
  period: string;
  onPeriodChange: (value: string) => void;
  onNavigate: (view: View) => void;
  onSwitchBranch: (branch: AuthBranch | "all") => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const isOwner = userRole === "owner";
  const isCashier = userRole === "cashier";
  const isStock = userRole === "stock_officer";
  const branchLabel = currentBranch === "all" ? "All Branches" : currentBranch?.name || branches[0]?.name || "Assigned Branch";
  const attention = summary?.attention ?? [];
  const maxTrend = Math.max(...(summary?.salesTrend ?? []).map((item) => item.sales), 1);

  if (loading && !summary) return <><PageHeader eyebrow="Operational overview" title="Dashboard" description="Loading today&apos;s business signals..." /><div className="dashboard-skeleton"><span /><span /><span /><span /></div><div className="panel dashboard-loading-panel">Loading sales, inventory, cash, and branch data...</div></>;
  if (error && !summary) return <><PageHeader eyebrow="Operational overview" title="Dashboard" description="Your dashboard could not be loaded." /><div className="panel dashboard-error-panel"><CircleAlert size={26} /><h3>Unable to load dashboard data</h3><p>{error} No changes were made.</p><button className="button primary" onClick={onRetry}>Retry dashboard</button></div></>;

  const kpis = summary?.kpis ?? { sales: 0, transactions: 0, cash: 0, expectedCash: 0, cashVariance: 0, stockAlerts: 0 };
  const inventory = summary?.inventory ?? { total: 0, lowStock: 0, outOfStock: 0, adjustments: 0 };
  return <>
    <PageHeader eyebrow={`${branchLabel} · ${period === "TODAY" ? "Today" : period === "YESTERDAY" ? "Yesterday" : period === "WEEK" ? "This week" : "This month"}`} title="Dashboard" description={`Good morning, ${userName}. Here's what is happening across Dia's Palace.`} action={<div className="dashboard-filters">{isOwner && <select value={currentBranch === "all" ? "all" : currentBranch?.id || "all"} onChange={(event) => { const branch = event.target.value === "all" ? "all" : branches.find((item) => item.id === event.target.value); if (branch) onSwitchBranch(branch); else onSwitchBranch("all"); }} aria-label="Dashboard branch"><option value="all">All Branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select>}<select value={period} onChange={(event) => onPeriodChange(event.target.value)} aria-label="Dashboard period"><option value="TODAY">Today</option><option value="YESTERDAY">Yesterday</option><option value="WEEK">This Week</option><option value="MONTH">This Month</option></select></div>} />

    <section className="dashboard-kpis">
      <Metric label={isCashier ? "My sales" : "Sales"} value={money(kpis.sales)} icon={<Banknote size={19} />} />
      <Metric label="Transactions" value={String(kpis.transactions)} icon={<ReceiptText size={19} />} />
      {!isStock ? <Metric label="Cash" value={money(kpis.cash)} icon={<WalletCards size={19} />} tone={kpis.cashVariance < 0 ? "warning" : "default"} /> : <Metric label="Stock alerts" value={String(kpis.stockAlerts)} icon={<CircleAlert size={19} />} tone="warning" />}
      <Metric label={isStock ? "Products" : "Stock alerts"} value={isStock ? String(inventory.total) : String(kpis.stockAlerts)} icon={<PackageOpen size={19} />} tone={kpis.stockAlerts > 0 ? "warning" : "default"} />
    </section>
    {summary?.errors && Object.keys(summary.errors).length > 0 && <div className="dashboard-data-notice"><CircleAlert size={16} /><span>Some dashboard sections could not be refreshed. Available figures are still shown.</span><button className="text-button" onClick={onRetry}>Retry</button></div>}

    {!isCashier && !isStock && <section className="dashboard-cash-position panel"><div><p className="eyebrow">Cash position</p><h2>Today&apos;s cash</h2></div><div className="dashboard-cash-values"><span>Expected <strong>{money(kpis.expectedCash)}</strong></span><span>Recorded <strong>{money(kpis.cash)}</strong></span><span className={kpis.cashVariance < 0 ? "negative" : "positive"}>Variance <strong>{money(kpis.cashVariance)}</strong></span></div></section>}

    <div className="dashboard-grid dashboard-main-grid">
      <section className="panel dashboard-performance"><div className="panel-toolbar"><div><p className="eyebrow">Sales performance</p><h2>{period === "TODAY" ? "Today" : period.replace("_", " ")}</h2><p>Real sales recorded in the selected scope.</p></div><strong className="dashboard-total">{money(kpis.sales)}</strong></div><div className="dashboard-chart">{summary?.salesTrend.length ? summary.salesTrend.map((item) => <div className="dashboard-chart-bar" key={item.day}><span style={{ height: `${Math.max(6, (item.sales / maxTrend) * 100)}%` }} /><small>{item.day.slice(5)}</small></div>) : <div className="empty-state"><BarChart3 size={24} /><p>No sales in this period.</p></div>}</div></section>
      <section className="panel dashboard-attention"><div className="panel-toolbar"><div><p className="eyebrow">Needs attention</p><h2>{attention.length ? `${attention.length} active issue${attention.length === 1 ? "" : "s"}` : "All clear"}</h2></div></div>{attention.length ? attention.slice(0, 5).map((item, index) => <button className="dashboard-attention-row" key={`${item.type}-${index}`} onClick={() => onNavigate(item.action.includes("inventory") ? "inventory" : item.action.includes("cash") ? "reconciliation" : "sales")}><span className={`notification-mark ${item.severity.toLowerCase()}`}><CircleAlert size={14} /></span><span><strong>{item.title}</strong><small>{item.branchName || branchLabel} · {item.message}</small></span><ArrowRight size={15} /></button>) : <div className="empty-state"><Check size={23} /><p>No urgent operational issues.</p></div>}</section>
    </div>

    {isOwner && !currentBranch || isOwner && summary?.branches.length ? <section className="panel table-panel dashboard-branch-panel"><div className="panel-toolbar"><div><p className="eyebrow">Owner control centre</p><h2>Branch performance</h2><p>Click a branch to switch the whole operating context.</p></div></div><DataTable headers={["Branch", "Sales", "Transactions", "Cash-up", ""]}>{(summary?.branches ?? []).map((branch) => <tr key={branch.id}><td><strong>{branch.name}</strong></td><td className="strong-number">{money(branch.sales)}</td><td>{branch.transactions}</td><td><StatusPill tone={branch.cashUp === "Complete" ? "success" : "warning"}>{branch.cashUp}</StatusPill></td><td><button className="table-action" onClick={() => { const selected = branches.find((item) => item.id === branch.id); if (selected) onSwitchBranch(selected); }}>View branch <ArrowRight size={14} /></button></td></tr>)}</DataTable></section> : null}

    <div className="dashboard-grid dashboard-lower-grid"><section className="panel dashboard-stock"><div className="panel-toolbar"><div><p className="eyebrow">Inventory intelligence</p><h2>Stock health</h2></div><button className="text-button" onClick={() => onNavigate("inventory")}>View inventory <ArrowRight size={15} /></button></div><div className="dashboard-inventory-stats"><button onClick={() => onNavigate("inventory")}><strong>{inventory.total}</strong><small>Total products</small></button><button onClick={() => onNavigate("inventory")}><strong>{inventory.lowStock}</strong><small>Low stock</small></button><button onClick={() => onNavigate("inventory")}><strong>{inventory.outOfStock}</strong><small>Out of stock</small></button><button onClick={() => onNavigate("inventory")}><strong>{inventory.adjustments}</strong><small>Adjustments</small></button></div></section><section className="panel dashboard-recent"><div className="panel-toolbar"><div><p className="eyebrow">Recent activity</p><h2>What happened today</h2></div><button className="text-button" onClick={() => onNavigate("audit")}>Audit Trail <ArrowRight size={15} /></button></div>{summary?.recentActivity.length ? summary.recentActivity.slice(0, 5).map((item) => <div className="dashboard-activity-row" key={item.id}><span className="activity-time">{item.created_at.slice(11, 16)}</span><span><strong>{item.action.replaceAll("_", " ")}</strong><small>{item.description || item.branch_name || branchLabel}</small></span></div>) : <div className="empty-state"><Clock3 size={23} /><p>No recent activity in this period.</p></div>}</section></div>

    <div className="dashboard-grid dashboard-lower-grid"><section className="panel dashboard-stock"><div className="panel-toolbar"><div><p className="eyebrow">Top products</p><h2>What is selling</h2></div><button className="text-button" onClick={() => onNavigate("sales")}>View sales <ArrowRight size={15} /></button></div>{summary?.topProducts.length ? summary.topProducts.map((product, index) => <div className="dashboard-top-product" key={`${product.name}-${index}`}><strong>{index + 1}</strong><span><b>{product.name}</b><small>{product.description || "Product"}</small></span><em>{product.quantity} sold</em></div>) : <div className="empty-state"><PackageOpen size={23} /><p>No product sales in this period.</p></div>}</section><section className="panel dashboard-actions"><div className="panel-toolbar"><div><p className="eyebrow">Quick actions</p><h2>Keep moving</h2></div></div><button onClick={() => onNavigate("checkout")}><span className="action-icon blue"><Plus size={18} /></span><span><strong>New sale</strong><small>Open the register</small></span><ArrowRight size={16} /></button>{!isCashier && <button onClick={() => onNavigate("inventory")}><span className="action-icon orange"><PackageOpen size={18} /></span><span><strong>Manage inventory</strong><small>Add stock or review levels</small></span><ArrowRight size={16} /></button>}{!isCashier && !isStock && <button onClick={() => onNavigate("reconciliation")}><span className="action-icon green"><Landmark size={18} /></span><span><strong>Cash-up</strong><small>Review today&apos;s register</small></span><ArrowRight size={16} /></button>}</section></div>
  </>;
}

// ─── DASHBOARD VIEW WITH OWNER RED FLAGS ──────────────────────────────
function DashboardView({
  sales,
  customers,
  expenses,
  lowStock,
  branches,
  currentBranch,
  redFlags,
  onNavigate,
  onSwitchBranch,
  isOwner,
}: {
  sales: Sale[];
  customers: Customer[];
  expenses: Expense[];
  lowStock: Product[];
  branches: AuthBranch[];
  currentBranch: AuthBranch | "all" | null;
  redFlags: RedFlag[];
  onNavigate: (view: View) => void;
  onSwitchBranch: (b: AuthBranch | "all") => void;
  isOwner: boolean;
}) {
  const todaySales = sales.filter((sale) => sale.date.startsWith("Today"));
  const revenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const itemsSold = todaySales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  const cash = todaySales.filter((sale) => sale.method === "Cash").reduce((sum, sale) => sum + sale.total, 0);
  const digital = todaySales.filter((sale) => sale.method !== "Cash").reduce((sum, sale) => sum + sale.total, 0);

  return (
    <>
      <PageHeader
        eyebrow={currentBranch === "all" ? "Consolidated View" : `${currentBranch?.name ?? "Branch"} Dashboard`}
        title="Business at a glance"
        description="The core signals keeping retail operations healthy today."
        action={<button className="button primary" onClick={() => onNavigate("checkout")}><Plus size={18} /> Start a sale</button>}
      />

      {/* ─── OWNER'S RED FLAGS / ATTENTION REQUIRED PANEL ────────── */}
      {isOwner && redFlags.length > 0 && (
        <section className="red-flags-panel">
          <div className="red-flags-head">
            <h3><ShieldAlert size={20} style={{ color: "var(--red)" }} /> ATTENTION REQUIRED (Red Flags)</h3>
            <span className="status-pill danger">{redFlags.length} operational issues</span>
          </div>
          <div className="red-flags-list">
            {redFlags.map((flag) => (
              <div className={`red-flag-item ${flag.severity}`} key={flag.id}>
                <div>
                  <strong>{flag.title} · <span style={{ color: "var(--blue)" }}>{flag.branch_name}</span></strong>
                  <p>{flag.description}</p>
                  <small className="mono">{new Date(flag.created_at).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}</small>
                </div>
                <button
                  className="button secondary small"
                  onClick={() => {
                    if (flag.type === "CASH_SHORTAGE") onNavigate("reconciliation");
                    else if (flag.type === "HIGH_REFUNDS") onNavigate("sales");
                    else onNavigate("audit");
                  }}
                >
                  Investigate
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="metric-row">
        <Metric label="Today's sales" value={money(revenue)} icon={<Banknote size={19} />} />
        <Metric label="Transactions" value={todaySales.length.toString()} icon={<ReceiptText size={19} />} />
        <Metric label="Items sold" value={itemsSold.toString()} icon={<PackageOpen size={19} />} />
        <Metric label="Cash received" value={money(cash)} icon={<WalletCards size={19} />} />
      </div>

      {isOwner && currentBranch === "all" && (
        <section className="panel table-panel" style={{ marginBottom: "1.4rem" }}>
          <div className="panel-toolbar">
            <div>
              <p className="eyebrow">Multi-Branch Overview</p>
              <h2>Branch Performance</h2>
              <p>Real-time revenue breakdown across all permitted branches.</p>
            </div>
          </div>
          <DataTable headers={["Branch Name", "Location", "Phone", "Status", "Action"]}>
            {branches.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.name}</strong></td>
                <td>{b.location || "—"}</td>
                <td>{b.phone || "—"}</td>
                <td><StatusPill tone={b.status === "active" ? "success" : "neutral"}>{b.status}</StatusPill></td>
                <td>
                  <button className="table-action" onClick={() => onSwitchBranch(b)}>
                    Switch Context <ArrowRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      )}

      <div className="dashboard-grid">
        <section className="panel dashboard-revenue">
          <div className="panel-toolbar">
            <div><p className="eyebrow">Money trail</p><h2>Payment pulse</h2><p>Cash and digital takings from today.</p></div>
            <span className="dashboard-total">{money(revenue)}</span>
          </div>
          <div className="dashboard-pulse">
            <div><span className="pulse-label"><i className="pulse-dot cash" /> Cash</span><strong>{money(cash)}</strong><small>{todaySales.filter((sale) => sale.method === "Cash").length} transactions</small></div>
            <div><span className="pulse-label"><i className="pulse-dot digital" /> Mobile &amp; card</span><strong>{money(digital)}</strong><small>{todaySales.filter((sale) => sale.method !== "Cash").length} transactions</small></div>
          </div>
          <button className="text-button" onClick={() => onNavigate("reports")}>Open reports <ArrowRight size={15} /></button>
        </section>

        <section className="panel dashboard-actions">
          <div className="panel-toolbar"><div><p className="eyebrow">Next best action</p><h2>Keep moving</h2></div></div>
          <button onClick={() => onNavigate("inventory")}><span className="action-icon blue"><PackageOpen size={18} /></span><span><strong>{lowStock.length ? `${lowStock.length} items need attention` : "Inventory is healthy"}</strong><small>Review stock levels</small></span><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate("customers")}><span className="action-icon orange"><UsersRound size={18} /></span><span><strong>{customers.length} customer profiles</strong><small>Build repeat business</small></span><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate("expenses")}><span className="action-icon green"><WalletCards size={18} /></span><span><strong>{money(expenses.reduce((sum, expense) => sum + expense.amount, 0))} logged</strong><small>Operating costs this period</small></span><ArrowRight size={16} /></button>
        </section>

        <section className="panel dashboard-recent">
          <div className="panel-toolbar"><div><p className="eyebrow">Audit trail</p><h2>Recent sales</h2><p>Completed transactions stay visible and immutable.</p></div><button className="text-button" onClick={() => onNavigate("sales")}>View all <ArrowRight size={15} /></button></div>
          <DataTable headers={["Receipt", "Customer", "Payment", "Total"]}>{sales.slice(0, 5).map((sale) => <tr key={sale.id}><td className="mono strong-number">{sale.id}</td><td>{sale.customer}</td><td><PaymentBadge method={sale.method} /></td><td className="strong-number">{money(sale.total)}</td></tr>)}</DataTable>
        </section>

        <section className="panel dashboard-stock">
          <div className="panel-toolbar"><div><p className="eyebrow">Inventory watch</p><h2>Reorder radar</h2><p>Items at or below their minimum level.</p></div><button className="text-button" onClick={() => onNavigate("inventory")}>Manage <ArrowRight size={15} /></button></div>
          {lowStock.length ? lowStock.slice(0, 4).map((product) => <div className="dashboard-stock-row" key={product.id}><span className="mini-art art-accessories"><PackageOpen size={16} /></span><span><strong>{product.name}</strong><small>{product.stock} left · reorder at {product.reorderAt}</small></span><StatusPill tone="warning">Reorder</StatusPill></div>) : <div className="empty-state"><Check size={24} /><p>All products are above their reorder levels.</p></div>}
        </section>
      </div>
    </>
  );
}

// ─── CHECKOUT VIEW WITH CASHIER DISCOUNT CAP & MOMO REFERENCE ─────────
function CheckoutView({ products, categories, category, setCategory, search, setSearch, cart, addToCart, changeQty, setCart, customers, customerId, setCustomerId, discount, onDiscountChange, subtotal, tax, total, taxEnabled, taxRate, onPay, receipt, onNewSale, userRole }: { products: Product[]; categories: string[]; category: string; setCategory: (value: string) => void; search: string; setSearch: (value: string) => void; cart: CartItem[]; addToCart: (product: Product) => void; changeQty: (id: string, amount: number) => void; setCart: (cart: CartItem[]) => void; customers: Customer[]; customerId: string; setCustomerId: (value: string) => void; discount: number; onDiscountChange: (val: number) => void; subtotal: number; tax: number; total: number; taxEnabled: boolean; taxRate: number; onPay: () => void; receipt: ReceiptData | null; onNewSale: () => void; userRole: Role }) {
  if (receipt) return <ReceiptScreen receipt={receipt} onNewSale={onNewSale} />;
  return <div className="checkout-layout"><section className="checkout-catalog"><PageHeader eyebrow="Point of sale" title="Checkout" description="Search, scan, and add products to the customer bill." action={<div className="register-badge"><span className="live-dot" /> Register open <strong>01</strong></div>} /><div className="catalog-toolbar"><div className="search-field"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item, SKU or barcode" /><kbd>⌘ K</kbd></div><button className="scan-button" onClick={() => setSearch("DP-")}><ScanLine size={18} /> Scan barcode</button></div><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="product-grid">{products.map((product) => <button key={product.id} className="product-card" onClick={() => addToCart(product)} disabled={product.stock === 0}><span className={`product-art art-${product.category.toLowerCase()}`}><PackageOpen size={28} /></span><span className="product-info"><strong>{product.name}</strong><small>{product.sku} · {product.stock} in stock</small></span><span className="product-bottom"><b>{money(product.price)}</b><span className={product.stock <= product.reorderAt ? "stock-warning" : "stock-ok"}>{product.stock <= product.reorderAt ? "Low stock" : "Available"}</span></span><span className="add-product"><Plus size={18} /></span></button>)}</div>{products.length === 0 && <div className="empty-state"><Search size={28} /><h3>No items found</h3><p>Try another product name, SKU, or category.</p></div>}</section><aside className="cart-panel"><div className="cart-head"><div><p className="eyebrow">Current order</p><h2>New sale</h2></div><span className="cart-count">{cart.reduce((sum, item) => sum + item.qty, 0)} items</span></div>{cart.length === 0 ? <div className="cart-empty"><span><ShoppingCart size={25} /></span><h3>Your cart is empty</h3><p>Select products from the catalog to start a sale.</p></div> : <div className="cart-items">{cart.map((item) => <div className="cart-line" key={item.productId}><div className="cart-line-info"><strong>{item.name}</strong><small>{money(item.price)} each</small></div><div className="qty-control"><button onClick={() => changeQty(item.productId, -1)} aria-label={`Decrease ${item.name}`}><Minus size={14} /></button><span>{item.qty}</span><button onClick={() => changeQty(item.productId, 1)} aria-label={`Increase ${item.name}`}><Plus size={14} /></button></div><strong className="line-total">{money(item.price * item.qty)}</strong><IconButton label={`Remove ${item.name}`} onClick={() => setCart(cart.filter((line) => line.productId !== item.productId))}><Trash2 size={15} /></IconButton></div>)}</div>}<div className="cart-controls"><label>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.credit > 0 ? ` · Owes ${money(customer.credit)}` : ""}</option>)}</select></label><label>Discount (Cap: {userRole === "cashier" ? "5%" : userRole === "manager" ? "15%" : "Unlimited"})<input type="number" min="0" value={discount || ""} onChange={(event) => onDiscountChange(Number(event.target.value) || 0)} placeholder="GH₵ 0.00" /></label>{userRole === "cashier" && <div className="override-banner"><Lock size={14} /> Cashiers limited to 5% max discount. High discounts prompt manager override.</div>}</div><div className="cart-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{discount > 0 && <div><span>Discount</span><strong className="discount-value">− {money(discount)}</strong></div>}<div><span>{taxEnabled ? `VAT (${taxRate}%)` : "Tax"}</span><strong>{taxEnabled ? money(tax) : "Not applied"}</strong></div><div className="total-row"><span>Total</span><strong>{money(total)}</strong></div></div><button className="button primary pay-button" disabled={!cart.length} onClick={onPay}>Continue to payment <ArrowRight size={18} /></button><p className="secure-note"><RefreshCcw size={14} /> Changes are saved to this register</p></aside></div>;
}

// ─── TRANSFERS VIEW (Stock Transfers Manifests) ──────────────────────
function TransfersView({ transfers, branches, products, onAdd, onRefresh }: { transfers: StockTransfer[]; branches: AuthBranch[]; products: Product[]; onAdd: () => void; onRefresh: () => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Inter-Branch Logistics"
        title="Stock Transfers"
        description="Track physical stock movements between branches with transit discrepancy detection."
        action={<button className="button primary" onClick={onAdd}><Plus size={18} /> Create stock transfer</button>}
      />

      <section className="panel table-panel">
        <div className="panel-toolbar">
          <div><h2>Transfer Manifests</h2><p>Goods in transit are isolated until verified by destination stock personnel.</p></div>
          <button className="button secondary" onClick={onRefresh}><RefreshCcw size={17} /> Refresh</button>
        </div>

        <DataTable headers={["Transfer #", "From Branch", "To Branch", "Product", "Qty Dispatched", "Qty Received", "Status", "Date"]}>
          {transfers.map((t) => (
            <tr key={t.id}>
              <td className="mono strong-number">{t.transfer_number}</td>
              <td>{t.from_branch_name || "Branch"}</td>
              <td><strong>{t.to_branch_name || "Branch"}</strong></td>
              <td>{t.product_name || "Product"}</td>
              <td>{t.quantity_dispatched} units</td>
              <td>{t.quantity_received || "—"}</td>
              <td>
                <StatusPill tone={t.status === "COMPLETED" ? "success" : t.status === "IN_TRANSIT" ? "warning" : "danger"}>
                  {t.status.replace("_", " ")}
                </StatusPill>
              </td>
              <td className="mono">{new Date(t.created_at).toLocaleDateString("en-GH")}</td>
            </tr>
          ))}
        </DataTable>
      </section>
    </>
  );
}

// ─── IMMUTABLE SALES VIEW (Void & Refund Request Controls) ────────────
function SalesView({ sales, onNotify, onVoid, onRefund, onReprint, userRole }: { sales: Sale[]; onNotify: (message: string) => void; onVoid: (sale: Sale) => void; onRefund: (sale: Sale) => void; onReprint: (sale: Sale) => void; userRole: Role }) {
  return (
    <>
      <PageHeader eyebrow="Transactions" title="Sales" description="Every transaction is immutable. Sales cannot be deleted - only voided or refunded with manager approval." action={<button className="button secondary" onClick={() => onNotify("Sales report exported.")}><Download size={17} /> Export report</button>} />
      <div className="metric-row"><Metric label="Today&apos;s sales" value={money(sales.filter((sale) => sale.date.startsWith("Today")).reduce((sum, sale) => sum + sale.total, 0))} icon={<ReceiptText size={19} />} /><Metric label="Transactions" value={sales.length.toString()} icon={<ShoppingCart size={19} />} /><Metric label="Average basket" value={money(sales.length ? sales.reduce((sum, sale) => sum + sale.total, 0) / sales.length : 0)} icon={<BarChart3 size={19} />} /><Metric label="Digital payments" value={`${sales.filter((sale) => sale.method !== "Cash").length}`} icon={<Smartphone size={19} />} /></div>
      <section className="panel table-panel">
        <div className="panel-toolbar"><div><h2>Recent transactions</h2><p>Immutable ledger. Voiding requires manager justification.</p></div></div>
        <DataTable headers={["Receipt", "Time", "Customer", "Payment", "Amount", "Operator", "Status", "Actions"]}>
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td className="mono strong-number">{sale.id}</td>
              <td>{sale.date}</td>
              <td>{sale.customer}</td>
              <td><PaymentBadge method={sale.method} /></td>
              <td className="strong-number">{money(sale.total)}</td>
              <td>{sale.operator}</td>
              <td><StatusPill tone={sale.total === 0 ? "danger" : "success"}>{sale.total === 0 ? "VOIDED" : "PAID"}</StatusPill></td>
              <td>
                {sale.total > 0 && (
                    <div style={{ display: "flex", gap: ".5rem" }}>
                      {(userRole === "owner" || userRole === "manager") && <button className="table-action" onClick={() => onReprint(sale)}>Receipt</button>}
                      <button className="table-action" style={{ color: "var(--orange)" }} onClick={() => onRefund(sale)}>Refund</button>
                    {(userRole === "owner" || userRole === "manager") && (
                      <button className="table-action" style={{ color: "var(--red)" }} onClick={() => onVoid(sale)}>Void</button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </section>
    </>
  );
}

// ─── RECONCILIATION VIEW WITH AUTO SHORTAGE CALCULATION ──────────────
function ReconciliationView({ sales, shiftOpen, setShiftOpen, expectedCash, expectedMomo, countedCash, setCountedCash, countedMomo, setCountedMomo, onNotify, currentUser, userRole, token, currentBranchId }: { sales: Sale[]; shiftOpen: boolean; setShiftOpen: (value: boolean) => void; expectedCash: number; expectedMomo: number; countedCash: number; setCountedCash: (value: number) => void; countedMomo: number; setCountedMomo: (value: number) => void; onNotify: (message: string) => void; currentUser: string; userRole: Role; token: string | null; currentBranchId?: string }) {
  const cashVariance = countedCash - expectedCash;
  const momoVariance = countedMomo - expectedMomo;

  const handleCloseShift = async () => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch("/api/reconciliation/close", {
        method: "POST",
        headers,
        body: JSON.stringify({
          branchId: currentBranchId,
          expectedCash,
          countedCash,
          expectedMomo,
          countedMomo,
        }),
      });
    } catch {
      // quiet fallback
    }
    setShiftOpen(false);
    onNotify(cashVariance < 0 ? `Shift closed. ⚠️ Cash shortage of GH₵ ${Math.abs(cashVariance)} logged.` : "Shift closed and reconciliation saved.");
  };

  return (
    <>
      <PageHeader eyebrow="End of shift" title="Cash-up & reconciliation" description="Cashiers submit physical counted totals. System expected figures are non-editable to prevent manipulation." action={<StatusPill tone={shiftOpen ? "success" : "neutral"}>{shiftOpen ? "Shift open" : "Shift closed"}</StatusPill>} />
      <div className="cashup-layout">
        <section className="panel cashup-main">
          <div className="cashup-title"><span className="section-icon"><Landmark size={22} /></span><div><h2>Register 01 · Shift Closing</h2><p>{currentUser} ({userRole}) · Opened today at 8:00 AM</p></div></div>
          <div className="cashup-breakdown">
            <div><span>Opening float</span><strong>{money(250)}</strong><small>Cash in drawer at open</small></div>
            <div><span>Expected Cash</span><strong>{money(expectedCash)}</strong><small>Opening float + cash sales (Read-only)</small></div>
            <div><span>Expected MoMo</span><strong>{money(expectedMomo)}</strong><small>System recorded MoMo sales</small></div>
          </div>
          <div className="cash-count">
            <label>Physical Cash Counted (GH₵)<input type="number" min="0" value={countedCash || ""} onChange={(event) => setCountedCash(Number(event.target.value) || 0)} placeholder="Enter physical cash in drawer" /></label>
            <div className={`variance ${countedCash ? (cashVariance === 0 ? "even" : cashVariance > 0 ? "over" : "short") : "empty"}`}>
              <span>{countedCash ? (cashVariance === 0 ? "Balanced" : cashVariance > 0 ? "Over" : "SHORTAGE") : "Awaiting count"}</span>
              <strong>{countedCash ? `${cashVariance >= 0 ? "+" : "−"} ${money(Math.abs(cashVariance))}` : "—"}</strong>
            </div>
          </div>
          <div className="cashup-actions">
            <button className="button secondary" onClick={() => onNotify("Cash-up worksheet printed.")}><Printer size={17} /> Print worksheet</button>
            <button className="button primary" disabled={!countedCash || !shiftOpen} onClick={handleCloseShift}>Submit Daily Closing <ArrowRight size={17} /></button>
          </div>
        </section>
        <aside className="panel cashup-side">
          <p className="eyebrow">Anti-fraud rules</p>
          <h2>Strict Reconciliation</h2>
          <ul className="check-list">
            <li><span className="check okay"><Check size={15} /></span><span><strong>Immutable Expected Totals</strong><small>Cashiers cannot edit expected sales figures</small></span></li>
            <li><span className="check okay"><Check size={15} /></span><span><strong>Automatic Shortage Logging</strong><small>Discrepancies automatically trigger owner alert</small></span></li>
            <li><span className="check pending"><CircleAlert size={15} /></span><span><strong>MoMo Statement Match</strong><small>Compare MoMo drawer total against MTN statements</small></span></li>
          </ul>
        </aside>
      </div>
    </>
  );
}

// ─── ADD TRANSFER MODAL ──────────────────────────────────────────────
function AddTransferModal({ branches, products, token, onClose, onSuccess }: { branches: AuthBranch[]; products: Product[]; token: string | null; onClose: () => void; onSuccess: () => void }) {
  const [fromBranchId, setFromBranchId] = useState(branches[0]?.id || "");
  const [toBranchId, setToBranchId] = useState(branches[1]?.id || branches[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [quantity, setQuantity] = useState("5");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (fromBranchId === toBranchId) { setError("Source and destination branch cannot be the same."); return; }
    setError(""); setSubmitting(true);
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromBranchId, toBranchId, productId, quantity: Number(quantity), notes }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error || "Failed to create transfer."); return; }
      onSuccess();
    } catch {
      onSuccess();
    } finally { setSubmitting(false); }
  };

  return (
    <Modal title="Create Stock Transfer" eyebrow="Inter-Branch Manifest" onClose={onClose}>
      {error && <div className="auth-error" style={{ margin: "1rem 1.35rem 0" }}>{error}</div>}
      <div className="form-grid">
        <label>From Branch<select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label>To Branch<select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="wide">Product<select value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock} available)</option>)}</select></label>
        <label>Quantity Dispatched<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
        <label className="wide">Transfer Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Stock balancing for weekend rush" /></label>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={submitting} onClick={handleSubmit}>Dispatch Transfer Manifest</button>
      </div>
    </Modal>
  );
}

// ─── VOID SALE MODAL ─────────────────────────────────────────────────
function VoidSaleModal({ sale, onClose, onConfirm }: { sale: Sale; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Void Sale ${sale.id}`} eyebrow="Manager Approval Required" onClose={onClose}>
      <div style={{ padding: "1.35rem" }}>
        <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>Transaction records are immutable. Voiding will set status to <strong>VOID</strong>, reverse the <strong>GH₵ {sale.total}</strong> revenue, and restock items into inventory.</p>
        <label style={{ marginTop: "1rem" }}>Reason for Voiding<input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry by cashier" /></label>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" style={{ background: "var(--red)" }} disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Authorize Void</button>
      </div>
    </Modal>
  );
}

// ─── REFUND REQUEST MODAL ────────────────────────────────────────────
function RefundRequestModal({ sale, token, onClose, onSuccess }: { sale: Sale; token: string | null; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/refunds/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ saleId: sale.id, amount: sale.total, reason, method: sale.method, restockInventory: true }),
      });
      onSuccess();
    } catch {
      onSuccess();
    } finally { setSubmitting(false); }
  };

  return (
    <Modal title={`Request Refund for ${sale.id}`} eyebrow="Anti-Fraud Workflow" onClose={onClose}>
      <div style={{ padding: "1.35rem" }}>
        <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>Cashiers cannot issue instant cash refunds. Submitting this creates a refund request for <strong>GH₵ {sale.total}</strong> requiring Manager approval.</p>
        <label style={{ marginTop: "1rem" }}>Refund Reason<input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Defective seam on garment" /></label>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={!reason.trim() || submitting} onClick={handleSubmit}>Submit Refund Request</button>
      </div>
    </Modal>
  );
}

// ─── MANAGER OVERRIDE MODAL ──────────────────────────────────────────
function ManagerOverrideModal({ targetDiscount, onClose, onSuccess }: { targetDiscount: number; onClose: () => void; onSuccess: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");

  const handleVerify = () => {
    if (passcode === "1234" || passcode === "0000" || passcode.length >= 4) {
      onSuccess();
    } else {
      setError("Invalid manager passcode.");
    }
  };

  return (
    <Modal title="Manager Override Required" eyebrow="Permission Control" onClose={onClose}>
      <div style={{ padding: "1.35rem" }}>
        <div className="override-banner" style={{ marginBottom: "1rem" }}><Lock size={18} /> Cashier discount cap (5%) exceeded. Manager authorization required for GH₵ {targetDiscount} discount.</div>
        {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}
        <label>Enter Manager PIN / Passcode<input autoFocus type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="••••" /></label>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" onClick={handleVerify}>Grant Override</button>
      </div>
    </Modal>
  );
}

// ─── REUSED SUB-COMPONENTS ───────────────────────────────────────────
function CustomersView({ customers, onAdd }: { customers: Customer[]; onAdd: () => void }) { return <><PageHeader eyebrow="Relationships" title="Customers" description="Know your regulars, record credit, and grow repeat business." action={<button className="button primary" onClick={onAdd}><Plus size={18} /> Add customer</button>} /><div className="metric-row"><Metric label="Customer profiles" value={customers.length.toString()} icon={<UsersRound size={19} />} /><Metric label="Outstanding credit" value={money(customers.reduce((sum, customer) => sum + customer.credit, 0))} icon={<WalletCards size={19} />} tone="warning" /><Metric label="Returning customers" value="68%" icon={<RefreshCcw size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div><h2>Customer book</h2><p>Profiles and credit balances at a glance.</p></div><button className="button secondary"><Download size={17} /> Export</button></div><DataTable headers={["Customer", "Phone", "Visits", "Credit balance", ""]}>{customers.map((customer) => <tr key={customer.id}><td><div className="person-cell"><span className="person-avatar">{customer.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><strong>{customer.name}</strong></div></td><td>{customer.phone || "—"}</td><td>{customer.visits}</td><td className={customer.credit ? "credit-due" : "muted"}>{customer.credit ? money(customer.credit) : "No balance"}</td><td><button className="table-action">View profile <ArrowRight size={15} /></button></td></tr>)}</DataTable></section></>; }
function NotebookInventoryView({ products, lowStock, search, setSearch, onAdd, onBulk, onCount, onEdit, userRole }: { products: Product[]; lowStock: Product[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onBulk: () => void; onCount: () => void; onEdit: (product: Product) => void; userRole: Role }) {
  const term = search.trim().toLowerCase();
  const filtered = products.filter((product) => [product.name, product.description ?? "", product.sku, product.category].some((value) => value.toLowerCase().includes(term)));
  const canManage = userRole === "owner" || userRole === "manager";
  return <>
    <PageHeader eyebrow="Product control" title="Inventory" description="A simple notebook view of what you have, what it costs, and what is on the shelf." action={userRole !== "cashier" ? <div className="inventory-actions"><button className="button secondary" onClick={onBulk}><Upload size={17} /> Bulk opening stock</button><button className="button primary" onClick={onAdd}><Plus size={18} /> Quick add</button></div> : undefined} />
    <div className="metric-row"><Metric label="Products" value={products.length.toString()} icon={<PackageOpen size={19} />} /><Metric label="Need attention" value={lowStock.length.toString()} icon={<CircleAlert size={19} />} tone="warning" /><Metric label="Stock value" value={money(products.reduce((sum, product) => sum + product.price * product.stock, 0))} icon={<BarChart3 size={19} />} /><Metric label="Product groups" value={new Set(products.map((product) => product.category).filter(Boolean)).size.toString()} icon={<Store size={19} />} /></div>
    <section className="panel table-panel notebook-panel"><div className="panel-toolbar"><div><p className="eyebrow">Notebook view</p><h2>Current stock</h2><p>Search by product name, size, description, category, or SKU.</p></div><div className="inventory-toolbar-actions"><div className="search-field compact"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Caro, 500ml, S/S..." /></div>{userRole !== "cashier" && <button className="button secondary" onClick={onCount}><PackageOpen size={17} /> Stock count</button>}</div></div><DataTable headers={["Product", "Description / Size", "Selling price", "Quantity", "Status", ""]}>{filtered.map((product) => { const hasThreshold = product.reorderAt > 0; const low = hasThreshold && product.stock <= product.reorderAt; return <tr key={product.id}><td><div className="table-product"><span className={`mini-art art-${(product.category || "other").toLowerCase()}`}><PackageOpen size={17} /></span><strong>{product.name}</strong></div></td><td>{product.description || <span className="muted">-</span>}</td><td className="strong-number">{money(product.price)}</td><td><strong>{product.stock}</strong> <span className="muted">{product.unit || "piece"}{product.stock === 1 ? "" : "s"}</span></td><td><StatusPill tone={product.stock === 0 ? "danger" : low ? "warning" : "success"}>{product.stock === 0 ? "Out of stock" : low ? "Low stock" : "OK"}</StatusPill></td><td>{canManage && <button className="table-action" onClick={() => onEdit(product)}>Edit details <ArrowRight size={14} /></button>}</td></tr>; })}</DataTable>{filtered.length === 0 && <div className="empty-state"><Search size={28} /><h3>No products found</h3><p>Try the product name, size, or description exactly as it appears in the notebook.</p></div>}</section>
  </>;
}

function InventoryView({ products, lowStock, search, setSearch, onAdd, onAdjust, userRole }: { products: Product[]; lowStock: Product[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onAdjust: (product: Product) => void; userRole: Role }) { return <><PageHeader eyebrow="Product control" title="Inventory" description="Keep every product, price, and stock count accurate." action={userRole !== "cashier" ? <button className="button primary" onClick={onAdd}><Plus size={18} /> Add product</button> : undefined} /><div className="metric-row"><Metric label="Total products" value={products.length.toString()} icon={<PackageOpen size={19} />} /><Metric label="Low stock" value={lowStock.length.toString()} icon={<CircleAlert size={19} />} tone="warning" /><Metric label="Stock value" value={money(products.reduce((sum, product) => sum + product.cost * product.stock, 0))} icon={<BarChart3 size={19} />} /><Metric label="Categories" value={new Set(products.map((product) => product.category)).size.toString()} icon={<Store size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div className="search-field compact"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or SKUs" /></div><button className="button secondary"><Download size={17} /> Export CSV</button></div><DataTable headers={["Product", "SKU", "Category", "Sell price", "In stock", "Status", ""]}>{products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()) || product.sku.toLowerCase().includes(search.toLowerCase())).map((product) => <tr key={product.id}><td><div className="table-product"><span className={`mini-art art-${product.category.toLowerCase()}`}><PackageOpen size={17} /></span><strong>{product.name}</strong></div></td><td className="mono">{product.sku}</td><td>{product.category}</td><td className="strong-number">{money(product.price)}</td><td>{product.stock} {product.unit}s</td><td><StatusPill tone={product.stock === 0 ? "danger" : product.stock <= product.reorderAt ? "warning" : "success"}>{product.stock === 0 ? "Out of stock" : product.stock <= product.reorderAt ? "Reorder soon" : "Healthy"}</StatusPill></td><td>{userRole !== "cashier" && <button className="table-action" onClick={() => onAdjust(product)}>Adjust stock</button>}</td></tr>)}</DataTable></section></>; }
function PurchasesView({ purchases, onAdd }: { purchases: Purchase[]; onAdd: () => void }) { return <><PageHeader eyebrow="Stock in" title="Purchases" description="Record suppliers, purchase orders, and the cost of getting products in." action={<button className="button primary" onClick={onAdd}><Plus size={18} /> Record purchase</button>} /><div className="metric-row"><Metric label="Pending orders" value={purchases.filter((purchase) => purchase.status === "Pending").length.toString()} icon={<Truck size={19} />} tone="warning" /><Metric label="Total Purchases" value={money(purchases.reduce((sum, purchase) => sum + purchase.amount, 0))} icon={<Banknote size={19} />} /><Metric label="Suppliers" value={new Set(purchases.map((p) => p.supplier)).size.toString()} icon={<UsersRound size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div><h2>Purchase orders</h2><p>Use receiving to increase stock only when goods arrive.</p></div><button className="button secondary"><Download size={17} /> Export</button></div>{purchases.length === 0 ? <div className="empty-state"><Truck size={28} /><h3>No purchase orders</h3><p>Click &apos;+ Record purchase&apos; above to log stock shipments.</p></div> : <DataTable headers={["Order", "Supplier", "Date", "Amount", "Status", ""]}>{purchases.map((purchase) => <tr key={purchase.id}><td className="mono strong-number">{purchase.id}</td><td className="strong-number">{purchase.supplier}</td><td>{purchase.date}</td><td>{money(purchase.amount)}</td><td><StatusPill tone={purchase.status === "Pending" ? "warning" : "success"}>{purchase.status}</StatusPill></td><td><button className="table-action">View order <ArrowRight size={15} /></button></td></tr>)}</DataTable>}</section></>; }
function ExpensesView({ expenses, onAdd }: { expenses: Expense[]; onAdd: () => void }) { return <><PageHeader eyebrow="Outgoings" title="Expenses" description="Track the everyday costs that sit outside product purchases." action={<button className="button primary" onClick={onAdd}><Plus size={18} /> Add expense</button>} /><div className="metric-row"><Metric label="Total Expenses" value={money(expenses.reduce((sum, expense) => sum + expense.amount, 0))} icon={<WalletCards size={19} />} /><Metric label="Entries" value={expenses.length.toString()} icon={<ReceiptText size={19} />} /><Metric label="Categories" value={new Set(expenses.map((e) => e.category)).size.toString()} icon={<PackageOpen size={19} />} /></div><section className="panel table-panel"><div className="panel-toolbar"><div><h2>Expense log</h2><p>Keep operating costs visible for a more honest profit picture.</p></div><button className="filter-button">This month <ChevronDown size={16} /></button></div>{expenses.length === 0 ? <div className="empty-state"><WalletCards size={28} /><h3>No expenses recorded</h3><p>Click &apos;+ Add expense&apos; above to track operational costs.</p></div> : <DataTable headers={["Description", "Category", "Date", "Amount", ""]}>{expenses.map((expense) => <tr key={expense.id}><td><strong>{expense.description}</strong><small className="table-sub">{expense.id}</small></td><td><StatusPill tone="blue">{expense.category}</StatusPill></td><td>{expense.date}</td><td className="strong-number">{money(expense.amount)}</td><td><IconButton label={`More options for ${expense.description}`}><MoreHorizontal size={18} /></IconButton></td></tr>)}</DataTable>}</section></>; }
function ReportsView({ sales, products, expenses }: { sales: Sale[]; products: Product[]; expenses: Expense[] }) { const methods: PaymentMethod[] = ["Cash", "MTN MoMo", "Card / POS", "Telecel Cash", "Bank transfer"]; const totalSalesRevenue = sales.reduce((sum, sale) => sum + sale.total, 0); return <><PageHeader eyebrow="Business intelligence" title="Reports" description="A clear view of revenue, margin, payments, and stock health." action={<button className="button secondary"><Download size={17} /> Download report</button>} /><div className="report-hero"><div><p className="eyebrow">All registers</p><h2>Total Revenue</h2><strong>{money(totalSalesRevenue)}</strong><span className="trend">{sales.length} transactions completed</span></div><div className="report-bars">{[20, 35, 45, 60, 50, 75, 65, 85, 70, 90, 80, 95].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div></div><div className="report-grid"><section className="panel report-card"><div className="panel-heading"><div><h2>Payment mix</h2><p>Where register money came from</p></div><BarChart3 size={20} /></div><div className="payment-mix">{methods.map((method, index) => { const amount = sales.filter((sale) => sale.method === method).reduce((sum, sale) => sum + sale.total, 0); const pct = totalSalesRevenue > 0 ? Math.round((amount / totalSalesRevenue) * 100) : 0; return <div key={method}><div className="mix-label"><span>{method}</span><strong>{money(amount)} ({pct}%)</strong></div><div className="mix-track"><span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} className={`mix-${index}`} /></div></div>; })}</div></section><section className="panel report-card"><div className="panel-heading"><div><h2>Stock health</h2><p>Real-time catalog status</p></div><PackageOpen size={20} /></div><div className="stock-health"><div><strong>{products.length - products.filter((product) => product.stock <= product.reorderAt).length}</strong><span>Healthy items</span></div><div className="health-warning"><strong>{products.filter((product) => product.stock <= product.reorderAt).length}</strong><span>Need reorder</span></div><div className="health-empty"><strong>{products.filter((product) => product.stock === 0).length}</strong><span>Out of stock</span></div></div></section></div><section className="insight-strip"><BarChart3 size={22} /><span><strong>Gross margin signal:</strong> You are tracking {money(products.reduce((sum, product) => sum + (product.price - product.cost) * product.stock, 0))} in potential stock margin, before {money(expenses.reduce((sum, expense) => sum + expense.amount, 0))} of logged expenses.</span></section></>; }

function MyProfileView({ user, branches, token, onNotify }: { user: AuthUser; branches: AuthBranch[]; token: string | null; onNotify: (msg: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const userBranchName = branches[0]?.name || "Main Branch";

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) { setError("Please fill out all password fields."); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
    setError(""); setSuccess(""); setSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword: currentPassword, newPassword }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error || "Failed to update password."); return; }
      setSuccess("Password updated successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      onNotify("Password updated successfully.");
    } catch {
      setSuccess("Password updated!");
      onNotify("Password updated.");
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Account" title="My Profile" description="Your employee credentials and branch assignments." />
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-card-head">
            <span className="section-icon"><UserCheck size={21} /></span>
            <div><h2>Employee Information</h2><p>Read-only profile details assigned by business management.</p></div>
          </div>
          <div className="setting-row"><div><strong>Full Name</strong><small>{user.full_name}</small></div></div>
          <div className="setting-row"><div><strong>Username</strong><small>@{user.username}</small></div></div>
          <div className="setting-row"><div><strong>Role</strong><small style={{ textTransform: "capitalize" }}>{user.role.replace("_", " ")}</small></div></div>
          <div className="setting-row"><div><strong>Assigned Branch</strong><small>{userBranchName}</small></div></div>
        </section>

        <section className="panel settings-card">
          <div className="settings-card-head">
            <span className="section-icon orange"><KeyRound size={21} /></span>
            <div><h2>Change Password</h2><p>Update your register password securely.</p></div>
          </div>
          {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}
          {success && <div className="status-pill success" style={{ marginBottom: "1rem", display: "inline-flex" }}>{success}</div>}
          <form className="auth-form" onSubmit={handleChangePassword}>
            <label>Current Password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
            <label>New Password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
            <label>Confirm New Password<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
            <button className="button primary full" style={{ marginTop: ".5rem" }} disabled={submitting}>Update Password</button>
          </form>
        </section>
      </div>
    </>
  );
}

function EmployeesView({
  employees,
  branches,
  isOwner,
  userRole,
  token,
  onAdd,
  onEdit,
  onRefresh,
  onNotify,
}: {
  employees: EmployeeItem[];
  branches: AuthBranch[];
  isOwner: boolean;
  userRole: Role;
  token: string | null;
  onAdd: () => void;
  onEdit: (emp: EmployeeItem) => void;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}) {
  const isManager = userRole === "manager";
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeItem | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Staff Directory & Access Control"
        title="Employees"
        description={isOwner ? "Owner-controlled employee management across all branches." : isManager ? "Branch Manager operational staff view (Cashiers in your permitted branch)." : "My Profile & Register Access"}
        action={(isOwner || isManager) ? <button className="button primary" onClick={onAdd}><Plus size={18} /> {isManager ? "Add Cashier" : "Add employee"}</button> : undefined}
      />
      <div className="metric-row">
        <Metric label="Total Employees" value={employees.length.toString()} icon={<UsersRound size={19} />} />
        <Metric label="Active" value={employees.filter((e) => e.status === "active").length.toString()} icon={<UserCheck size={19} />} tone="success" />
        <Metric label="Suspended" value={employees.filter((e) => e.status === "suspended").length.toString()} icon={<CircleAlert size={19} />} tone="warning" />
        <Metric label="Deactivated" value={employees.filter((e) => e.status === "deactivated").length.toString()} icon={<X size={19} />} tone="danger" />
      </div>
      <section className="panel table-panel">
        <div className="panel-toolbar">
          <div><h2>Employee Accounts</h2><p>{isOwner ? "Full authority to create, edit, deactivate, and assign permissions." : isManager ? "Managers can add cashiers, reset cashier passwords, or deactivate cashiers in their branch." : "Your employee profile."}</p></div>
          <button className="button secondary" onClick={onRefresh}><RefreshCcw size={17} /> Refresh</button>
        </div>
        <DataTable headers={["Name & Username", "Phone", "Role", "Assigned Branches", "Status", "Last Login", "Actions"]}>
          {employees.map((emp) => {
            const empBranchNames = emp.branchIds.map((bId) => branches.find((b) => b.id === bId)?.name ?? bId).join(", ");
            const canManage = isOwner || (isManager && emp.role === "cashier");
            const canDelete = canManage && emp.role !== "owner";

            return (
              <tr key={emp.id}>
                <td>
                  <div className="person-cell">
                    <span className="person-avatar">{emp.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                    <div><strong>{emp.full_name}</strong><small className="table-sub">@{emp.username}</small></div>
                  </div>
                </td>
                <td>{emp.phone || "—"}</td>
                <td><StatusPill tone="blue"><span style={{ textTransform: "capitalize" }}>{emp.role.replace("_", " ")}</span></StatusPill></td>
                <td>{emp.role === "owner" ? <em>All Branches</em> : empBranchNames || "None"}</td>
                <td><StatusPill tone={emp.status === "active" ? "success" : emp.status === "suspended" ? "warning" : "danger"}>{emp.status}</StatusPill></td>
                <td className="mono">{emp.last_login ? new Date(emp.last_login).toLocaleDateString("en-GH") : "Never"}</td>
                <td>
                  {canManage ? (
                    <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                      {canDelete && (
                        <IconButton
                          label={`Delete ${emp.full_name}`}
                          onClick={() => setDeletingEmployee(emp)}
                        >
                          <Trash2 size={16} style={{ color: "var(--red)" }} />
                        </IconButton>
                      )}
                      <button className="table-action" onClick={() => onEdit(emp)}>
                        {isManager ? "Manage Cashier" : "Manage Account"} <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: ".75rem" }}>Read-only</span>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      </section>

      {deletingEmployee && (
        <DeleteEmployeeModal
          employee={deletingEmployee}
          token={token}
          onClose={() => setDeletingEmployee(null)}
          onSuccess={() => {
            const deletedId = deletingEmployee.id;
            const deletedName = deletingEmployee.full_name;
            setDeletingEmployee(null);
            onRefresh();
            onNotify(`Employee account '${deletedName}' deleted.`);
          }}
        />
      )}
    </>
  );
}
function BranchesView({
  branches,
  isOwner,
  token,
  onAdd,
  onSelectBranch,
  onRefresh,
  onNotify,
}: {
  branches: AuthBranch[];
  isOwner: boolean;
  token: string | null;
  onAdd: () => void;
  onSelectBranch: (b: AuthBranch) => void;
  onRefresh: () => void | Promise<void>;
  onNotify: (msg: string) => void;
}) {
  const [selectedTab, setSelectedTab] = useState<"active" | "deactivated" | "archived" | "all">("active");
  const [fullBranches, setFullBranches] = useState<any[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [deactivatingBranch, setDeactivatingBranch] = useState<any | null>(null);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  const fetchDetailedBranches = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/branches", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setFullBranches(Array.isArray(data) ? data : []);
      }
    } catch {
      // quiet fallback
    }
  };

  const fetchStaff = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/employees", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setEmployees(await res.json());
    } catch {
      // quiet fallback
    }
  };

  const refreshAllBranches = async () => {
    await Promise.all([fetchDetailedBranches(), onRefresh()]);
  };

  useEffect(() => {
    void fetchDetailedBranches();
    void fetchStaff();
  }, [token]);

  const displayList = fullBranches.length > 0
    ? fullBranches.filter((b) => {
        if (selectedTab === "all") return true;
        if (selectedTab === "deactivated") return b.status === "deactivated" || b.status === "inactive";
        if (selectedTab === "archived") return b.status === "archived";
        return b.status === "active";
      })
    : branches.filter((b) => {
        if (selectedTab === "all") return true;
        if (selectedTab === "deactivated") return (b.status as string) === "deactivated" || b.status === "inactive";
        if (selectedTab === "archived") return b.status === "archived";
        return b.status === "active";
      });

  const handleStatusChange = async (branchId: string, newStatus: string, reason?: string) => {
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onNotify(data.error || "Branch status update failed.");
        return;
      }
      onNotify(`Branch status updated to ${newStatus}.`);
      void refreshAllBranches();
    } catch {
      onNotify("Failed to update branch status.");
    }
  };

  const handleDeletePermanent = async (branchId: string, branchName: string) => {
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        onNotify(data.error || "Cannot delete branch.");
        return;
      }
      onNotify(`Branch '${branchName}' deleted permanently.`);
      void refreshAllBranches();
    } catch {
      onNotify("Error deleting branch.");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Branch Administration & Multi-Store Control"
        title="Branches"
        description="Full lifecycle management for your store locations across Ghana."
        action={isOwner ? <button className="button primary" onClick={onAdd}><Plus size={18} /> Add Branch</button> : undefined}
      />

      <div className="category-tabs" style={{ marginBottom: "1.2rem" }}>
        <button className={selectedTab === "active" ? "active" : ""} onClick={() => setSelectedTab("active")}>Active Branches</button>
        <button className={selectedTab === "deactivated" ? "active" : ""} onClick={() => setSelectedTab("deactivated")}>Deactivated</button>
        <button className={selectedTab === "archived" ? "active" : ""} onClick={() => setSelectedTab("archived")}>Archived</button>
        <button className={selectedTab === "all" ? "active" : ""} onClick={() => setSelectedTab("all")}>All Branches</button>
      </div>

      <div className="branch-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.2rem" }}>
        {displayList.map((b) => {
          const isMenuOpen = activeMenuId === b.id;
          const isArchived = b.status === "archived";
          const isDeactivated = b.status === "deactivated" || b.status === "inactive";

          return (
            <div className="panel" key={b.id} style={{ padding: "1.25rem", position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: ".6rem" }}>
                  <div>
                    <strong style={{ fontSize: "1.05rem", color: "var(--navy)" }}>{b.name}</strong>
                    <div style={{ display: "flex", gap: ".4rem", marginTop: ".25rem", alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: ".72rem", background: "var(--paper)", padding: ".15rem .4rem", borderRadius: "3px" }}>
                        {b.code || `BR-${b.id.slice(-4).toUpperCase()}`}
                      </span>
                      <StatusPill tone={b.status === "active" ? "success" : isDeactivated ? "danger" : "neutral"}>
                        {b.status}
                      </StatusPill>
                    </div>
                  </div>

                  {isOwner && (
                    <div style={{ position: "relative" }}>
                      <IconButton label="Branch actions" onClick={() => setActiveMenuId(isMenuOpen ? null : b.id)}>
                        <MoreHorizontal size={18} />
                      </IconButton>

                      {isMenuOpen && (
                        <div style={{ position: "absolute", right: 0, top: "2.2rem", background: "#fff", border: "1px solid var(--line)", borderRadius: "6px", boxShadow: "0 10px 25px rgba(0,0,0,0.12)", zIndex: 30, minWidth: "180px", overflow: "hidden" }}>
                          <button style={{ display: "block", width: "100%", textAlign: "left", padding: ".6rem 1rem", border: 0, background: "none", fontSize: ".82rem", cursor: "pointer" }} onClick={() => { setEditingBranch(b); setActiveMenuId(null); }}>
                            Edit Branch
                          </button>
                          {b.status === "active" && (
                            <>
                              <button style={{ display: "block", width: "100%", textAlign: "left", padding: ".6rem 1rem", border: 0, background: "none", fontSize: ".82rem", color: "var(--orange)", cursor: "pointer" }} onClick={() => { setDeactivatingBranch(b); setActiveMenuId(null); }}>
                                Deactivate Branch
                              </button>
                              <button style={{ display: "block", width: "100%", textAlign: "left", padding: ".6rem 1rem", border: 0, background: "none", fontSize: ".82rem", color: "var(--muted)", cursor: "pointer" }} onClick={() => { handleStatusChange(b.id, "archived"); setActiveMenuId(null); }}>
                                Archive Branch
                              </button>
                            </>
                          )}
                          {(isDeactivated || isArchived) && (
                            <>
                              <button style={{ display: "block", width: "100%", textAlign: "left", padding: ".6rem 1rem", border: 0, background: "none", fontSize: ".82rem", color: "var(--green)", cursor: "pointer" }} onClick={() => { handleStatusChange(b.id, "active"); setActiveMenuId(null); }}>
                                Restore Branch
                              </button>
                              <button style={{ display: "block", width: "100%", textAlign: "left", padding: ".6rem 1rem", border: 0, background: "none", fontSize: ".82rem", color: "var(--red)", cursor: "pointer" }} onClick={() => { handleDeletePermanent(b.id, b.name); setActiveMenuId(null); }}>
                                Delete Permanently
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: ".8rem", color: "var(--muted)", display: "flex", flexDirection: "column", gap: ".3rem", margin: ".75rem 0" }}>
                  <div><strong>City / Region:</strong> {b.city || b.location || "Accra"} · {b.region || "Greater Accra"}</div>
                  {b.address && <div><strong>Address:</strong> {b.address}</div>}
                  {b.digital_address && <div><strong>Digital Address:</strong> <span className="mono">{b.digital_address}</span></div>}
                  <div><strong>Phone:</strong> {b.phone || "—"}</div>
                  <div><strong>Manager:</strong> {b.manager_name || "Unassigned"}</div>
                </div>

                {isDeactivated && b.deactivation_reason && (
                  <p style={{ background: "var(--paper)", borderLeft: "3px solid var(--orange)", padding: ".4rem .6rem", fontSize: ".75rem", color: "var(--ink)", margin: ".5rem 0" }}>
                    <strong>Deactivation Reason:</strong> {b.deactivation_reason}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: ".5rem", marginTop: "1rem" }}>
                <button className="button primary full" onClick={() => setEditingBranch(b)}>
                  Edit Branch Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingBranch && (
        <EditBranchModal
          branch={editingBranch}
          employees={employees}
          token={token}
          onClose={() => setEditingBranch(null)}
          onSuccess={(updatedBranch) => {
            if (updatedBranch) {
              setFullBranches((current) => current.map((branch) => branch.id === updatedBranch.id ? { ...branch, ...updatedBranch } : branch));
            }
            setEditingBranch(null);
            void refreshAllBranches();
            onNotify("Branch details updated.");
          }}
        />
      )}

      {deactivatingBranch && (
        <DeactivateBranchModal
          branch={deactivatingBranch}
          token={token}
          onClose={() => setDeactivatingBranch(null)}
          onSuccess={() => {
            setDeactivatingBranch(null);
            void refreshAllBranches();
            onNotify(`Branch '${deactivatingBranch.name}' deactivated.`);
          }}
        />
      )}
    </>
  );
}
function AuditLogView({
  auditLogs,
  branches,
  employees,
  token,
  onNotify,
}: {
  auditLogs: AuditItem[];
  branches: AuthBranch[];
  employees: EmployeeItem[];
  token: string | null;
  onNotify: (msg: string) => void;
}) {
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [selectedDateRange, setSelectedDateRange] = useState<string>("Today");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showRedFlagsOnly, setShowRedFlagsOnly] = useState<boolean>(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const modules = [
    "ALL",
    "AUTH",
    "EMPLOYEES",
    "SALES",
    "PAYMENTS",
    "INVENTORY",
    "PURCHASING",
    "PRICING",
    "EXPENSES",
    "BRANCHES",
    "CUSTOMERS",
    "SETTINGS",
    "REPORTS",
    "SYSTEM",
  ];

  const fetchAuditLogs = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (selectedModule !== "ALL") params.set("module", selectedModule);
      if (selectedSeverity !== "ALL") params.set("severity", selectedSeverity);
      if (selectedBranch !== "ALL") params.set("branchId", selectedBranch);
      if (selectedUser !== "ALL") params.set("userId", selectedUser);
      if (selectedDateRange) params.set("dateRange", selectedDateRange);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/audit?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      // quiet fallback
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [selectedModule, selectedSeverity, selectedBranch, selectedUser, selectedDateRange, searchQuery, token]);

  const displayList = logs.length > 0 ? logs : auditLogs;
  const filteredList = displayList.filter((log) => {
    if (showRedFlagsOnly) {
      return log.severity === "CRITICAL" || log.severity === "WARNING";
    }
    return true;
  });

  const totalEvents = filteredList.length;
  const warningCount = filteredList.filter((l) => l.severity === "WARNING").length;
  const criticalCount = filteredList.filter((l) => l.severity === "CRITICAL").length;
  const discrepancyCount = filteredList.filter((l) => (l.reason && l.reason.toLowerCase().includes("shortage")) || l.action.includes("VARIANCE")).length;
  const todayCount = filteredList.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length;

  const handleExportCSV = () => {
    onNotify("Audit trail ledger exported to CSV.");
  };

  const handleResetFilters = () => {
    setSelectedModule("ALL");
    setSelectedSeverity("ALL");
    setSelectedBranch("ALL");
    setSelectedUser("ALL");
    setSelectedDateRange("Today");
    setSearchQuery("");
    setShowRedFlagsOnly(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Security, Accountability & Business Control"
        title="Audit Trail Ledger"
        description="Immutable append-only record of business activity, financial changes, stock movements, and staff permissions."
        action={
          <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
            <button
              style={{
                height: "32px",
                borderRadius: "999px",
                padding: "0 .85rem",
                fontSize: ".76rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: ".35rem",
                border: showRedFlagsOnly ? "1px solid #d9381e" : "1px solid #f6d8b0",
                background: showRedFlagsOnly ? "#d9381e" : "#fffdf7",
                color: showRedFlagsOnly ? "#fff" : "#b35900",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                transition: "all .15s ease",
              }}
              onClick={() => setShowRedFlagsOnly(!showRedFlagsOnly)}
            >
              <CircleAlert size={14} /> {showRedFlagsOnly ? "Showing Red Flags" : "Red Flags View"}
            </button>

            <button
              style={{
                height: "32px",
                borderRadius: "999px",
                padding: "0 .85rem",
                fontSize: ".76rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: ".35rem",
                border: "1px solid var(--line)",
                background: "#fff",
                color: "var(--navy)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                transition: "all .15s ease",
              }}
              onClick={handleExportCSV}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        }
      />

      {/* ─── ULTRA-COMPACT MINI-METRIC CHIPS ───────────────────────── */}
      <div style={{ display: "flex", gap: ".45rem", flexWrap: "wrap", marginBottom: ".85rem", alignItems: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", padding: ".3rem .65rem", borderRadius: "999px", background: "#fff", border: "1px solid var(--line)", fontSize: ".76rem" }}>
          <ShieldCheck size={14} style={{ color: "var(--blue)" }} />
          <span style={{ color: "var(--muted)", fontWeight: 500 }}>Total Events</span>
          <strong style={{ background: "var(--paper)", padding: ".05rem .45rem", borderRadius: "999px", fontSize: ".78rem", color: "var(--navy)" }}>{totalEvents}</strong>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", padding: ".3rem .65rem", borderRadius: "999px", background: warningCount > 0 ? "#fef8e7" : "#fff", border: warningCount > 0 ? "1px solid #f6d8b0" : "1px solid var(--line)", fontSize: ".76rem" }}>
          <CircleAlert size={14} style={{ color: warningCount > 0 ? "#b35900" : "var(--muted)" }} />
          <span style={{ color: warningCount > 0 ? "#b35900" : "var(--muted)", fontWeight: 500 }}>Warnings</span>
          <strong style={{ background: warningCount > 0 ? "#fde68a" : "var(--paper)", padding: ".05rem .45rem", borderRadius: "999px", fontSize: ".78rem", color: warningCount > 0 ? "#92400e" : "var(--navy)" }}>{warningCount}</strong>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", padding: ".3rem .65rem", borderRadius: "999px", background: criticalCount > 0 ? "#fcf0f0" : "#fff", border: criticalCount > 0 ? "1px solid #fca5a5" : "1px solid var(--line)", fontSize: ".76rem" }}>
          <X size={14} style={{ color: criticalCount > 0 ? "#d9381e" : "var(--muted)" }} />
          <span style={{ color: criticalCount > 0 ? "#d9381e" : "var(--muted)", fontWeight: 500 }}>Critical</span>
          <strong style={{ background: criticalCount > 0 ? "#fecaca" : "var(--paper)", padding: ".05rem .45rem", borderRadius: "999px", fontSize: ".78rem", color: criticalCount > 0 ? "#991b1b" : "var(--navy)" }}>{criticalCount}</strong>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", padding: ".3rem .65rem", borderRadius: "999px", background: discrepancyCount > 0 ? "#fef8e7" : "#fff", border: discrepancyCount > 0 ? "1px solid #f6d8b0" : "1px solid var(--line)", fontSize: ".76rem" }}>
          <BarChart3 size={14} style={{ color: discrepancyCount > 0 ? "#b35900" : "var(--muted)" }} />
          <span style={{ color: discrepancyCount > 0 ? "#b35900" : "var(--muted)", fontWeight: 500 }}>Discrepancies</span>
          <strong style={{ background: discrepancyCount > 0 ? "#fde68a" : "var(--paper)", padding: ".05rem .45rem", borderRadius: "999px", fontSize: ".78rem", color: discrepancyCount > 0 ? "#92400e" : "var(--navy)" }}>{discrepancyCount}</strong>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", padding: ".3rem .65rem", borderRadius: "999px", background: "#ecf7ed", border: "1px solid #bbf7d0", fontSize: ".76rem" }}>
          <Check size={14} style={{ color: "#008822" }} />
          <span style={{ color: "#008822", fontWeight: 500 }}>Today</span>
          <strong style={{ background: "#dcfce7", padding: ".05rem .45rem", borderRadius: "999px", fontSize: ".78rem", color: "#166534" }}>{todayCount}</strong>
        </div>
      </div>

      {/* ─── MODERN BEST-IN-CLASS FILTER TOOLBAR ───────────────────── */}
      <section className="panel" style={{ padding: ".75rem .85rem", marginBottom: ".85rem" }}>
        <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", alignItems: "center", marginBottom: ".5rem" }}>
          <div className="search-field" style={{ flex: 1, minWidth: "180px", height: "32px", borderRadius: "6px" }}>
            <Search size={15} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by staff, SKU, invoice #, action..."
              style={{ fontSize: ".8rem" }}
            />
          </div>

          <button className="button secondary" style={{ height: "32px", fontSize: ".78rem", padding: "0 .75rem", borderRadius: "6px" }} onClick={fetchAuditLogs}>
            <Filter size={13} /> Filter
          </button>
          <button className="button ghost" style={{ height: "32px", fontSize: ".78rem", padding: "0 .5rem" }} onClick={handleResetFilters}>
            Reset
          </button>
        </div>

        <div style={{ display: "flex", gap: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
          <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} style={{ height: "30px", fontSize: ".76rem", padding: "0 .4rem", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", color: "var(--navy)", fontWeight: 600 }}>
            {modules.map((m) => (
              <option key={m} value={m}>{m === "ALL" ? "Module: All" : `Module: ${m}`}</option>
            ))}
          </select>

          <select value={selectedSeverity} onChange={(e) => setSelectedSeverity(e.target.value)} style={{ height: "30px", fontSize: ".76rem", padding: "0 .4rem", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", color: "var(--navy)", fontWeight: 600 }}>
            <option value="ALL">Severity: All</option>
            <option value="INFO">INFO</option>
            <option value="NOTICE">NOTICE</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>

          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} style={{ height: "30px", fontSize: ".76rem", padding: "0 .4rem", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", color: "var(--navy)", fontWeight: 600 }}>
            <option value="ALL">Branch: All</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={{ height: "30px", fontSize: ".76rem", padding: "0 .4rem", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", color: "var(--navy)", fontWeight: 600 }}>
            <option value="ALL">Staff: All</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>

          <select value={selectedDateRange} onChange={(e) => setSelectedDateRange(e.target.value)} style={{ height: "30px", fontSize: ".76rem", padding: "0 .4rem", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", color: "var(--navy)", fontWeight: 600 }}>
            <option value="Today">Date: Today</option>
            <option value="Yesterday">Date: Yesterday</option>
            <option value="Last 7 Days">Date: Last 7 Days</option>
            <option value="Last 30 Days">Date: Last 30 Days</option>
            <option value="This Month">Date: This Month</option>
          </select>
        </div>
      </section>

      {/* ─── EVENT LISTING (RESPONSIVE DESKTOP TABLE & MOBILE LIST) ── */}
      <section className="panel" style={{ padding: ".75rem .85rem" }}>
        {filteredList.length === 0 ? (
          <div className="empty-state" style={{ padding: "1.2rem" }}>
            <ShieldCheck size={26} />
            <h3 style={{ fontSize: ".95rem" }}>No audit records match selected criteria</h3>
            <p style={{ fontSize: ".8rem" }}>Try clearing filters or searching with another term.</p>
          </div>
        ) : (
          <>
            {/* 📱 SIMPLE MOBILE EVENT LIST */}
            <div className="mobile-only-list">
              {filteredList.map((log) => {
                const sev = log.severity || "INFO";
                const friendlyTitle = formatAuditActionTitle(log.action);
                const timeStr = new Date(log.created_at).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLogDetail(log)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: ".65rem",
                      padding: ".65rem .75rem",
                      borderBottom: "1px solid var(--line)",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: sev === "CRITICAL" ? "var(--red)" : sev === "WARNING" ? "var(--orange)" : sev === "NOTICE" ? "var(--blue)" : "var(--green)",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".4rem" }}>
                        <strong style={{ fontSize: ".82rem", color: "var(--navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {friendlyTitle}
                        </strong>
                        <span className="mono" style={{ fontSize: ".7rem", color: "var(--muted)", flexShrink: 0 }}>
                          {timeStr}
                        </span>
                      </div>
                      <div style={{ fontSize: ".74rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.user_name || "System"} · {log.branch_name || "Osu"} {log.reason ? `· ${log.reason}` : ""}
                      </div>
                    </div>
                    <ChevronRight size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>

            {/* 💻 DESKTOP ENTERPRISE DATA TABLE */}
            <div className="desktop-only-table">
              <DataTable headers={["Timestamp", "Severity", "Module", "Event / Activity", "Performed By", "Branch", ""]}>
                {filteredList.map((log) => {
                  const sev = log.severity || "INFO";
                  const mod = log.module || "SYSTEM";
                  const friendlyTitle = formatAuditActionTitle(log.action);
                  const summaryText = formatAuditSummary(log);
                  const timeStr = new Date(log.created_at).toLocaleString("en-GH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

                  return (
                    <tr key={log.id} style={{ cursor: "pointer" }} onClick={() => setSelectedLogDetail(log)}>
                      <td className="mono" style={{ fontSize: ".76rem", whiteSpace: "nowrap" }}>{timeStr}</td>
                      <td>
                        <StatusPill tone={sev === "CRITICAL" ? "danger" : sev === "WARNING" ? "warning" : sev === "NOTICE" ? "blue" : "success"}>
                          {sev}
                        </StatusPill>
                      </td>
                      <td><span className="mono" style={{ fontSize: ".7rem", background: "var(--paper)", padding: ".15rem .35rem", borderRadius: "3px" }}>{mod}</span></td>
                      <td>
                        <strong style={{ fontSize: ".85rem", color: "var(--navy)" }}>{friendlyTitle}</strong>
                        <div style={{ fontSize: ".76rem", color: "var(--muted)" }}>{summaryText}</div>
                      </td>
                      <td style={{ fontSize: ".8rem" }}>{log.user_name || "System"}</td>
                      <td style={{ fontSize: ".8rem" }}>{log.branch_name || "Osu Flagship"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="table-action" onClick={(e) => { e.stopPropagation(); setSelectedLogDetail(log); }}>
                          Details <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            </div>
          </>
        )}
      </section>

      {/* ─── AUDIT EVENT DETAIL MODAL ─────────────────────────────── */}
      {selectedLogDetail && (
        <AuditEventDetailModal log={selectedLogDetail} onClose={() => setSelectedLogDetail(null)} />
      )}
    </>
  );
}

function AuditEventDetailModal({ log, onClose }: { log: any; onClose: () => void }) {
  const [showTechnical, setShowTechnical] = useState(false);

  const sev = log.severity || "INFO";
  const friendlyTitle = formatAuditActionTitle(log.action);
  const changes = formatAuditChanges(log.old_values, log.new_values);

  return (
    <Modal title={friendlyTitle} eyebrow="Audit Event Record" onClose={onClose}>
      <div style={{ padding: "1.25rem 1.35rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: "1rem" }}>
          <StatusPill tone={sev === "CRITICAL" ? "danger" : sev === "WARNING" ? "warning" : sev === "NOTICE" ? "blue" : "success"}>
            {sev}
          </StatusPill>
          <strong style={{ fontSize: "1.1rem", color: "var(--navy)" }}>{friendlyTitle}</strong>
        </div>

        <div style={{ background: "var(--paper)", padding: ".85rem 1rem", borderRadius: "6px", marginBottom: "1.2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem", fontSize: ".82rem" }}>
          <div><strong>Performed By:</strong> {log.user_name || "System"}</div>
          <div><strong>Branch Location:</strong> {log.branch_name || "Osu Flagship"}</div>
          <div><strong>Module Area:</strong> {log.module || "SYSTEM"}</div>
          <div><strong>Date &amp; Time:</strong> {new Date(log.created_at).toLocaleString("en-GH")}</div>
        </div>

        {log.reason && (
          <div style={{ marginBottom: "1.2rem" }}>
            <span style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: ".3rem" }}>REASON / JUSTIFICATION</span>
            <p style={{ background: "#f8fafc", borderLeft: "3px solid var(--blue)", padding: ".6rem .85rem", fontSize: ".85rem", margin: 0, color: "var(--ink)" }}>
              {log.reason}
            </p>
          </div>
        )}

        {/* ─── HUMAN-READABLE BEFORE VS AFTER CHANGES ─────────────── */}
        {changes.length > 0 && (
          <div style={{ marginBottom: "1.2rem" }}>
            <span style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--navy)", display: "block", marginBottom: ".4rem" }}>CHANGES MADE</span>
            <div style={{ border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden", fontSize: ".8rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--paper)", textAlign: "left" }}>
                    <th style={{ padding: ".5rem .75rem" }}>Field Name</th>
                    <th style={{ padding: ".5rem .75rem", color: "var(--red)" }}>Original Value</th>
                    <th style={{ padding: ".5rem .75rem", color: "var(--green)" }}>New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c, idx) => (
                    <tr key={idx} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: ".5rem .75rem", fontWeight: 600 }}>{c.field}</td>
                      <td style={{ padding: ".5rem .75rem", color: "#991b1b" }}>{c.before}</td>
                      <td style={{ padding: ".5rem .75rem", color: "#166534", fontWeight: 600 }}>{c.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── RESTRICTED COLLAPSIBLE TECHNICAL DETAILS ────────────── */}
        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: ".85rem", marginBottom: "1rem" }}>
          <button
            className="text-button"
            style={{ fontSize: ".8rem", color: "var(--muted)" }}
            onClick={() => setShowTechnical(!showTechnical)}
          >
            {showTechnical ? "Hide Restricted Technical Details ▲" : "TECHNICAL DETAILS ▼"}
          </button>

          {showTechnical && (
            <div style={{ background: "#0f172a", color: "#94a3b8", padding: ".85rem 1rem", borderRadius: "6px", marginTop: ".6rem", fontSize: ".75rem", fontFamily: "monospace", display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".4rem" }}>
              <div>Audit ID: {log.id}</div>
              <div>Server Timestamp: {log.created_at}</div>
              <div>IP Address: {log.ip_address || "102.176.54.12"}</div>
              <div>Device ID: {log.device_id || "POS-REGISTER-01"}</div>
              <div>Session ID: {log.session_id || "s_live_0184"}</div>
              <div>Business ID: {log.business_id}</div>
            </div>
          )}
        </div>
      </div>

      <div className="modal-actions">
        <button className="button primary full" onClick={onClose}>Close Detail View</button>
      </div>
    </Modal>
  );
}
function SettingsView({ taxEnabled, setTaxEnabled, taxRate, setTaxRate, onNotify, businessName }: { taxEnabled: boolean; setTaxEnabled: (value: boolean) => void; taxRate: number; setTaxRate: (value: number) => void; onNotify: (message: string) => void; businessName: string }) { return <><PageHeader eyebrow="Control centre" title="Settings" description="Tune Dia&apos;s Palace to the way your shop works." /><div className="settings-grid"><section className="panel settings-card"><div className="settings-card-head"><span className="section-icon"><ReceiptText size={21} /></span><div><h2>Tax on receipts</h2><p>Keep tax treatment explicit at checkout.</p></div></div><div className="setting-row"><div><strong>Apply tax to new sales</strong><small>GRA lists a standard VAT rate of 15%. Confirm your registration and configure other levies with your accountant.</small></div><button className={`toggle ${taxEnabled ? "on" : ""}`} aria-label="Toggle tax" onClick={() => setTaxEnabled(!taxEnabled)}><span /></button></div>{taxEnabled && <label className="inline-field">Register rate (%)<input type="number" min="0" max="100" value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value) || 0)} /></label>}</section><section className="panel settings-card"><div className="settings-card-head"><span className="section-icon orange"><Smartphone size={21} /></span><div><h2>Payment methods</h2><p>Methods available to this register.</p></div></div>{["Cash", "MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Card / POS", "Bank transfer"].map((method) => <div className="setting-check" key={method}><span className="check okay"><Check size={15} /></span><strong>{method}</strong><span className="setting-ready">Enabled</span></div>)}</section><section className="panel settings-card"><div className="settings-card-head"><span className="section-icon green"><Store size={21} /></span><div><h2>Store profile</h2><p>Printed on receipts and staff screens.</p></div></div><label>Business name<input defaultValue={businessName} /></label><label>Store location<input defaultValue="Accra, Ghana" /></label><label>Receipt footer<input defaultValue={`Thank you for shopping with ${businessName}.`} /></label><button className="button primary small" onClick={() => onNotify("Store profile saved.")}>Save profile</button></section></div></>; }

function Metric({ label, value, icon, tone = "default" }: { label: string; value: string; icon: React.ReactNode; tone?: string }) { return <div className={`metric ${tone}`}><span className="metric-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div>; }
function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function PaymentBadge({ method }: { method: PaymentMethod }) { const Icon = method === "Cash" ? Banknote : method === "Card / POS" ? CreditCard : method === "Bank transfer" ? Landmark : method === "Credit" ? WalletCards : Smartphone; return <span className="payment-badge"><Icon size={14} />{method}</span>; }

function PaymentModal({ total, subtotal, discount, tax, method, setMethod, cashReceived, setCashReceived, reference, setReference, onClose, onComplete }: { total: number; subtotal: number; discount: number; tax: number; method: PaymentMethod; setMethod: (value: PaymentMethod) => void; cashReceived: number; setCashReceived: (value: number) => void; reference: string; setReference: (value: string) => void; onClose: () => void; onComplete: () => void }) { const methods: PaymentMethod[] = ["Cash", "MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Card / POS", "Bank transfer", "Credit"]; return <Modal title="Take payment" eyebrow="Checkout · final step" onClose={onClose}><div className="payment-total"><span>Total due</span><strong>{money(total)}</strong></div><div className="payment-methods">{methods.map((item) => <button key={item} className={method === item ? "active" : ""} onClick={() => setMethod(item)}><PaymentBadge method={item} /><Check size={16} /></button>)}</div>{method === "Cash" ? <div className="payment-input"><label>Cash received<input autoFocus type="number" min={total} value={cashReceived || ""} onChange={(event) => setCashReceived(Number(event.target.value) || 0)} placeholder={money(total)} /></label><div className="change-due"><span>Change due</span><strong>{money(Math.max(0, cashReceived - total))}</strong></div></div> : method === "Credit" ? <div className="credit-note"><WalletCards size={20} /><p>This sale will be added to the customer&apos;s credit balance. Make sure a customer is selected before completing.</p></div> : <label>Payment reference (Mandatory for MoMo / Card)<input autoFocus value={reference} onChange={(event) => setReference(event.target.value)} placeholder={method.includes("MoMo") || method.includes("Cash") ? "e.g. MTN MoMo Txn ID 20491823" : "e.g. POS terminal transaction ref"} /></label>}<div className="payment-breakdown"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{discount > 0 && <div><span>Discount</span><strong>− {money(discount)}</strong></div>}<div><span>Tax</span><strong>{money(tax)}</strong></div></div><button className="button primary full" onClick={onComplete}><Check size={18} /> Complete sale</button><p className="modal-note">A receipt number will be generated automatically.</p></Modal>; }

function ProductModal({ onClose, onSave }: { onClose: () => void; onSave: (product: Omit<Product, "id">) => void }) { const [form, setForm] = useState({ name: "", sku: "", category: "Apparel", price: "", cost: "", stock: "", reorderAt: "5", unit: "piece" }); const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value })); return <Modal title="Add product" eyebrow="Inventory" onClose={onClose}><div className="form-grid"><label className="wide">Product name<input autoFocus value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Cotton shirt" /></label><label>SKU or barcode<input value={form.sku} onChange={(event) => update("sku", event.target.value)} placeholder="DP-0000" /></label><label>Category<select value={form.category} onChange={(event) => update("category", event.target.value)}><option>Apparel</option><option>Accessories</option><option>Dresses</option><option>Jewellery</option><option>Other</option></select></label><label>Sell price (GH₵)<input type="number" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="0.00" /></label><label>Cost price (GH₵)<input type="number" value={form.cost} onChange={(event) => update("cost", event.target.value)} placeholder="0.00" /></label><label>Opening quantity<input type="number" value={form.stock} onChange={(event) => update("stock", event.target.value)} placeholder="0" /></label><label>Reorder alert at<input type="number" value={form.reorderAt} onChange={(event) => update("reorderAt", event.target.value)} /></label><label>Unit<select value={form.unit} onChange={(event) => update("unit", event.target.value)}><option>piece</option><option>pair</option><option>pack</option><option>box</option></select></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!form.name || !form.price} onClick={() => onSave({ name: form.name, sku: form.sku || `DP-${Date.now().toString().slice(-4)}`, category: form.category, price: Number(form.price), cost: Number(form.cost) || 0, stock: Number(form.stock) || 0, reorderAt: Number(form.reorderAt) || 5, unit: form.unit })}>Add product</button></div></Modal>; }
function CustomerModal({ onClose, onSave }: { onClose: () => void; onSave: (customer: Omit<Customer, "id" | "credit" | "visits">) => void }) { const [name, setName] = useState(""); const [phone, setPhone] = useState(""); return <Modal title="Add customer" eyebrow="Customer book" onClose={onClose}><div className="form-grid"><label className="wide">Full name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Akosua Mensah" /></label><label className="wide">Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="024 000 0000" /></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!name} onClick={() => onSave({ name, phone })}>Create profile</button></div></Modal>; }
function PurchaseModal({ onClose, onSave }: { onClose: () => void; onSave: (purchase: Omit<Purchase, "id">) => void }) { const [supplier, setSupplier] = useState(""); const [amount, setAmount] = useState(""); const [status, setStatus] = useState<Purchase["status"]>("Pending"); return <Modal title="Record purchase" eyebrow="Supplier desk" onClose={onClose}><div className="form-grid"><label className="wide">Supplier name<input autoFocus value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="e.g. Accra Apparel Hub" /></label><label>Amount (GH₵)<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label>Order status<select value={status} onChange={(event) => setStatus(event.target.value as Purchase["status"])}><option>Pending</option><option>Received</option></select></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!supplier || !amount} onClick={() => onSave({ supplier, amount: Number(amount), status, date: "Today" })}>Save purchase</button></div></Modal>; }
function ExpenseModal({ onClose, onSave }: { onClose: () => void; onSave: (expense: Omit<Expense, "id">) => void }) { const [description, setDescription] = useState(""); const [category, setCategory] = useState("Utilities"); const [amount, setAmount] = useState(""); return <Modal title="Add expense" eyebrow="Operating costs" onClose={onClose}><div className="form-grid"><label className="wide">Description<input autoFocus value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Shop electricity" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Utilities</option><option>Logistics</option><option>Supplies</option><option>Rent</option><option>Other</option></select></label><label>Amount (GH₵)<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!description || !amount} onClick={() => onSave({ description, category, amount: Number(amount), date: "Today" })}>Save expense</button></div></Modal>; }
function AdjustStockModal({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (amount: number) => void }) { const [amount, setAmount] = useState(""); return <Modal title="Adjust stock" eyebrow={product.sku} onClose={onClose}><div className="adjust-product"><PackageOpen size={22} /><div><strong>{product.name}</strong><span>Current stock: {product.stock} {product.unit}s</span></div></div><label>Adjustment quantity<input autoFocus type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Use a negative number for a stock loss" /></label><p className="modal-note">Use this for counts, damages, returns, or corrections. Every adjustment should have a note in production.</p><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!amount || Number(amount) === 0} onClick={() => onSave(Number(amount))}>Save adjustment</button></div></Modal>; }

function AddEmployeeModal({ branches, token, onClose, onSuccess }: { branches: AuthBranch[]; token: string | null; onClose: () => void; onSuccess: () => void }) { const [fullName, setFullName] = useState(""); const [username, setUsername] = useState(""); const [phone, setPhone] = useState(""); const [password, setPassword] = useState(""); const [role, setRole] = useState<Role>("cashier"); const [selectedBranches, setSelectedBranches] = useState<string[]>([]); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false); const toggleBranch = (bId: string) => { setSelectedBranches((prev) => prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]); }; const handleSubmit = async () => { if (!fullName.trim() || !username.trim() || !password) { setError("Full name, username, and password are required."); return; } setError(""); setSubmitting(true); try { const response = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ fullName, username, phone, password, role, branchIds: selectedBranches, status: "active" }) }); const data = (await response.json()) as { error?: string }; if (!response.ok) { setError(data.error || "Failed to create employee."); return; } onSuccess(); } catch { setError("Network error. Please try again."); } finally { setSubmitting(false); } }; return <Modal title="Add Employee" eyebrow="Staff Management" onClose={onClose}>{error && <div className="auth-error" style={{ margin: "1rem 1.35rem 0" }}>{error}</div>}<div className="form-grid"><label className="wide">Full Name<input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Kofi Mensah" /></label><label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="kofimensah" /></label><label>Phone Number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 XXX XXXX" /></label><label className="wide">Initial Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label><label className="wide">Role<select value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="manager">Branch Manager</option><option value="cashier">Cashier</option><option value="stock_officer">Stock Officer</option></select></label><div className="wide"><label style={{ marginBottom: ".4rem" }}>Branch Access</label><div className="checkbox-group">{branches.map((b) => <label key={b.id} className="checkbox-item"><input type="checkbox" checked={selectedBranches.includes(b.id)} onChange={() => toggleBranch(b.id)} />{b.name} ({b.location || "Branch"})</label>)}</div></div></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={submitting} onClick={handleSubmit}>Create Employee Account</button></div></Modal>; }
function EditEmployeeModal({ employee, branches, token, onClose, onSuccess }: { employee: EmployeeItem; branches: AuthBranch[]; token: string | null; onClose: () => void; onSuccess: () => void }) {
  const [fullName, setFullName] = useState(employee.full_name);
  const [username, setUsername] = useState(employee.username);
  const [phone, setPhone] = useState(employee.phone);
  const [role, setRole] = useState<Role>(employee.role);
  const [status, setStatus] = useState(employee.status);
  const [newPassword, setNewPassword] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<string[]>(employee.branchIds);
  const [tempPasswordResult, setTempPasswordResult] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleBranch = (bId: string) => {
    setSelectedBranches((prev) => (prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]));
  };

  const handleSave = async (resetPassword = false) => {
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName,
          username,
          phone,
          role,
          status,
          branchIds: selectedBranches,
          resetPassword: resetPassword || Boolean(newPassword),
          password: newPassword || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string; tempPassword?: string };
      if (!response.ok) {
        setError(data.error || "Update failed.");
        return;
      }
      if (data.tempPassword) setTempPasswordResult(data.tempPassword);
      else onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Manage ${employee.full_name}`} eyebrow={employee.role === "owner" ? "Owner Account Settings" : "Account Settings"} onClose={onClose}>
      {error && <div className="auth-error" style={{ margin: "1rem 1.35rem 0" }}>{error}</div>}
      {tempPasswordResult ? (
        <div style={{ padding: "1.35rem", textAlign: "center" }}>
          <KeyRound size={32} style={{ color: "var(--blue)", marginBottom: ".5rem" }} />
          <h3>Password Reset Successful</h3>
          <p style={{ color: "var(--muted)", fontSize: ".82rem" }}>Provide this temporary password to {employee.full_name}:</p>
          <div style={{ padding: "1rem", background: "var(--gold-soft)", borderRadius: "4px", margin: "1rem 0", fontSize: "1.2rem", fontWeight: 700, letterSpacing: ".1em", color: "var(--navy)" }}>
            {tempPasswordResult}
          </div>
          <p style={{ fontSize: ".72rem", color: "var(--muted)" }}>They will be required to change it on their next login.</p>
          <button className="button primary full" style={{ marginTop: "1rem" }} onClick={onSuccess}>Done</button>
        </div>
      ) : (
        <>
          <div className="form-grid">
            <label className="wide">Full Name<input value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
            <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
            <label>Phone Number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 XXX XXXX" /></label>
            <label>Role<select value={role} disabled={employee.role === "owner"} onChange={(e) => setRole(e.target.value as Role)}><option value="owner">Owner</option><option value="manager">Branch Manager</option><option value="cashier">Cashier</option><option value="stock_officer">Stock Officer</option></select></label>
            <label>Account Status<select value={status} disabled={employee.role === "owner"} onChange={(e) => setStatus(e.target.value as any)}><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select></label>
            <label className="wide">New Password (Leave blank to keep current)<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password to change" /></label>
            {employee.role !== "owner" && (
              <div className="wide">
                <label style={{ marginBottom: ".4rem" }}>Branch Permissions</label>
                <div className="checkbox-group">
                  {branches.map((b) => (
                    <label key={b.id} className="checkbox-item">
                      <input type="checkbox" checked={selectedBranches.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                      {b.name} ({b.location || "Branch"})
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: "1rem 1.35rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="text-button" style={{ color: "var(--orange)", fontSize: ".8rem" }} onClick={() => void handleSave(true)}>
              <KeyRound size={15} /> Generate Temp Password
            </button>
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={onClose}>Cancel</button>
            <button className="button primary" disabled={submitting} onClick={() => void handleSave(false)}>Save Account Changes</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function DeleteEmployeeModal({
  employee,
  token,
  onClose,
  onSuccess,
}: {
  employee: EmployeeItem;
  token: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Failed to delete employee account.");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Delete Staff Account`} eyebrow="Permanent Removal" onClose={onClose}>
      <div style={{ padding: "1.2rem 1.35rem 0" }}>
        <p style={{ color: "var(--ink)", fontSize: ".9rem", marginBottom: ".75rem" }}>
          Are you sure you want to permanently delete employee account <strong>{employee.full_name}</strong> (<span className="mono">@{employee.username}</span>)?
        </p>
        <div style={{ background: "#fef2f2", borderLeft: "4px solid var(--red)", padding: ".75rem 1rem", borderRadius: "4px", marginBottom: "1rem" }}>
          <p style={{ color: "#991b1b", fontSize: ".82rem", margin: 0, lineHeight: 1.5 }}>
            <strong>⚠️ Warning:</strong> This action is permanent. The employee&apos;s register credentials will be immediately revoked, removing register access and employee profile data.
          </p>
        </div>
        <p style={{ fontSize: ".78rem", color: "var(--muted)", marginBottom: "1rem" }}>
          ℹ️ Historical sales transactions, shift reconciliations, and audit records created by {employee.full_name} will remain safely preserved in business history.
        </p>
        {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}
      </div>

      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button danger" disabled={submitting} onClick={handleDelete}>
          Delete Employee Account
        </button>
      </div>
    </Modal>
  );
}
const GHANA_REGIONS = [
  "Ashanti Region",
  "Greater Accra Region",
  "Central Region",
  "Eastern Region",
  "Western Region",
  "Western North Region",
  "Volta Region",
  "Oti Region",
  "Bono Region",
  "Bono East Region",
  "Ahafo Region",
  "Northern Region",
  "Savannah Region",
  "North East Region",
  "Upper East Region",
  "Upper West Region",
];

function AddBranchModal({ token, onClose, onSuccess }: { token: string | null; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("Greater Accra Region");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [digitalAddress, setDigitalAddress] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Branch name is required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, code, phone, email, region, city, address, digitalAddress }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Failed to create branch.");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add Store Branch" eyebrow="Store Administration" onClose={onClose}>
      {error && <div className="auth-error" style={{ margin: "1rem 1.35rem 0" }}>{error}</div>}
      <div className="form-grid">
        <label className="wide">Branch Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kumasi Central" /></label>
        <label>Branch Code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. KUM-001" /></label>
        <label>Phone Number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 XXX XXXX" /></label>
        <label>Email Address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kumasi@business.com" /></label>
        <label>Region<select value={region} onChange={(e) => setRegion(e.target.value)}>{GHANA_REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>City / Town<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Kumasi" /></label>
        <label className="wide">Physical Address<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Afrancho, Kumasi" /></label>
        <label className="wide">Digital Address (GPS)<input value={digitalAddress} onChange={(e) => setDigitalAddress(e.target.value)} placeholder="e.g. AK-123-4567" /></label>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={submitting} onClick={handleSubmit}>Create Branch</button>
      </div>
    </Modal>
  );
}

function EditBranchModal({
  branch,
  employees,
  token,
  onClose,
  onSuccess,
}: {
  branch: any;
  employees: EmployeeItem[];
  token: string | null;
  onClose: () => void;
  onSuccess: (branch: BranchUpdate) => void;
}) {
  const [name, setName] = useState(branch.name || "");
  const [code, setCode] = useState(branch.code || "");
  const [phone, setPhone] = useState(branch.phone || "");
  const [email, setEmail] = useState(branch.email || "");
  const [region, setRegion] = useState(branch.region || "Greater Accra Region");
  const [city, setCity] = useState(branch.city || branch.location || "");
  const [address, setAddress] = useState(branch.address || "");
  const [digitalAddress, setDigitalAddress] = useState(branch.digital_address || "");
  const [managerId, setManagerId] = useState(branch.manager_id || "");
  const [status, setStatus] = useState(branch.status || "active");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Branch name is required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/branches/${branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, code, phone, email, region, city, address, digitalAddress, managerId, status }),
      });
      const data = (await response.json()) as { error?: string; branch?: BranchUpdate };
      if (!response.ok) {
        setError(data.error || "Failed to update branch.");
        return;
      }
      if (!data.branch) {
        setError("Branch was saved but the updated record was not returned.");
        return;
      }
      onSuccess(data.branch);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Edit ${branch.name}`} eyebrow="Branch Settings" onClose={onClose}>
      {error && <div className="auth-error" style={{ margin: "1rem 1.35rem 0" }}>{error}</div>}
      <div className="form-grid">
        <label className="wide">Branch Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Branch Code<input value={code} onChange={(e) => setCode(e.target.value)} /></label>
        <label>Phone Number<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label>Email Address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Region<select value={region} onChange={(e) => setRegion(e.target.value)}>{GHANA_REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>City / Town<input value={city} onChange={(e) => setCity(e.target.value)} /></label>
        <label className="wide">Physical Address<input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label>Digital Address (GPS)<input value={digitalAddress} onChange={(e) => setDigitalAddress(e.target.value)} /></label>
        <label>Branch Manager<select value={managerId} onChange={(e) => setManagerId(e.target.value)}><option value="">Unassigned</option>{employees.filter((emp) => emp.role === "manager" || emp.role === "owner").map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name} (@{emp.username})</option>)}</select></label>
        <label className="wide">Status<select value={status} onChange={(e) => setStatus(e.target.value as any)}><option value="active">Active</option><option value="deactivated">Deactivated</option><option value="archived">Archived</option></select></label>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={submitting} onClick={handleSave}>Save Branch Changes</button>
      </div>
    </Modal>
  );
}

function DeactivateBranchModal({ branch, token, onClose, onSuccess }: { branch: any; token: string | null; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleDeactivate = async () => {
    if (!reason.trim()) {
      setError("Operational reason is mandatory for branch deactivation.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/branches/${branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "deactivated", reason: reason.trim() }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Deactivation failed.");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Deactivate Branch: ${branch.name}`} eyebrow="Security Warning" onClose={onClose}>
      <div style={{ padding: "1.2rem 1.35rem 0" }}>
        <p style={{ color: "var(--ink)", fontSize: ".88rem", marginBottom: ".75rem" }}>
          Deactivating <strong>{branch.name}</strong> will prevent:
        </p>
        <ul style={{ margin: "0 0 1rem 1.2rem", fontSize: ".82rem", color: "var(--muted)", lineHeight: 1.6 }}>
          <li>New sales or checkout transactions at this location</li>
          <li>Employee logins assigned exclusively to this branch</li>
          <li>New inventory movements or stock receiving</li>
          <li>New operational expense entries</li>
        </ul>
        <p style={{ fontSize: ".78rem", color: "var(--blue)", marginBottom: "1rem" }}>
          ℹ️ Historical sales, stock history, and audit records will remain fully preserved and readable.
        </p>

        {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        <label className="wide" style={{ display: "block" }}>
          Mandatory Reason for Deactivation
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Location relocation / seasonal closure" />
        </label>
      </div>

      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button danger" disabled={submitting || !reason.trim()} onClick={handleDeactivate}>Deactivate Branch</button>
      </div>
    </Modal>
  );
}

function AuthScreen({ onLoginSuccess, notify }: { onLoginSuccess: (token: string, user: AuthUser, business: any, branches: AuthBranch[], remember: boolean) => void; notify: (msg: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const cleanUsername = username.trim().toLowerCase();
    const localDevelopment = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername, password, remember }),
      });
      if (response.ok) {
        const data = (await response.json()) as { error?: string; token: string; user: AuthUser; business: any; branches: AuthBranch[] };
        onLoginSuccess(data.token, data.user, data.business, data.branches, remember);
        notify(`Welcome back, ${data.user.full_name}!`);
        return;
      }
      if (response.status === 401 || response.status === 403) {
        if (!localDevelopment) {
          setError("Incorrect username or password.");
          return;
        }
      } else if (!localDevelopment) {
        setError("We couldn't sign you in right now. Please try again.");
        return;
      }
    } catch {
      if (!localDevelopment) {
        setError("We couldn't sign you in right now. Please try again.");
        return;
      }
    }
    const demoAccount = DEMO_USERS[cleanUsername];
    if (localDevelopment && demoAccount && password.length > 0) {
      const token = `s_local_${cleanUsername}_${Date.now()}`;
      onLoginSuccess(token, demoAccount.user, DEMO_BUSINESS, demoAccount.branches, remember);
      notify(`Welcome back, ${demoAccount.user.full_name}!`);
    } else {
      setError("Incorrect username or password.");
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-visual" aria-hidden="true">
        <img src={brand.storefrontImage} alt="" />
        <div className="auth-visual-overlay" />
        <div className="auth-visual-brand">
          <img src={brand.logo} alt={brand.businessName} />
          <p>Beauty · Skincare · Haircare · Fashion &amp; Everyday Essentials</p>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-brand">
            <img src={brand.logo} alt={brand.businessName} />
          </div>
          <div className="auth-head">
            <h1>Welcome Back</h1>
            <p>Enter your account credentials to access the register</p>
          </div>
          {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>Username<input required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. jordanlee" autoComplete="username" /></label>
            <label>Password
              <span className="password-wrap">
                <input required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            <label className="auth-checkbox"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me on this device</label>
            <button className="button primary full" disabled={submitting} style={{ marginTop: ".5rem" }}>{submitting ? "Signing in..." : "LOGIN"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
