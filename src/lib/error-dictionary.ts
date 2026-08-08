const FRIENDLY_ERROR_MAP: Record<string, string> = {
  // Username & User errors
  EMPLOYEE_USERNAME_EXISTS: "That username is already in use. Please choose another username.",
  "Username is already taken.": "That username is already in use. Please choose another username.",
  EMPLOYEE_NOT_FOUND: "The requested employee account could not be found.",
  "Employee account not found.": "The requested employee account could not be found.",
  EMPLOYEE_DEACTIVATED: "This staff account is currently deactivated. Please contact management.",
  "You cannot delete your own active owner account.": "Active owner accounts cannot be deleted to preserve business administration access.",
  "Only the business owner can delete staff accounts.": "Staff deletion requires business owner access permissions.",

  // Branch errors
  BRANCH_HAS_RECORDS: "This branch cannot be permanently deleted because it contains historical business records. Recommended action: Archive Branch.",
  "Cannot permanently delete. This branch contains historical business records. Recommended action: Archive Branch.":
    "This branch cannot be permanently deleted because it contains historical business records. Recommended action: Archive Branch.",
  "Operational reason is mandatory for branch deactivation.": "Please provide a valid operational reason before deactivating a store branch.",

  // Auth & Session errors
  INVALID_PASSWORD: "The password you entered is incorrect. Please check your credentials.",
  "Invalid username or password.": "Incorrect username or password. Please verify your credentials.",
  SESSION_EXPIRED: "Your register session has expired. Please sign in again.",
  "Session expired or invalid": "Your register session has expired. Please sign in again to continue.",
  INSUFFICIENT_PERMISSION: "You do not have access permission for this administrative action.",
  "Access denied.": "You do not have administrative permission for this action.",

  // Inventory & Sales errors
  INSUFFICIENT_STOCK: "There is not enough stock available to complete this transaction.",
  INVALID_DISCOUNT: "Discount exceeds cashier limit (5%). Manager override is required.",

  // Network & System errors
  NETWORK_UNAVAILABLE: "Network connection unavailable. Please check your internet connection.",
  "Network error. Please try again.": "Network connection unavailable. Please check your connection and try again.",
  "Network error.": "Network connection unavailable. Please check your connection and try again.",
  "Failed to fetch": "Unable to connect to register services. Please verify network connectivity.",
  SERVER_ERROR: "Unable to complete action right now. Please try again.",
};

export function getFriendlyErrorMessage(err: unknown, defaultMessage = "Unable to complete action right now. Please try again."): string {
  if (!err) return defaultMessage;

  let rawMsg = "";
  if (typeof err === "string") rawMsg = err;
  else if (typeof err === "object" && err !== null && "message" in err) {
    rawMsg = String((err as any).message);
  } else if (typeof err === "object" && err !== null && "error" in err) {
    rawMsg = String((err as any).error);
  }

  if (!rawMsg) return defaultMessage;

  // Direct map check
  if (FRIENDLY_ERROR_MAP[rawMsg]) return FRIENDLY_ERROR_MAP[rawMsg];

  // Substring checks for technical leak prevention
  const upper = rawMsg.toUpperCase();
  if (upper.includes("UNIQUE") || upper.includes("CONSTRAINT")) {
    return "This record or identifier already exists in the system.";
  }
  if (upper.includes("FOREIGN KEY") || upper.includes("HISTORICAL")) {
    return "This item cannot be deleted because historical transaction records depend on it.";
  }
  if (upper.includes("SYNTAX") || upper.includes("TYPEERROR") || upper.includes("SQL")) {
    return "An unexpected service error occurred. Please try again.";
  }
  if (upper.includes("500") || upper.includes("FETCH")) {
    return "Server service temporarily unreachable. Please try again.";
  }

  // Fallback to raw string if clean and non-technical
  if (!rawMsg.includes("{") && !rawMsg.includes(":") && !rawMsg.includes("Prisma") && !rawMsg.includes("SQL")) {
    return rawMsg;
  }

  return defaultMessage;
}
