import { requireAuth, logAudit } from "../../_lib/auth";
import { createNotifications } from "../../_lib/notifications";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const body = await context.request.json() as {
      saleId?: string;
      branchId?: string;
      amount?: number;
      reason?: string;
      method?: string;
      restockInventory?: boolean;
    };

    const reasonText = body.reason?.trim();
    if (!body.saleId || !body.amount || !reasonText || !body.method) {
      return Response.json({ error: "Sale ID, amount, payment method, and a valid reason are mandatory for refund requests." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const requestId = `ref-${crypto.randomUUID()}`;

    const sale = await db.prepare("SELECT id, branch_id, total, status FROM sales WHERE id = ? AND business_id = ?").bind(body.saleId, authOrRes.user.business_id).first<{ id: string; branch_id: string; total: number; status: string }>();
    if (!sale) return Response.json({ error: "Sale transaction not found." }, { status: 404 });
    if (sale.status === "VOID") return Response.json({ error: "Voided transactions cannot be refunded." }, { status: 400 });
    if (sale.status === "REFUNDED") return Response.json({ error: "This transaction has already been refunded." }, { status: 400 });
    if (authOrRes.user.role !== "owner" && !authOrRes.branches.some((branch) => branch.id === sale.branch_id)) return Response.json({ error: "You are not allowed to request refunds for other branches." }, { status: 403 });
    if (body.amount > sale.total) return Response.json({ error: `Refund amount of GH₵ ${body.amount.toFixed(2)} exceeds the sale total of GH₵ ${sale.total.toFixed(2)}.` }, { status: 400 });

    const branchId = sale.branch_id;
    const branchName = authOrRes.branches.find((branch) => branch.id === branchId)?.name || "Branch";
    const paymentMethods = ["Cash", "MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Card / POS", "Bank transfer", "Credit"];
    const method = paymentMethods.includes(body.method?.trim() ?? "") ? body.method!.trim() : "Cash";

    await db
      .prepare(
        `INSERT INTO refund_requests (id, sale_id, business_id, branch_id, requested_by_id, amount, reason, method, restock_inventory, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
      )
      .bind(
        requestId,
        sale.id,
        authOrRes.user.business_id,
        branchId,
        authOrRes.user.id,
        Number(body.amount),
        reasonText,
        method,
        body.restockInventory ? 1 : 0
      )
      .run();

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: branchName,
      module: "PAYMENTS",
      action: "REFUND_REQUESTED",
      entity_type: "REFUND_REQUEST",
      entity_id: requestId,
      new_values: { amount: Number(body.amount), method, saleId: sale.id },
      reason: reasonText,
      description: `Requested refund of GH₵ ${body.amount} for sale ${sale.id}. Reason: ${reasonText}`,
    });

    await createNotifications(db, {
      businessId: authOrRes.user.business_id,
      branchId,
      branchName,
      category: "APPROVALS",
      type: "REFUND_REQUEST",
      severity: Number(body.amount) >= 2000 ? "CRITICAL" : "WARNING",
      title: "Refund requires approval",
      message: `${branchName} has a GH₵ ${Number(body.amount).toFixed(2)} refund request from ${authOrRes.user.full_name}.`,
      entityType: "REFUND_REQUEST",
      entityId: requestId,
      actionUrl: "/sales",
      dedupeKey: `REFUND_REQUEST:${requestId}`,
      roles: ["owner", "manager"],
      metadata: { amount: body.amount, saleId: body.saleId, requestedBy: authOrRes.user.full_name },
    });

    return Response.json({ success: true, requestId });
  } catch (error) {
    console.error("Request refund error:", error);
    return Response.json({ error: "Failed to submit refund request." }, { status: 500 });
  }
};
