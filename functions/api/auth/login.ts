import { verifyPassword, generateSessionToken, validateSession, logAudit, type AuthenticatedUser } from "../../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const body = await context.request.json() as {
      username?: string;
      password?: string;
    };

    const ipAddress = context.request.headers.get("cf-connecting-ip") || "127.0.0.1";
    const userAgent = context.request.headers.get("user-agent") || "POS Terminal";

    if (!body.username?.trim() || !body.password) {
      return Response.json({ error: "Username and password are required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const cleanUsername = body.username.trim().toLowerCase();

    const userRow = await db
      .prepare(
        `SELECT id, business_id, full_name, username, phone, password_hash, role, status, force_password_change, pin_hash
         FROM users
         WHERE LOWER(username) = ?`
      )
      .bind(cleanUsername)
      .first<{
        id: string;
        business_id: string;
        full_name: string;
        username: string;
        phone: string;
        password_hash: string;
        role: AuthenticatedUser["role"];
        status: AuthenticatedUser["status"];
        force_password_change: number;
        pin_hash: string;
      }>();

    if (!userRow) {
      return Response.json({ error: "Invalid username or password." }, { status: 401 });
    }

    if (userRow.status === "deactivated" || userRow.status === "suspended") {
      await logAudit(db, {
        business_id: userRow.business_id,
        user_id: userRow.id,
        user_name: userRow.full_name,
        module: "AUTH",
        action: "LOGIN_FAILED",
        entity_type: "USER_SESSION",
        entity_id: userRow.id,
        reason: `Login attempt on ${userRow.status} account @${userRow.username}`,
        ip_address: ipAddress,
        device_id: userAgent,
      });

      return Response.json({ error: `Your account is ${userRow.status}. Contact your business owner.` }, { status: 403 });
    }

    const valid = await verifyPassword(body.password, userRow.password_hash);
    if (!valid) {
      await logAudit(db, {
        business_id: userRow.business_id,
        user_id: userRow.id,
        user_name: userRow.full_name,
        module: "AUTH",
        action: "LOGIN_FAILED",
        entity_type: "USER_SESSION",
        entity_id: userRow.id,
        reason: `Failed password attempt for @${userRow.username}`,
        ip_address: ipAddress,
        device_id: userAgent,
      });

      return Response.json({ error: "Invalid username or password." }, { status: 401 });
    }

    // Generate new session
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await db.batch([
      db.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)").bind(
        `s-${crypto.randomUUID()}`,
        userRow.id,
        token,
        expiresAt
      ),
      db.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(now, userRow.id),
    ]);

    const authContext = await validateSession(db, token);
    if (!authContext) {
      return Response.json({ error: "Unable to establish session." }, { status: 500 });
    }

    await logAudit(db, {
      business_id: userRow.business_id,
      user_id: userRow.id,
      user_name: userRow.full_name,
      branch_id: authContext.branches[0]?.id || "",
      branch_name: authContext.branches[0]?.name || "Branch",
      module: "AUTH",
      action: "LOGIN_SUCCESS",
      entity_type: "USER_SESSION",
      entity_id: userRow.id,
      new_values: { username: userRow.username, role: userRow.role },
      reason: `Successful authentication for @${userRow.username} (${userRow.role})`,
      ip_address: ipAddress,
      device_id: userAgent,
      session_id: token,
    });

    return Response.json({
      token,
      user: authContext.user,
      business: authContext.business,
      branches: authContext.branches,
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
};
