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

    await db
      .prepare(
        `INSERT INTO refund_requests (id, sale_id, business_id, branch_id, requested_by_id, amount, reason, method, restock_inventory, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
      )
      .bind(
        requestId,
        body.saleId,
        authOrRes.user.business_id,
        body.branchId || authOrRes.user.business_id,
        authOrRes.user.id,
        body.amount,
        reasonText,
        body.method,
        body.restockInventory ? 1 : 0
      )
      .run();

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: body.branchId || authOrRes.branches[0]?.id || "",
      branch_name: authOrRes.branches[0]?.name || "Branch",
      module: "PAYMENTS",
      action: "REFUND_REQUESTED",
      entity_type: "REFUND_REQUEST",
      entity_id: requestId,
      new_values: { amount: body.amount, method: body.method, saleId: body.saleId },
      reason: reasonText,
      description: `Requested refund of GH₵ ${body.amount} for sale ${body.saleId}. Reason: ${reasonText}`,
    });

    const branchId = body.branchId || authOrRes.branches[0]?.id || "";
    const branchName = authOrRes.branches.find((branch) => branch.id === branchId)?.name || "Branch";
    await createNotifications(db, {
      businessId: authOrRes.user.business_id,
      branchId,
      branchName,
      category: "APPROVALS",
      type: "REFUND_REQUEST",
      severity: body.amount >= 2000 ? "CRITICAL" : "WARNING",
      title: "Refund requires approval",
      message: `${branchName} has a GH₵ ${body.amount.toFixed(2)} refund request from ${authOrRes.user.full_name}.`,
      entityType: "REFUND_REQUEST",
      entityId: requestId,
      actionUrl: "/understand/sales",
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
