import { requireAuth, logAudit } from "../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager"].includes(authOrRes.user.role)) return Response.json({ error: "You are not allowed to record purchases." }, { status: 403 });

    const body = await context.request.json() as { supplier?: string; amount?: number; status?: "Received" | "Pending"; date?: string; branchId?: string };
    if (!body.supplier?.trim() || !body.amount || body.amount <= 0) return Response.json({ error: "Supplier and a positive amount are required" }, { status: 400 });

    const branchId = body.branchId && authOrRes.branches.some((branch) => branch.id === body.branchId) ? body.branchId : authOrRes.branches[0]?.id || "";
    const purchaseId = `PO-${crypto.randomUUID().slice(0, 8)}`;
    const purchaseDate = body.date && !isNaN(new Date(body.date).getTime()) ? body.date : new Date().toISOString().slice(0, 10);
    const purchase = { id: purchaseId, supplier: body.supplier.trim(), date: purchaseDate, amount: body.amount, status: body.status ?? "Pending" as const };

    await context.env.diapalace_db.prepare("INSERT INTO purchases (id, business_id, branch_id, invoice_number, supplier_name, purchase_date, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(purchaseId, authOrRes.user.business_id, branchId, purchaseId, purchase.supplier, purchase.date, purchase.amount, purchase.status).run();

    await logAudit(context.env.diapalace_db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: authOrRes.branches.find((branch) => branch.id === branchId)?.name || "Branch",
      module: "INVENTORY",
      action: "PURCHASE_ORDER_CREATED",
      entity_type: "PURCHASE",
      entity_id: purchaseId,
      new_values: { supplier: purchase.supplier, amount: purchase.amount, date: purchase.date },
      reason: `Purchase order recorded for ${purchase.supplier}`,
      description: `${authOrRes.user.full_name} recorded a ${purchase.status} purchase of GH₵ ${purchase.amount} from ${purchase.supplier}.`,
    });

    return Response.json(purchase);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to create purchase" }, { status: 500 });
  }
};