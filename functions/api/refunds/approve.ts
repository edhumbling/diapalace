import { requireAuth, logAudit } from "../../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner" && authOrRes.user.role !== "manager") {
      return Response.json({ error: "Only managers or owners can approve refunds." }, { status: 403 });
    }

    const body = await context.request.json() as { requestId?: string; approved?: boolean };
    if (!body.requestId) {
      return Response.json({ error: "Request ID is required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;

    const requestRow = await db
      .prepare("SELECT * FROM refund_requests WHERE id = ? AND business_id = ?")
      .bind(body.requestId, authOrRes.user.business_id)
      .first<{ id: string; sale_id: string; branch_id: string; amount: number; reason: string; restock_inventory: number; status: string }>();

    if (!requestRow || requestRow.status !== "PENDING") {
      return Response.json({ error: "Pending refund request not found." }, { status: 404 });
    }

    const newStatus = body.approved ? "APPROVED" : "REJECTED";
    const actionName = body.approved ? "REFUND_APPROVED" : "REFUND_REJECTED";
    const now = new Date().toISOString();

    const statements: D1PreparedStatement[] = [
      db.prepare(
        "UPDATE refund_requests SET status = ?, approved_by_id = ?, approved_at = ? WHERE id = ?"
      ).bind(newStatus, authOrRes.user.id, now, body.requestId),
    ];

    if (body.approved) {
      statements.push(
        db.prepare("UPDATE sales SET status = 'REFUNDED' WHERE id = ?").bind(requestRow.sale_id)
      );

      if (requestRow.restock_inventory === 1) {
        const items = await db
          .prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?")
          .bind(requestRow.sale_id)
          .all<{ product_id: string; quantity: number }>();

        for (const item of items.results ?? []) {
          statements.push(
            db.prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?").bind(item.quantity, item.product_id)
          );
          statements.push(
            db.prepare(
              "INSERT INTO inventory_movements (id, product_id, type, quantity, reference_type, reference_id, note) VALUES (?, ?, 'return', ?, 'refund', ?, ?)"
            ).bind(crypto.randomUUID(), item.product_id, item.quantity, requestRow.sale_id, `Approved refund: ${requestRow.reason}`)
          );
        }
      }
    }

    await db.batch(statements);

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: requestRow.branch_id || authOrRes.branches[0]?.id || "",
      branch_name: authOrRes.branches[0]?.name || "Branch",
      module: "PAYMENTS",
      action: actionName,
      entity_type: "REFUND",
      entity_id: requestRow.sale_id,
      old_values: { status: requestRow.status },
      new_values: { status: newStatus, amount: requestRow.amount },
      reason: requestRow.reason,
      description: `${body.approved ? "Approved" : "Rejected"} refund request for sale ${requestRow.sale_id} (GH₵ ${requestRow.amount})`,
    });

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("Approve refund error:", error);
    return Response.json({ error: "Failed to process refund decision." }, { status: 500 });
  }
};
