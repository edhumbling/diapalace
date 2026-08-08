import { hashPassword, requireAuth, logAudit, type AuthenticatedUser } from "../../_lib/auth";

type EmployeeRow = {
  id: string;
  business_id: string;
  full_name: string;
  username: string;
  phone: string;
  role: AuthenticatedUser["role"];
  status: AuthenticatedUser["status"];
  force_password_change: number;
  created_at: string;
  last_login: string | null;
  branch_ids: string | null;
};

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const role = authOrRes.user.role;
    if (role !== "owner" && role !== "manager") {
      return Response.json({ error: "Access denied." }, { status: 403 });
    }

    const db = context.env.diapalace_db;

    const query = `
      SELECT u.id, u.business_id, u.full_name, u.username, u.phone, u.role, u.status, u.force_password_change, u.created_at, u.last_login,
             GROUP_CONCAT(ub.branch_id) as branch_ids
      FROM users u
      LEFT JOIN user_branches ub ON ub.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;

    const employeesRes = await db.prepare(query).all<EmployeeRow>();

    const dbEmployees = (employeesRes.results ?? []).map((emp) => ({
      id: emp.id,
      full_name: emp.full_name,
      username: emp.username,
      phone: emp.phone,
      role: emp.role,
      status: emp.status,
      force_password_change: emp.force_password_change === 1,
      created_at: emp.created_at,
      last_login: emp.last_login,
      branchIds: emp.branch_ids ? emp.branch_ids.split(",") : [],
    }));

    return Response.json(dbEmployees);
  } catch (error) {
    console.error("Fetch employees error:", error);
    return Response.json([]);
  }
};

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const callerRole = authOrRes.user.role;
    if (callerRole !== "owner" && callerRole !== "manager") {
      return Response.json({ error: "Only owners or branch managers can add staff accounts." }, { status: 403 });
    }

    const body = await context.request.json() as {
      fullName?: string;
      username?: string;
      phone?: string;
      password?: string;
      role?: AuthenticatedUser["role"];
      branchIds?: string[];
      status?: AuthenticatedUser["status"];
    };

    if (!body.fullName?.trim() || !body.username?.trim() || !body.password || !body.role) {
      return Response.json({ error: "Full name, username, password, and role are required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const cleanUsername = body.username.trim().toLowerCase();

    const existing = await db
      .prepare("SELECT id FROM users WHERE LOWER(username) = ?")
      .bind(cleanUsername)
      .first();

    if (existing) {
      return Response.json({ error: "Username is already taken." }, { status: 409 });
    }

    const userId = `u-${crypto.randomUUID()}`;
    const passwordHash = await hashPassword(body.password);
    const status = body.status ?? "active";

    const statements: D1PreparedStatement[] = [
      db.prepare(
        `INSERT INTO users (id, business_id, full_name, username, phone, password_hash, role, status, force_password_change)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).bind(
        userId,
        authOrRes.user.business_id,
        body.fullName.trim(),
        cleanUsername,
        body.phone?.trim() ?? "",
        passwordHash,
        body.role,
        status
      ),
    ];

    const branchIds = body.branchIds ?? (callerRole === "manager" ? authOrRes.branches.map((b) => b.id) : []);
    for (const bId of branchIds) {
      statements.push(
        db.prepare("INSERT INTO user_branches (id, user_id, branch_id) VALUES (?, ?, ?)").bind(
          `ub-${crypto.randomUUID()}`,
          userId,
          bId
        )
      );
    }

    await db.batch(statements);

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchIds[0] || "",
      branch_name: authOrRes.branches[0]?.name || "Branch",
      module: "EMPLOYEES",
      action: "EMPLOYEE_CREATED",
      entity_type: "EMPLOYEE",
      entity_id: userId,
      new_values: { username: cleanUsername, full_name: body.fullName.trim(), role: body.role, branchIds, status },
      reason: `Staff account '@${cleanUsername}' created by ${callerRole}`,
      description: `${callerRole === "owner" ? "Owner" : "Manager"} ${authOrRes.user.full_name} created ${body.role} account '@${cleanUsername}' (${body.fullName.trim()})`,
    });

    return Response.json({
      id: userId,
      full_name: body.fullName.trim(),
      username: cleanUsername,
      phone: body.phone?.trim() ?? "",
      role: body.role,
      status,
      force_password_change: false,
      branchIds,
    });
  } catch (error) {
    console.error("Create employee error:", error);
    return Response.json({ error: "Failed to create employee" }, { status: 500 });
  }
};
