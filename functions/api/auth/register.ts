import { hashPassword, generateToken, logAudit } from "../../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const body = await context.request.json() as {
      businessName?: string;
      phone?: string;
      ownerName?: string;
      username?: string;
      password?: string;
    };

    if (!body.businessName?.trim() || !body.ownerName?.trim() || !body.username?.trim() || !body.password) {
      return Response.json(
        { error: "Business name, owner name, username, and password are required." },
        { status: 400 }
      );
    }

    const db = context.env.diapalace_db;
    const cleanUsername = body.username.trim().toLowerCase();

    // Check if username already exists
    const existing = await db
      .prepare("SELECT id FROM users WHERE LOWER(username) = ?")
      .bind(cleanUsername)
      .first();

    if (existing) {
      return Response.json(
        { error: "Username is already taken. Please choose another." },
        { status: 409 }
      );
    }

    const businessId = `biz-${crypto.randomUUID()}`;
    const branchId = `br-${crypto.randomUUID()}`;
    const userId = `u-${crypto.randomUUID()}`;
    const passwordHash = await hashPassword(body.password);
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const statements: D1PreparedStatement[] = [
      db.prepare("INSERT INTO businesses (id, name, phone) VALUES (?, ?, ?)").bind(
        businessId,
        body.businessName.trim(),
        body.phone?.trim() ?? ""
      ),
      db.prepare("INSERT INTO branches (id, business_id, name, location, phone, status) VALUES (?, ?, ?, ?, ?, 'active')").bind(
        branchId,
        businessId,
        "Main Branch",
        "Headquarters",
        body.phone?.trim() ?? ""
      ),
      db.prepare(
        `INSERT INTO users (id, business_id, full_name, username, phone, password_hash, role, status, force_password_change)
         VALUES (?, ?, ?, ?, ?, ?, 'owner', 'active', 0)`
      ).bind(
        userId,
        businessId,
        body.ownerName.trim(),
        cleanUsername,
        body.phone?.trim() ?? "",
        passwordHash
      ),
      db.prepare("INSERT INTO user_branches (id, user_id, branch_id) VALUES (?, ?, ?)").bind(
        `ub-${crypto.randomUUID()}`,
        userId,
        branchId
      ),
      db.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)").bind(
        `s-${crypto.randomUUID()}`,
        userId,
        token,
        expiresAt
      ),
    ];

    await db.batch(statements);

    await logAudit(db, {
      business_id: businessId,
      user_id: userId,
      user_name: body.ownerName.trim(),
      branch_id: branchId,
      branch_name: "Main Branch",
      action: "Business Registration",
      description: `Registered new business '${body.businessName.trim()}' and owner '${body.ownerName.trim()}'`,
    });

    const user = {
      id: userId,
      business_id: businessId,
      full_name: body.ownerName.trim(),
      username: cleanUsername,
      phone: body.phone?.trim() ?? "",
      role: "owner" as const,
      status: "active" as const,
      force_password_change: false,
    };

    const business = {
      id: businessId,
      name: body.businessName.trim(),
      phone: body.phone?.trim() ?? "",
      email: "",
    };

    const branches = [
      {
        id: branchId,
        business_id: businessId,
        name: "Main Branch",
        location: "Headquarters",
        phone: body.phone?.trim() ?? "",
        status: "active" as const,
      },
    ];

    return Response.json({
      token,
      user,
      business,
      branches,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
};
