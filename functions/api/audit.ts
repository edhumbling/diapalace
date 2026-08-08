import { requireAuth, getAuditSeverity } from "../_lib/auth";

export type AuditLogRecord = {
  id: string;
  business_id: string;
  branch_id: string;
  branch_name?: string;
  user_id: string;
  user_name?: string;
  action: string;
  module: string;
  severity?: "INFO" | "NOTICE" | "WARNING" | "CRITICAL";
  entity_type: string;
  entity_id: string;
  old_values: string | null;
  new_values: string | null;
  reason: string;
  ip_address: string;
  device_id: string;
  session_id: string;
  created_at: string;
};

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner") {
      return Response.json({ error: "Only the business owner can view security audit logs." }, { status: 403 });
    }

    const db = context.env.diapalace_db;
    const url = new URL(context.request.url);

    const moduleFilter = url.searchParams.get("module");
    const actionFilter = url.searchParams.get("action");
    const branchFilter = url.searchParams.get("branchId");
    const userFilter = url.searchParams.get("userId");
    const severityFilter = url.searchParams.get("severity");
    const dateFilter = url.searchParams.get("dateRange");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const search = url.searchParams.get("search")?.trim().toLowerCase();

    let query = `
      SELECT al.id, al.business_id, al.branch_id, b.name as branch_name,
             al.user_id, u.full_name as user_name,
             al.action, al.module, al.entity_type, al.entity_id,
             al.old_values, al.new_values, al.reason,
             al.ip_address, al.device_id, al.session_id, al.created_at
      FROM audit_logs al
      LEFT JOIN branches b ON b.id = al.branch_id
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (moduleFilter && moduleFilter !== "ALL" && moduleFilter !== "all") {
      query += ` AND UPPER(al.module) = UPPER(?)`;
      params.push(moduleFilter);
    }

    if (actionFilter && actionFilter !== "ALL") {
      query += ` AND UPPER(al.action) = UPPER(?)`;
      params.push(actionFilter);
    }

    if (branchFilter && branchFilter !== "ALL" && branchFilter !== "all") {
      query += ` AND al.branch_id = ?`;
      params.push(branchFilter);
    }

    if (userFilter && userFilter !== "ALL" && userFilter !== "all") {
      query += ` AND al.user_id = ?`;
      params.push(userFilter);
    }

    if (dateFilter) {
      const now = new Date();
      if (dateFilter === "Today") {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query += ` AND al.created_at >= ?`;
        params.push(startOfDay);
      } else if (dateFilter === "Yesterday") {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query += ` AND al.created_at >= ? AND al.created_at < ?`;
        params.push(startOfYesterday, endOfYesterday);
      } else if (dateFilter === "Last 7 Days") {
        const start7 = new Date(now.getTime() - 7 * 86400000).toISOString();
        query += ` AND al.created_at >= ?`;
        params.push(start7);
      } else if (dateFilter === "Last 30 Days") {
        const start30 = new Date(now.getTime() - 30 * 86400000).toISOString();
        query += ` AND al.created_at >= ?`;
        params.push(start30);
      }
    }

    if (dateFrom) {
      query += ` AND al.created_at >= ?`;
      params.push(new Date(dateFrom).toISOString());
    }

    if (dateTo) {
      query += ` AND al.created_at <= ?`;
      params.push(new Date(dateTo).toISOString());
    }

    if (search) {
      query += ` AND (
        LOWER(al.id) LIKE ? OR
        LOWER(al.action) LIKE ? OR
        LOWER(al.module) LIKE ? OR
        LOWER(al.reason) LIKE ? OR
        LOWER(al.entity_id) LIKE ? OR
        LOWER(COALESCE(u.full_name, '')) LIKE ? OR
        LOWER(COALESCE(u.username, '')) LIKE ? OR
        LOWER(COALESCE(b.name, '')) LIKE ?
      )`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }

    query += ` ORDER BY al.created_at DESC LIMIT 200`;

    const res = await db.prepare(query).bind(...params).all<AuditLogRecord>();

    let logs = (res.results ?? []).map((row) => ({
      ...row,
      severity: getAuditSeverity(row.action),
    }));

    if (severityFilter && severityFilter !== "ALL" && severityFilter !== "all") {
      logs = logs.filter((l) => l.severity === severityFilter.toUpperCase());
    }

    return Response.json(logs);
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    return Response.json([]);
  }
};
