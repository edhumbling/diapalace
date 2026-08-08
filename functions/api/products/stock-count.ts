import { requireAuth } from "../../_lib/auth";

type CountRow = { productId?: string; physicalQuantity?: number };

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager", "stock_officer"].includes(authOrRes.user.role)) return Response.json({ error: "You are not allowed to commit stock counts." }, { status: 403 });

    const body = await context.request.json() as { rows?: CountRow[]; reason?: string };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length || !body.reason?.trim()) return Response.json({ error: "Stock count rows and a reason are required." }, { status: 400 });
    if (rows.some((row) => !row.productId || !Number.isInteger(row.physicalQuantity) || row.physicalQuantity! < 0)) return Response.json({ error: "Physical quantities must be whole numbers." }, { status: 400 });

    const db = context.env.diapalace_db;
    const statements: D1PreparedStatement[] = [];
    for (const row of rows) {
      const current = await db.prepare("SELECT stock_quantity FROM products WHERE id = ?").bind(row.productId).first<{ stock_quantity: number }>();
      if (!current) continue;
      const difference = row.physicalQuantity! - current.stock_quantity;
      if (difference === 0) continue;
      statements.push(db.prepare("UPDATE products SET stock_quantity = ? WHERE id = ?").bind(row.physicalQuantity, row.productId));
      statements.push(db.prepare("INSERT INTO inventory_movements (id, business_id, product_id, type, quantity, reference_type, reference_id, note) VALUES (?, ?, ?, 'adjustment', ?, 'stock_count', ?, ?)").bind(crypto.randomUUID(), authOrRes.user.business_id, row.productId, difference, `count-${crypto.randomUUID()}`, body.reason.trim()));
    }
    if (statements.length) await db.batch(statements);
    return Response.json({ success: true, adjusted: statements.length / 2 });
  } catch (error) {
    console.error("Stock count error", error);
    return Response.json({ error: "Unable to commit stock count." }, { status: 409 });
  }
};
