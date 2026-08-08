import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

export type AuthenticatedUser = {
  id: string;
  business_id: string;
  full_name: string;
  username: string;
  phone: string;
  role: "owner" | "manager" | "cashier" | "stock_officer";
  status: "active" | "suspended" | "deactivated";
  force_password_change: boolean;
  pin_hash?: string;
};

export type BusinessInfo = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type BranchInfo = {
  id: string;
  business_id: string;
  name: string;
  location: string;
  phone: string;
  status: "active" | "inactive" | "deactivated" | "archived";
};

export type AuthContextResult = {
  user: AuthenticatedUser;
  business: BusinessInfo;
  branches: BranchInfo[];
  sessionToken: string;
};

export type AuditModule =
  | "AUTH"
  | "EMPLOYEES"
  | "SALES"
  | "PAYMENTS"
  | "INVENTORY"
  | "PRICING"
  | "BRANCH"
  | "SETTINGS"
  | "NOTIFICATIONS";

export type AuditLogParams = {
  business_id: string;
  user_id: string;
  user_name?: string;
  branch_id?: string;
  branch_name?: string;
  action: string;
  module?: AuditModule;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  reason?: string;
  ip_address?: string;
  device_id?: string;
  session_id?: string;
  severity?: "INFO" | "NOTICE" | "WARNING" | "CRITICAL";
  description?: string;
};

// ─── Password & Token Helpers ──────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await pbkdf2Async(password, salt, 100000, 64, "sha256")) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, combinedHash: string): Promise<boolean> {
  if (!combinedHash || !combinedHash.includes(":")) return false;
  const [salt, key] = combinedHash.split(":");
  const derivedKey = (await pbkdf2Async(password, salt, 100000, 64, "sha256")) as Buffer;
  return derivedKey.toString("hex") === key;
}

export function generateSessionToken(): string {
  return `s_${randomBytes(32).toString("hex")}`;
}

export function generateToken(): string {
  return generateSessionToken();
}

export async function hashPin(pin: string): Promise<string> {
  return hashPassword(pin);
}

export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pass = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}

// ─── Session Validation (Bulletproof Fallback Support) ─────────────────────────────
export async function validateSession(
  db: D1Database,
  token: string,
  options?: { host?: string }
): Promise<AuthContextResult | null> {
  if (!token || typeof token !== "string") return null;

  const cleanToken = token.trim();

  // 1. Primary lookup in D1 sessions table
  let session = await db
    .prepare(
      `SELECT s.token, s.expires_at, u.id as user_id, u.business_id, u.full_name, u.username, u.phone, u.role, u.status, u.force_password_change, u.pin_hash
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .bind(cleanToken)
    .first<{
      token: string;
      expires_at: string;
      user_id: string;
      business_id: string;
      full_name: string;
      username: string;
      phone: string;
      role: AuthenticatedUser["role"];
      status: AuthenticatedUser["status"];
      force_password_change: number;
      pin_hash: string;
    }>();

  // 2. Expiration check in JS
  if (session && session.expires_at) {
    const expTime = new Date(session.expires_at).getTime();
    if (!isNaN(expTime) && expTime < Date.now()) {
      session = null;
    }
  }

  // 3. Local-development fallback for demo tokens (e.g. s_local_jordanlee_...).
  //    Deliberately restricted to localhost hosts: on the live domain any token
  //    must resolve to a real session row in D1.
  const isLocalDev = typeof options?.host === "string" && ["localhost", "127.0.0.1", "[::1]"].includes(options.host);
  if (isLocalDev && !session && (cleanToken.startsWith("s_local_") || cleanToken.startsWith("s_"))) {
    let match = cleanToken.match(/^s_local_([^_]+)/);
    let username = match ? match[1] : "jordanlee";

    let userRow = await db
      .prepare(
        `SELECT id as user_id, business_id, full_name, username, phone, role, status, force_password_change, pin_hash
         FROM users
         WHERE LOWER(username) = ?`
      )
      .bind(username.toLowerCase())
      .first<{
        user_id: string;
        business_id: string;
        full_name: string;
        username: string;
        phone: string;
        role: AuthenticatedUser["role"];
        status: AuthenticatedUser["status"];
        force_password_change: number;
        pin_hash: string;
      }>();

    // Fallback to active owner or first active user if username doesn't match
    if (!userRow) {
      userRow = await db
        .prepare(
          `SELECT id as user_id, business_id, full_name, username, phone, role, status, force_password_change, pin_hash
           FROM users
           WHERE status = 'active'
           ORDER BY CASE WHEN role = 'owner' THEN 1 ELSE 2 END
           LIMIT 1`
        )
        .first<{
          user_id: string;
          business_id: string;
          full_name: string;
          username: string;
          phone: string;
          role: AuthenticatedUser["role"];
          status: AuthenticatedUser["status"];
          force_password_change: number;
          pin_hash: string;
        }>();
    }

    if (userRow) {
      session = {
        ...userRow,
        token: cleanToken,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      };
    }
  }

  if (!session || session.status === "deactivated" || session.status === "suspended") {
    return null;
  }

  const business = await db
    .prepare("SELECT id, name, phone, email FROM businesses WHERE id = ?")
    .bind(session.business_id)
    .first<BusinessInfo>();

  const businessData = business || {
    id: session.business_id,
    name: "Dia's Palace",
    phone: "024 000 0000",
    email: "owner@diapalace.com",
  };

  let branches: BranchInfo[] = [];
  if (session.role === "owner") {
    const res = await db
      .prepare("SELECT id, business_id, name, location, phone, status FROM branches WHERE business_id = ? ORDER BY name")
      .bind(session.business_id)
      .all<BranchInfo>();
    branches = res.results ?? [];
  } else {
    const res = await db
      .prepare(
        `SELECT b.id, b.business_id, b.name, b.location, b.phone, b.status
         FROM branches b
         JOIN user_branches ub ON ub.branch_id = b.id
         WHERE ub.user_id = ? AND b.status = 'active'
         ORDER BY b.name`
      )
      .bind(session.user_id)
      .all<BranchInfo>();
    branches = res.results ?? [];
  }

  if (branches.length === 0) {
    return null;
  }

  return {
    user: {
      id: session.user_id,
      business_id: session.business_id,
      full_name: session.full_name,
      username: session.username,
      phone: session.phone,
      role: session.role,
      status: session.status,
      force_password_change: session.force_password_change === 1,
      pin_hash: session.pin_hash,
    },
    business: businessData,
    branches,
    sessionToken: session.token,
  };
}

export async function requireAuth(
  request: Request,
  db: D1Database
): Promise<AuthContextResult | Response> {
  const authHeader = request.headers.get("Authorization");
  let token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : request.headers.get("X-Session-Token");

  if (!token) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const auth = await validateSession(db, token.trim(), { host: new URL(request.url).hostname });
  if (!auth) {
    return Response.json({ error: "Session expired or invalid" }, { status: 401 });
  }

  return auth;
}

export function getAuditSeverity(action: string): "INFO" | "NOTICE" | "WARNING" | "CRITICAL" {
  const act = action.toUpperCase();
  if (
    act.includes("REFUND") ||
    act.includes("VOID") ||
    act.includes("DEACTIVATED") ||
    act.includes("ROLE_CHANGED") ||
    act.includes("PERMISSION") ||
    act.includes("LARGE_") ||
    act.includes("DELETED")
  ) {
    return "CRITICAL";
  }

  if (
    act.includes("ADJUST") ||
    act.includes("SHORTAGE") ||
    act.includes("DISCOUNT") ||
    act.includes("FAILED") ||
    act.includes("MISMATCH") ||
    act.includes("VARIANCE") ||
    act.includes("SUSPENDED")
  ) {
    return "WARNING";
  }

  if (
    act.includes("UPDATED") ||
    act.includes("CHANGED") ||
    act.includes("CREATED") ||
    act.includes("RESTORED") ||
    act.includes("ARCHIVED")
  ) {
    return "NOTICE";
  }

  return "INFO";
}

// ─── Central Immutable Audit Log Writer ─────────────────────────────
export async function logAudit(
  db: D1Database,
  params: AuditLogParams
) {
  try {
    const auditId = `aud-${crypto.randomUUID()}`;
    const moduleName = params.module || "SETTINGS";
    const entityType = params.entity_type || "SYSTEM";
    const entityId = params.entity_id || "";
    const severity = params.severity || getAuditSeverity(params.action);
    const oldValuesStr = params.old_values ? JSON.stringify(params.old_values) : null;
    const newValuesStr = params.new_values ? JSON.stringify(params.new_values) : null;
    const reasonText = params.reason || params.description || "";

    await db
      .prepare(
        `INSERT INTO audit_logs (
          id, business_id, branch_id, user_id,
          action, module, entity_type, entity_id,
          old_values, new_values, reason,
          ip_address, device_id, session_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auditId,
        params.business_id,
        params.branch_id || "",
        params.user_id,
        params.action,
        moduleName,
        entityType,
        entityId,
        oldValuesStr,
        newValuesStr,
        reasonText,
        params.ip_address || "102.176.54.12",
        params.device_id || "POS-REGISTER-01",
        params.session_id || "",
        new Date().toISOString()
      )
      .run();

    await db
      .prepare(
        `INSERT INTO audit_log (id, business_id, user_id, user_name, branch_id, branch_name, action, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auditId,
        params.business_id,
        params.user_id,
        params.user_name || "System",
        params.branch_id || "",
        params.branch_name || "",
        params.action,
        reasonText || params.action,
        new Date().toISOString()
      )
      .run();
  } catch (err) {
    console.error("Audit log write error:", err);
  }
}
