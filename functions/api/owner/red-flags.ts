import { requireAuth } from "../../_lib/auth";

type RedFlag = {
  id: string;
  type: "CASH_SHORTAGE" | "INVENTORY_VARIANCE" | "HIGH_REFUNDS" | "HIGH_DISCOUNT" | "MOMO_PENDING";
  severity: "high" | "medium" | "low";
  branch_name: string;
  title: string;
  description: string;
  created_at: string;
};

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner") {
      return Response.json({ error: "Only the business owner can access the Red Flags dashboard." }, { status: 403 });
    }

    const db = context.env.diapalace_db;
    const flags: RedFlag[] = [];

    // 1. Check Cash Shortages from shift_reconciliations
    const shortages = await db
      .prepare(
        `SELECT sr.id, sr.cash_variance, sr.created_at, b.name as branch_name, u.full_name as cashier_name
         FROM shift_reconciliations sr
         LEFT JOIN branches b ON b.id = sr.branch_id
         LEFT JOIN users u ON u.id = sr.cashier_id
         WHERE sr.business_id = ? AND sr.cash_variance < 0
         ORDER BY sr.created_at DESC LIMIT 10`
      )
      .bind(authOrRes.user.business_id)
      .all<{ id: string; cash_variance: number; created_at: string; branch_name: string; cashier_name: string }>();

    for (const row of shortages.results ?? []) {
      flags.push({
        id: `flag-short-${row.id}`,
        type: "CASH_SHORTAGE",
        severity: Math.abs(row.cash_variance) > 100 ? "high" : "medium",
        branch_name: row.branch_name || "Main Branch",
        title: `Cash Shortage: -GH₵ ${Math.abs(row.cash_variance)}`,
        description: `Shift closed by ${row.cashier_name || "Cashier"} with a cash shortage.`,
        created_at: row.created_at,
      });
    }

    // 2. Check Pending Refund Requests
    const pendingRefunds = await db
      .prepare(
        `SELECT r.id, r.amount, r.reason, r.created_at, b.name as branch_name, u.full_name as requester_name
         FROM refund_requests r
         LEFT JOIN branches b ON b.id = r.branch_id
         LEFT JOIN users u ON u.id = r.requested_by_id
         WHERE r.business_id = ? AND r.status = 'PENDING'
         ORDER BY r.created_at DESC`
      )
      .bind(authOrRes.user.business_id)
      .all<{ id: string; amount: number; reason: string; created_at: string; branch_name: string; requester_name: string }>();

    for (const row of pendingRefunds.results ?? []) {
      flags.push({
        id: `flag-ref-${row.id}`,
        type: "HIGH_REFUNDS",
        severity: "medium",
        branch_name: row.branch_name || "Main Branch",
        title: `Pending Refund Approval: GH₵ ${row.amount}`,
        description: `Requested by ${row.requester_name}. Reason: ${row.reason}`,
        created_at: row.created_at,
      });
    }

    // Sort all red flags by created_at DESC
    flags.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return Response.json(flags);
  } catch (error) {
    console.error("Fetch red flags error:", error);
    return Response.json({ error: "Failed to fetch operational red flags." }, { status: 500 });
  }
};
