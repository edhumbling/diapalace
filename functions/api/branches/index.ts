import { requireAuth, logAudit } from "../../_lib/auth";

export type BranchItem = {
  id: string;
  business_id: string;
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
  status: "active" | "inactive" | "deactivated" | "archived";
  deactivation_reason?: string;
  created_at: string;
  record_count?: number;
};

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const db = context.env.diapalace_db;

    const isOwner = authOrRes.user.role === "owner";
    const branchClause = isOwner ? "" : ` AND b.id IN (${authOrRes.branches.map(() => "?").join(",") || "NULL"})`;
    const branchParams = isOwner ? [] : authOrRes.branches.map((branch) => branch.id);

    const query = `
      SELECT b.id, b.business_id, b.name, b.code, b.location, b.phone, b.email,
             b.region, b.city, b.address, b.digital_address, b.manager_id,
             u.full_name as manager_name, b.status, b.deactivation_reason, b.created_at,
             (SELECT COUNT(*) FROM sales WHERE branch_id = b.id) as sales_count,
             (SELECT COUNT(*) FROM expenses WHERE branch_id = b.id) as expense_count,
             (SELECT COUNT(*) FROM user_branches WHERE branch_id = b.id) as employee_count
      FROM branches b
      LEFT JOIN users u ON u.id = b.manager_id
      WHERE b.business_id = ? ${branchClause}
      ORDER BY b.created_at DESC
    `;

    const res = await db.prepare(query).bind(authOrRes.user.business_id, ...branchParams).all<any>();

    const branches: BranchItem[] = (res.results ?? []).map((row) => ({
      id: row.id,
      business_id: row.business_id,
      name: row.name,
      code: row.code || `BR-${row.id.slice(-4).toUpperCase()}`,
      phone: row.phone || "",
      email: row.email || "",
      region: row.region || "Greater Accra Region",
      city: row.city || row.location || "Accra",
      address: row.address || row.location || "",
      digital_address: row.digital_address || "",
      manager_id: row.manager_id || "",
      manager_name: row.manager_name || "Unassigned",
      status: row.status || "active",
      deactivation_reason: row.deactivation_reason || "",
      created_at: row.created_at,
      record_count: (row.sales_count || 0) + (row.expense_count || 0) + (row.employee_count || 0),
    }));

    return Response.json(branches);
  } catch (error) {
    console.error("Fetch branches error:", error);
    return Response.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner") {
      return Response.json({ error: "Only the business owner can create branches." }, { status: 403 });
    }

    const body = await context.request.json() as {
      name?: string;
      code?: string;
      phone?: string;
      email?: string;
      region?: string;
      city?: string;
      address?: string;
      digitalAddress?: string;
      managerId?: string;
    };

    if (!body.name?.trim()) {
      return Response.json({ error: "Branch name is required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const branchId = `br-${crypto.randomUUID()}`;
    const code = body.code?.trim().toUpperCase() || `BR-${Date.now().toString().slice(-4)}`;

    await db
      .prepare(
        `INSERT INTO branches (
          id, business_id, name, code, phone, email, region, city, address, digital_address, manager_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      )
      .bind(
        branchId,
        authOrRes.user.business_id,
        body.name.trim(),
        code,
        body.phone?.trim() ?? "",
        body.email?.trim() ?? "",
        body.region?.trim() ?? "Greater Accra Region",
        body.city?.trim() ?? "Accra",
        body.address?.trim() ?? "",
        body.digitalAddress?.trim() ?? "",
        body.managerId || ""
      )
      .run();

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: body.name.trim(),
      module: "BRANCH",
      action: "BRANCH_CREATED",
      entity_type: "BRANCH",
      entity_id: branchId,
      new_values: { name: body.name.trim(), code, region: body.region, city: body.city },
      reason: `New store branch '${body.name.trim()}' (${code}) created by Owner`,
      description: `Owner ${authOrRes.user.full_name} created branch '${body.name.trim()}' (${code})`,
    });

    return Response.json({
      id: branchId,
      business_id: authOrRes.user.business_id,
      name: body.name.trim(),
      code,
      phone: body.phone?.trim() ?? "",
      email: body.email?.trim() ?? "",
      region: body.region?.trim() ?? "Greater Accra Region",
      city: body.city?.trim() ?? "Accra",
      address: body.address?.trim() ?? "",
      digital_address: body.digitalAddress?.trim() ?? "",
      manager_id: body.managerId || "",
      status: "active",
    });
  } catch (error) {
    console.error("Create branch error:", error);
    return Response.json({ error: "Failed to create branch" }, { status: 500 });
  }
};
