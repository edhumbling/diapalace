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

export type FeatureRoute = {
  category: string;
  label: string;
  path: string;
  view: View;
};

export const FEATURE_ROUTES: FeatureRoute[] = [
  { category: "Overview", label: "Dashboard", path: "/dashboard", view: "dashboard" },
  { category: "Operations", label: "New Sale", path: "/sell/checkout", view: "checkout" },
  { category: "Operations", label: "Sales", path: "/understand/sales", view: "sales" },
  { category: "Operations", label: "Inventory", path: "/manage/inventory", view: "inventory" },
  { category: "Operations", label: "Close Shift", path: "/understand/reconciliation", view: "reconciliation" },
  { category: "Operations", label: "Stock Transfers", path: "/manage/transfers", view: "transfers" },
  { category: "Insights", label: "Reports", path: "/understand/reports", view: "reports" },
  { category: "Management", label: "Employees", path: "/administration/employees", view: "employees" },
  { category: "Management", label: "Branches", path: "/administration/branches", view: "branches" },
  { category: "Control", label: "Audit Trail", path: "/administration/audit", view: "audit" },
  { category: "System", label: "Settings", path: "/workspace/settings", view: "settings" },
  { category: "System", label: "Notifications", path: "/workspace/notifications", view: "notifications" },
  { category: "Management", label: "Customers", path: "/manage/customers", view: "customers" },
  { category: "Management", label: "Purchases", path: "/manage/purchases", view: "purchases" },
  { category: "Management", label: "Expenses", path: "/manage/expenses", view: "expenses" },
];

export function getFeatureRoute(view: View) {
  return FEATURE_ROUTES.find((route) => route.view === view) ?? FEATURE_ROUTES[0];
}

export function getViewForPath(path: string) {
  const direct = FEATURE_ROUTES.find((route) => route.path === path)?.view;
  if (direct) return direct;
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "branches" || parts.length < 3) return undefined;
  const branchSlug = parts.slice(2).join("/");
  const branchRoute: Record<string, View> = { dashboard: "dashboard", "new-sale": "checkout", sales: "sales", inventory: "inventory", "cash-up": "reconciliation", reports: "reports", employees: "employees", branches: "branches", notifications: "notifications", "audit-trail": "audit", settings: "settings", "stock-transfers": "transfers", customers: "customers", purchases: "purchases", expenses: "expenses" };
  return branchRoute[branchSlug];
}

export function getFeaturePath(view: View, branchId?: string | null) {
  if (!branchId) return getFeatureRoute(view).path;
  const branchSlug: Record<View, string> = { dashboard: "dashboard", checkout: "new-sale", sales: "sales", inventory: "inventory", reconciliation: "cash-up", reports: "reports", employees: "employees", branches: "branches", notifications: "notifications", audit: "audit-trail", settings: "settings", transfers: "stock-transfers", customers: "customers", purchases: "purchases", expenses: "expenses" };
  return `/branches/${encodeURIComponent(branchId)}/${branchSlug[view]}`;
}

export function getBranchIdForPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts[0] === "branches" && parts[1] ? decodeURIComponent(parts[1]) : null;
}
