export type FormattedDiff = {
  field: string;
  before: string;
  after: string;
};

const ACTION_DICTIONARY: Record<string, string> = {
  // AUTH
  LOGIN_SUCCESS: "Staff Login",
  LOGIN_FAILED: "Failed Login Attempt",
  LOGOUT: "Staff Logout",
  PASSWORD_CHANGED: "Password Updated",
  PASSWORD_RESET: "Employee Password Reset",
  ACCOUNT_LOCKED: "Register Account Locked",
  ACCOUNT_UNLOCKED: "Register Account Unlocked",

  // EMPLOYEES
  EMPLOYEE_CREATED: "New Employee Created",
  EMPLOYEE_UPDATED: "Employee Details Updated",
  EMPLOYEE_DEACTIVATED: "Employee Deactivated",
  EMPLOYEE_REACTIVATED: "Employee Reactivated",
  EMPLOYEE_DELETED: "Employee Account Deleted",
  ROLE_CHANGED: "Employee Role Changed",
  BRANCH_ACCESS_GRANTED: "Branch Access Granted",
  BRANCH_ACCESS_REMOVED: "Branch Access Revoked",
  PERMISSION_CHANGED: "Permissions Updated",

  // SALES
  SALE_CREATED: "New Sale Started",
  SALE_COMPLETED: "Sale Completed",
  SALE_VOIDED: "Sale Voided",
  SALE_RETURNED: "Items Returned",
  SALE_REFUNDED: "Sale Refunded",

  // PAYMENTS
  PAYMENT_RECEIVED: "Payment Received",
  PAYMENT_FAILED: "Payment Failed",
  PAYMENT_REVERSED: "Payment Reversed",
  PAYMENT_REFUNDED: "Payment Refunded",
  PAYMENT_RECONCILED: "Payment Reconciled",
  CASH_SHORTAGE: "Cash Drawer Shortage Logged",

  // INVENTORY
  STOCK_RECEIVED: "Inventory Stock Received",
  STOCK_ADJUSTMENT: "Inventory Adjusted",
  STOCK_ADJUSTED: "Inventory Adjusted",
  STOCK_TRANSFER_CREATED: "Stock Transfer Manifest Created",
  STOCK_TRANSFER_DISPATCHED: "Stock Transfer Dispatched",
  STOCK_TRANSFER_RECEIVED: "Stock Transfer Received",
  STOCK_TRANSFER_REJECTED: "Stock Transfer Rejected",
  STOCK_DAMAGED: "Damaged Stock Recorded",
  STOCK_EXPIRED: "Expired Stock Recorded",
  STOCK_VARIANCE_DETECTED: "Stock Count Variance Detected",

  // PRICING
  PRODUCT_CREATED: "New Product Cataloged",
  PRODUCT_UPDATED: "Product Details Updated",
  PRICE_CHANGED: "Product Price Changed",
  PRODUCT_DEACTIVATED: "Product Discontinued",
  PRODUCT_REACTIVATED: "Product Restored",

  // BRANCHES
  BRANCH_CREATED: "New Branch Created",
  BRANCH_UPDATED: "Branch Details Updated",
  BRANCH_DEACTIVATED: "Branch Deactivated",
  BRANCH_REACTIVATED: "Branch Restored to Active",
  BRANCH_ARCHIVED: "Branch Archived",
  BRANCH_RESTORED: "Branch Restored",
  BRANCH_MANAGER_CHANGED: "Branch Manager Reassigned",

  // EXPENSES
  EXPENSE_CREATED: "Expense Recorded",
  EXPENSE_UPDATED: "Expense Details Updated",
  EXPENSE_VOIDED: "Expense Voided",
  EXPENSE_APPROVED: "Expense Approved",

  // SETTINGS
  BUSINESS_UPDATED: "Business Profile Updated",
  TAX_SETTINGS_CHANGED: "Tax Rate Settings Updated",
  PAYMENT_SETTINGS_CHANGED: "Payment Options Updated",
  RECEIPT_SETTINGS_CHANGED: "Receipt Format Updated",
  SECURITY_SETTINGS_CHANGED: "Security Controls Updated",
};

const FIELD_DICTIONARY: Record<string, string> = {
  full_name: "Full Name",
  username: "Username",
  phone: "Phone Number",
  role: "Employee Role",
  status: "Account Status",
  login_access: "Login Access",
  selling_price: "Selling Price",
  cost_price: "Cost Price",
  stock_quantity: "Stock Quantity",
  reorder_level: "Reorder Alert Level",
  name: "Name",
  code: "Branch Code",
  region: "Region",
  city: "City / Town",
  address: "Physical Address",
  digital_address: "Digital Address (GPS)",
  manager_id: "Assigned Manager",
  tax_enabled: "Tax Enabled",
  tax_rate: "Tax Rate (%)",
};

export function formatAuditActionTitle(action: string): string {
  if (!action) return "Business Activity Logged";
  const upper = action.toUpperCase();
  return ACTION_DICTIONARY[upper] || action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function formatAuditChanges(oldVal: any, newVal: any): FormattedDiff[] {
  let oldObj: Record<string, any> | null = null;
  let newObj: Record<string, any> | null = null;

  try {
    if (oldVal) oldObj = typeof oldVal === "string" ? JSON.parse(oldVal) : oldVal;
    if (newVal) newObj = typeof newVal === "string" ? JSON.parse(newVal) : newVal;
  } catch {
    // quiet parse fail
  }

  if (!oldObj && !newObj) return [];

  const keys = Array.from(new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]));
  const diffs: FormattedDiff[] = [];

  for (const k of keys) {
    // Ignore internal keys
    if (k === "id" || k === "business_id" || k === "created_at" || k === "updated_at") continue;

    const label = FIELD_DICTIONARY[k] || k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    let beforeVal = oldObj?.[k] !== undefined ? String(oldObj[k]) : "—";
    let afterVal = newObj?.[k] !== undefined ? String(newObj[k]) : "—";

    // Value formatting improvements
    if (beforeVal === "true") beforeVal = "Enabled";
    if (beforeVal === "false") beforeVal = "Disabled";
    if (afterVal === "true") afterVal = "Enabled";
    if (afterVal === "false") afterVal = "Disabled";

    if (k === "status") {
      beforeVal = beforeVal.charAt(0).toUpperCase() + beforeVal.slice(1);
      afterVal = afterVal.charAt(0).toUpperCase() + afterVal.slice(1);
    }

    if (beforeVal !== afterVal) {
      diffs.push({ field: label, before: beforeVal, after: afterVal });
    }
  }

  return diffs;
}

export function formatAuditSummary(log: any): string {
  const actor = log.user_name || "System";
  const actionTitle = formatAuditActionTitle(log.action);
  const branch = log.branch_name || "Store";

  if (log.reason && !log.reason.toLowerCase().includes("performed by")) {
    return `${log.reason} (${actor} at ${branch})`;
  }

  return `${actionTitle} performed by ${actor} at ${branch}.`;
}
