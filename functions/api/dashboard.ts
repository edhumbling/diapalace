import { requireAuth } from "../_lib/auth";

type BranchScope = { branchId?: string | null; allowed: string[]; owner: boolean };

function dateWindow(period: string | null) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  if (period === "YESTERDAY") {
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 1);
    end.setTime(start.getTime() + 86400000);
  } else if (period === "WEEK") {
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
  } else if (period === "MONTH") {
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(1);
  } else {
    start.setUTCHours(0, 0, 0, 0);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function scoped(alias: string, scope: BranchScope) {
  if (scope.branchId) return { sql: `${alias}.branch_id = ?`, params: [scope.branchId] as string[] };
  if (scope.owner) return { sql: "1 = 1", params: [] as string[] };
  return { sql: `${alias}.branch_id IN (${scope.allowed.map(() => "?").join(",") || "NULL"})`, params: scope.allowed };
}

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    const db = context.env.diapalace_db;
    const url = new URL(context.request.url);
    const requestedBranch = url.searchParams.get("branchId");
    const allowed = authOrRes.branches.map((branch) => branch.id);
    if (requestedBranch && requestedBranch !== "all" && !allowed.includes(requestedBranch) && authOrRes.user.role !== "owner") return Response.json({ error: "You do not have access to this branch." }, { status: 403 });

    const scope: BranchScope = { branchId: requestedBranch && requestedBranch !== "all" ? requestedBranch : null, allowed, owner: authOrRes.user.role === "owner" };
    const period = url.searchParams.get("period") || "TODAY";
    const window = dateWindow(period);
    const salesScope = scoped("s", scope);
    const movementScope = scoped("im", scope);
    const shiftScope = scoped("sr", scope);
    const refundScope = scoped("rr", scope);
    const activityScope = scoped("al", scope);
    const productScope = scoped("p", scope);
    const cashierCondition = authOrRes.user.role === "cashier" ? "AND s.cashier_id = ?" : "";
    const cashierParams = authOrRes.user.role === "cashier" ? [authOrRes.user.id] : [];

    const salesRow = await db.prepare(`SELECT COALESCE(SUM(s.total), 0) AS sales, COUNT(*) AS transactions FROM sales s WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND ${salesScope.sql} ${cashierCondition}`).bind(authOrRes.user.business_id, window.start, window.end, ...salesScope.params, ...cashierParams).first<{ sales: number; transactions: number }>();
    const cashRow = await db.prepare(`SELECT COALESCE(SUM(pay.amount), 0) AS cash FROM payments pay JOIN sales s ON s.id = pay.sale_id WHERE s.business_id = ? AND pay.method = 'Cash' AND s.created_at >= ? AND s.created_at < ? AND ${salesScope.sql} ${cashierCondition}`).bind(authOrRes.user.business_id, window.start, window.end, ...salesScope.params, ...cashierParams).first<{ cash: number }>();
    const shiftRow = await db.prepare(`SELECT COALESCE(SUM(sr.expected_cash), 0) AS expected, COALESCE(SUM(sr.counted_cash), 0) AS counted, COALESCE(SUM(sr.cash_variance), 0) AS variance FROM shift_reconciliations sr WHERE sr.business_id = ? AND sr.created_at >= ? AND sr.created_at < ? AND ${shiftScope.sql}`).bind(authOrRes.user.business_id, window.start, window.end, ...shiftScope.params).first<{ expected: number; counted: number; variance: number }>();
    const inventoryRow = await db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN p.stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock, SUM(CASE WHEN p.reorder_level > 0 AND p.stock_quantity <= p.reorder_level THEN 1 ELSE 0 END) AS low_stock FROM products p WHERE (p.business_id = ? OR p.business_id IS NULL) AND ${productScope.sql}`).bind(authOrRes.user.business_id, ...productScope.params).first<{ total: number; out_of_stock: number; low_stock: number }>();
    const adjustmentRow = await db.prepare(`SELECT COUNT(*) AS count FROM inventory_movements im WHERE im.business_id = ? AND im.type = 'adjustment' AND im.created_at >= ? AND im.created_at < ? AND ${movementScope.sql}`).bind(authOrRes.user.business_id, window.start, window.end, ...movementScope.params).first<{ count: number }>();
    const lowStockRows = await db.prepare(`SELECT p.id, p.name, COALESCE(p.description, '') AS description, p.stock_quantity AS stock, p.reorder_level AS reorder_at, b.name AS branch_name FROM products p LEFT JOIN branches b ON b.id = p.branch_id WHERE (p.business_id = ? OR p.business_id IS NULL) AND p.reorder_level > 0 AND p.stock_quantity <= p.reorder_level AND ${productScope.sql} ORDER BY p.stock_quantity ASC LIMIT 8`).bind(authOrRes.user.business_id, ...productScope.params).all<{ id: string; name: string; description: string; stock: number; reorder_at: number; branch_name: string | null }>();
    const refundRows = await db.prepare(`SELECT rr.id, rr.amount, rr.created_at, b.name AS branch_name FROM refund_requests rr LEFT JOIN branches b ON b.id = rr.branch_id WHERE rr.business_id = ? AND rr.status = 'PENDING' AND ${refundScope.sql} ORDER BY rr.created_at DESC LIMIT 5`).bind(authOrRes.user.business_id, ...refundScope.params).all<{ id: string; amount: number; created_at: string; branch_name: string | null }>();
    const varianceRows = await db.prepare(`SELECT sr.id, sr.cash_variance AS variance, sr.created_at, b.name AS branch_name FROM shift_reconciliations sr LEFT JOIN branches b ON b.id = sr.branch_id WHERE sr.business_id = ? AND sr.cash_variance != 0 AND sr.created_at >= ? AND sr.created_at < ? AND ${shiftScope.sql} ORDER BY ABS(sr.cash_variance) DESC LIMIT 5`).bind(authOrRes.user.business_id, window.start, window.end, ...shiftScope.params).all<{ id: string; variance: number; created_at: string; branch_name: string | null }>();
    const topRows = await db.prepare(`SELECT p.name, COALESCE(p.description, '') AS description, SUM(si.quantity) AS quantity FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND ${salesScope.sql} ${cashierCondition} GROUP BY p.id ORDER BY quantity DESC LIMIT 5`).bind(authOrRes.user.business_id, window.start, window.end, ...salesScope.params, ...cashierParams).all<{ name: string; description: string; quantity: number }>();
    const trendRows = await db.prepare(`SELECT substr(s.created_at, 1, 10) AS day, COALESCE(SUM(s.total), 0) AS sales FROM sales s WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND ${salesScope.sql} ${cashierCondition} GROUP BY day ORDER BY day`).bind(authOrRes.user.business_id, window.start, window.end, ...salesScope.params, ...cashierParams).all<{ day: string; sales: number }>();
    const activityRows = await db.prepare(`SELECT al.id, al.action, al.description, al.created_at, b.name AS branch_name FROM audit_logs al LEFT JOIN branches b ON b.id = al.branch_id WHERE al.business_id = ? AND al.created_at >= ? AND al.created_at < ? AND ${activityScope.sql} ORDER BY al.created_at DESC LIMIT 8`).bind(authOrRes.user.business_id, window.start, window.end, ...activityScope.params).all<{ id: string; action: string; description: string; created_at: string; branch_name: string | null }>();

    const attention = [
      ...(lowStockRows.results ?? []).map((item) => ({ type: "LOW_STOCK", severity: "WARNING", title: "Low stock", message: `${item.name}${item.description ? ` ${item.description}` : ""} has ${item.stock} remaining.`, branchName: item.branch_name, action: "/manage/inventory" })),
      ...(varianceRows.results ?? []).map((item) => ({ type: "CASH_VARIANCE", severity: Math.abs(item.variance) >= 500 ? "CRITICAL" : "WARNING", title: "Cash variance", message: `${item.branch_name || "Branch"} has a ${item.variance < 0 ? "shortage" : "overage"} of GH₵ ${Math.abs(item.variance).toFixed(2)}.`, branchName: item.branch_name, action: "/understand/reconciliation" })),
      ...(refundRows.results ?? []).map((item) => ({ type: "REFUND", severity: "WARNING", title: "Refund requires approval", message: `GH₵ ${item.amount.toFixed(2)} refund awaiting review.`, branchName: item.branch_name, action: "/understand/sales" })),
    ];

    let branches = [] as Array<{ id: string; name: string; sales: number; transactions: number; cashUp: string }>;
    if (authOrRes.user.role === "owner" && !scope.branchId) {
      branches = await Promise.all(authOrRes.branches.map(async (branch) => {
        const row = await db.prepare("SELECT COALESCE(SUM(total), 0) AS sales, COUNT(*) AS transactions FROM sales WHERE business_id = ? AND branch_id = ? AND created_at >= ? AND created_at < ?").bind(authOrRes.user.business_id, branch.id, window.start, window.end).first<{ sales: number; transactions: number }>();
        const shift = await db.prepare("SELECT COUNT(*) AS count FROM shift_reconciliations WHERE business_id = ? AND branch_id = ? AND created_at >= ? AND created_at < ?").bind(authOrRes.user.business_id, branch.id, window.start, window.end).first<{ count: number }>();
        return { id: branch.id, name: branch.name, sales: row?.sales ?? 0, transactions: row?.transactions ?? 0, cashUp: (shift?.count ?? 0) > 0 ? "Complete" : "Pending" };
      }));
    }

    return Response.json({ period, branchId: scope.branchId || "all", kpis: { sales: salesRow?.sales ?? 0, transactions: salesRow?.transactions ?? 0, cash: cashRow?.cash ?? 0, expectedCash: shiftRow?.expected ?? 0, cashVariance: shiftRow?.variance ?? 0, stockAlerts: inventoryRow?.low_stock ?? 0 }, inventory: { total: inventoryRow?.total ?? 0, lowStock: inventoryRow?.low_stock ?? 0, outOfStock: inventoryRow?.out_of_stock ?? 0, adjustments: adjustmentRow?.count ?? 0 }, attention, branches, topProducts: topRows.results ?? [], salesTrend: trendRows.results ?? [], recentActivity: activityRows.results ?? [], visibility: { role: authOrRes.user.role, showFinancials: authOrRes.user.role !== "stock_officer" } });
  } catch (error) {
    console.error("Dashboard summary error", error);
    return Response.json({
      period: new URL(context.request.url).searchParams.get("period") || "TODAY",
      branchId: new URL(context.request.url).searchParams.get("branchId") || "all",
      kpis: { sales: 0, transactions: 0, cash: 0, expectedCash: 0, cashVariance: 0, stockAlerts: 0 },
      inventory: { total: 0, lowStock: 0, outOfStock: 0, adjustments: 0 },
      attention: [],
      branches: [],
      topProducts: [],
      salesTrend: [],
      recentActivity: [],
      visibility: { role: "owner", showFinancials: true },
      errors: { dashboard: "Unable to refresh dashboard sections." },
    }, { status: 200 });
  }
};
