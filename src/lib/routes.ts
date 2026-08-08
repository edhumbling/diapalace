import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Building2,
  Landmark,
  LayoutDashboard,
  Lock,
  PackageOpen,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Truck,
  UserCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { Role } from "@/lib/auth-context";

export type View =
  | "dashboard"
  | "checkout"
  | "inventory"
  | "customers"
  | "sales"
  | "purchases"
  | "expenses"
  | "transfers"
  | "reconciliation"
  | "reports"
  | "employees"
  | "branches"
  | "audit"
  | "settings"
  | "notifications";

export const NAV_CATEGORIES = [
  { id: "overview", label: "Overview" },
  { id: "operations", label: "Operations" },
  { id: "insights", label: "Insights" },
  { id: "management", label: "Management" },
  { id: "workspace", label: "Workspace" },
] as const;

export type CategoryId = (typeof NAV_CATEGORIES)[number]["id"];

export type AppRoute = {
  view: View;
  path: string;
  label: string;
  title: string;
  category: CategoryId;
  icon: LucideIcon;
  roles: Role[] | "all";
};

export type NavGroup = { label: string; items: AppRoute[] };

export const APP_ROUTES: AppRoute[] = [
  { view: "dashboard", path: "/dashboard", label: "Dashboard", title: "Dashboard", category: "overview", icon: LayoutDashboard, roles: "all" },
  { view: "notifications", path: "/notifications", label: "Notifications", title: "Notifications", category: "overview", icon: Bell, roles: "all" },
  { view: "checkout", path: "/sales/new", label: "New Sale", title: "New Sale", category: "operations", icon: ShoppingCart, roles: ["owner", "manager", "cashier"] },
  { view: "sales", path: "/sales", label: "Sales", title: "Sales History", category: "operations", icon: ReceiptText, roles: ["owner", "manager", "cashier"] },
  { view: "inventory", path: "/inventory", label: "Inventory", title: "Inventory", category: "operations", icon: PackageOpen, roles: ["owner", "manager", "stock_officer"] },
  { view: "reconciliation", path: "/cash-up", label: "Close Shift", title: "Close Shift", category: "operations", icon: Landmark, roles: ["owner", "manager", "cashier"] },
  { view: "transfers", path: "/stock-transfers", label: "Stock Transfers", title: "Stock Transfers", category: "operations", icon: Truck, roles: ["owner", "manager", "stock_officer"] },
  { view: "reports", path: "/reports", label: "Reports", title: "Reports", category: "insights", icon: BarChart3, roles: ["owner", "manager"] },
  { view: "employees", path: "/employees", label: "Employees", title: "Employees", category: "management", icon: UserCheck, roles: ["owner", "manager"] },
  { view: "branches", path: "/branches", label: "Branches", title: "Branches", category: "management", icon: Building2, roles: ["owner"] },
  { view: "customers", path: "/customers", label: "Customers", title: "Customers", category: "management", icon: UsersRound, roles: ["owner", "manager", "cashier"] },
  { view: "purchases", path: "/purchases", label: "Purchases", title: "Purchases", category: "management", icon: ShoppingBasket, roles: ["owner", "manager", "stock_officer"] },
  { view: "expenses", path: "/expenses", label: "Expenses", title: "Expenses", category: "management", icon: WalletCards, roles: ["owner", "manager"] },
  { view: "audit", path: "/audit-log", label: "Audit Log", title: "Audit Log", category: "management", icon: ShieldCheck, roles: ["owner"] },
  { view: "settings", path: "/settings", label: "Settings", title: "Settings", category: "workspace", icon: Settings, roles: ["owner"] },
];

export const LOCK_POS_ROUTE = { path: "/lock-pos", label: "Lock POS", title: "Lock POS", category: "workspace" as CategoryId, icon: Lock };

export function getRouteByView(view: View) {
  return APP_ROUTES.find((route) => route.view === view) ?? APP_ROUTES[0];
}

export function getRouteByPath(path: string) {
  return APP_ROUTES.find((route) => route.path === path) ?? APP_ROUTES[0];
}

export function getRoleLandingPath(role: Role) {
  if (role === "cashier") return "/sales/new";
  if (role === "stock_officer") return "/inventory";
  return "/dashboard";
}

export function canAccessRoute(view: View, role: Role) {
  const route = getRouteByView(view);
  return route.roles === "all" || route.roles.includes(role);
}

export function getNavGroupsForRole(role: Role): NavGroup[] {
  return NAV_CATEGORIES.map((category) => ({
    label: category.label,
    items: APP_ROUTES.filter((route) => route.category === category.id && canAccessRoute(route.view, role)),
  })).filter((group) => group.items.length > 0);
}

const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  "/sell/checkout": "/sales/new",
  "/understand/sales": "/sales",
  "/manage/inventory": "/inventory",
  "/understand/reconciliation": "/cash-up",
  "/manage/transfers": "/stock-transfers",
  "/understand/reports": "/reports",
  "/administration/employees": "/employees",
  "/administration/branches": "/branches",
  "/administration/audit": "/audit-log",
  "/workspace/settings": "/settings",
  "/workspace/notifications": "/notifications",
  "/manage/customers": "/customers",
  "/manage/purchases": "/purchases",
  "/manage/expenses": "/expenses",
};

const BRANCH_SLUG_REDIRECTS: Record<string, string> = {
  dashboard: "/dashboard",
  "new-sale": "/sales/new",
  sales: "/sales",
  inventory: "/inventory",
  "cash-up": "/cash-up",
  reports: "/reports",
  employees: "/employees",
  branches: "/branches",
  notifications: "/notifications",
  "audit-trail": "/audit-log",
  settings: "/settings",
  "stock-transfers": "/stock-transfers",
  customers: "/customers",
  purchases: "/purchases",
  expenses: "/expenses",
};

export function normalizeLegacyPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "branches" && parts.length >= 3) {
    return BRANCH_SLUG_REDIRECTS[parts[2]] ?? "/dashboard";
  }
  return LEGACY_ROUTE_REDIRECTS[path] ?? path;
}
