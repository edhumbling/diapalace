import { requireAuth, logAudit } from "../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner" && authOrRes.user.role !== "manager") {
      return Response.json({ error: "Only managers or owners can void transactions." }, { status: 403 });
    }

    const body = await context.request.json() as { saleId?: string; reason?: string };
    const reasonText = body.reason?.trim();

    // Architectural Rule 11: Mandatory Reason for Sensitive Actions
    if (!body.saleId || !reasonText) {
      return Response.json({ error: "Transaction voiding requires a valid, non-empty reason." }, { status: 400 });
    }

    const db = context.env.diapalace_db;

    const sale = await db
      .prepare("SELECT id, invoice_number, branch_id, total, status FROM sales WHERE (id = ? OR invoice_number = ?)")
      .bind(body.saleId, body.saleId)
      .first<{ id: string; invoice_number: string; branch_id: string; total: number; status: string }>();

    if (!sale) {
      return Response.json({ error: "Sale transaction not found." }, { status: 404 });
    }

    if (sale.status === "VOID") {
      return Response.json({ error: "Transaction is already voided." }, { status: 400 });
    }

    // Get items to restore stock
    const items = await db
      .prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?")
      .bind(sale.id)
      .all<{ product_id: string; quantity: number }>();

    const statements: D1PreparedStatement[] = [
      db.prepare("UPDATE sales SET status = 'VOID' WHERE id = ?").bind(sale.id),
    ];

    for (const item of items.results ?? []) {
      statements.push(
        db.prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?").bind(item.quantity, item.product_id)
      );
      statements.push(
        db.prepare(
          "INSERT INTO inventory_movements (id, product_id, type, quantity, reference_type, reference_id, note) VALUES (?, ?, 'return', ?, 'sale_void', ?, ?)"
        ).bind(crypto.randomUUID(), item.product_id, item.quantity, sale.id, `Voided sale: ${reasonText}`)
      );
    }

    await db.batch(statements);

    const callerBranch = authOrRes.branches.find((b) => b.id === sale.branch_id) || authOrRes.branches[0];

    // Write structured audit log under SALES module
    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: sale.branch_id || callerBranch?.id || "",
      branch_name: callerBranch?.name || "Branch",
      module: "SALES",
      action: "SALE_VOIDED",
      entity_type: "SALE",
      entity_id: sale.invoice_number,
      old_values: { status: sale.status, total: sale.total },
      new_values: { status: "VOID", total: 0 },
      reason: reasonText,
      description: `Voided sale transaction ${sale.invoice_number} (GH₵ ${sale.total}). Reason: ${reasonText}`,
    });

    return Response.json({ success: true, message: `Sale ${sale.invoice_number} voided successfully.` });
  } catch (error) {
    console.error("Void sale error:", error);
    return Response.json({ error: "Unable to void transaction." }, { status: 500 });
  }
};
