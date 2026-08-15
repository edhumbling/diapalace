import { requireAuth, logAudit } from "../../_lib/auth";

type CountRow = { productId?: string; physicalQuantity?: number };

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager", "stock_officer"].includes(authOrRes.user.role)) return Response.json({ error: "You are not allowed to commit stock counts." }, { status: 403 });

    const body = await context.request.json() as { rows?: CountRow[]; reason?: string; branchId?: string };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const reason = body.reason?.trim() ?? "";
    if (!rows.length || !reason) return Response.json({ error: "Stock count rows and a reason are required." }, { status: 400 });
    if (rows.some((row) => !row.productId || !Number.isInteger(row.physicalQuantity) || row.physicalQuantity! < 0)) return Response.json({ error: "Physical quantities must be whole numbers." }, { status: 400 });

    const requestedBranch = body.branchId?.trim();
    const branchId = requestedBranch && authOrRes.branches.some((branch) => branch.id === requestedBranch)
      ? requestedBranch
      : authOrRes.branches[0]?.id || "";
    if (!branchId) return Response.json({ error: "You are not assigned to any branch. Ask the owner to assign you to a branch." }, { status: 403 });
    if (requestedBranch && !authOrRes.branches.some((branch) => branch.id === requestedBranch)) return Response.json({ error: "You do not have access to this branch." }, { status: 403 });

    const db = context.env.diapalace_db;
    const statements: D1PreparedStatement[] = [];
    let adjusted = 0;
    for (const row of rows) {
      const current = await db.prepare("SELECT stock_quantity FROM products WHERE id = ? AND business_id = ? AND (branch_id = ? OR branch_id IS NULL)").bind(row.productId, authOrRes.user.business_id, branchId).first<{ stock_quantity: number }>();
      if (!current) continue;
      const difference = row.physicalQuantity! - current.stock_quantity;
      if (difference === 0) continue;
      statements.push(db.prepare("UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ? AND business_id = ?").bind(row.physicalQuantity, new Date().toISOString(), row.productId, authOrRes.user.business_id));
      statements.push(db.prepare("INSERT INTO inventory_movements (id, business_id, branch_id, product_id, type, quantity, reference_type, reference_id, note, created_at) VALUES (?, ?, ?, ?, 'adjustment', ?, 'stock_count', ?, ?, ?)").bind(crypto.randomUUID(), authOrRes.user.business_id, branchId, row.productId, difference, `count-${crypto.randomUUID()}`, reason, new Date().toISOString()));
      adjusted += 1;
      await logAudit(db, { business_id: authOrRes.user.business_id, user_id: authOrRes.user.id, user_name: authOrRes.user.full_name, branch_id: branchId, branch_name: authOrRes.branches.find((branch) => branch.id === branchId)?.name || "Branch", module: "INVENTORY", action: "STOCK_COUNT_ADJUSTED", entity_type: "PRODUCT", entity_id: row.productId!, old_values: { stock: current.stock_quantity }, new_values: { stock: row.physicalQuantity }, reason, description: `Stock count adjusted product by ${difference > 0 ? "+" : ""}${difference} (${current.stock_quantity} → ${row.physicalQuantity}).` });
    }
    if (statements.length) await db.batch(statements);
    return Response.json({ success: true, adjusted });
  } catch (error) {
    console.error("Stock count error", error);
    return Response.json({ error: "Unable to commit stock count." }, { status: 409 });
  }
};
