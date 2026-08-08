import { requireAuth } from "../../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager", "stock_officer"].includes(authOrRes.user.role)) return Response.json({ error: "You are not allowed to create products." }, { status: 403 });
    const body = await context.request.json() as { name?: string; description?: string; sku?: string; category?: string; price?: number; cost?: number; stock?: number; reorderAt?: number; unit?: string };
    if (!body.name?.trim() || typeof body.price !== "number" || body.price < 0) return Response.json({ error: "Product name and a valid selling price are required" }, { status: 400 });
    const product = { id: `p-${crypto.randomUUID()}`, ...body };
    const category = body.category?.trim() || "Uncategorised";
    const categoryId = `cat-${category.toLowerCase().replaceAll(" ", "-")}`;
    const sku = body.sku?.trim() || `DP-${Date.now().toString().slice(-6)}`;
    await context.env.diapalace_db.batch([
      context.env.diapalace_db.prepare("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)").bind(categoryId, category),
      context.env.diapalace_db.prepare("INSERT INTO products (id, business_id, branch_id, name, description, sku, category_id, cost_price, selling_price, stock_quantity, reorder_level, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(product.id, authOrRes.user.business_id, authOrRes.branches[0]?.id || "", body.name.trim(), body.description?.trim() ?? "", sku, categoryId, body.cost ?? 0, body.price, body.stock ?? 0, body.reorderAt ?? 0, body.unit ?? "piece"),
      context.env.diapalace_db.prepare("INSERT INTO inventory_movements (id, business_id, branch_id, product_id, type, quantity, reference_type, note) VALUES (?, ?, ?, ?, 'opening', ?, 'product', 'Opening quantity')").bind(crypto.randomUUID(), authOrRes.user.business_id, authOrRes.branches[0]?.id || "", product.id, body.stock ?? 0),
    ]);
    return Response.json({ id: product.id, name: body.name.trim(), description: body.description?.trim() ?? "", sku, category, price: body.price, cost: body.cost ?? 0, stock: body.stock ?? 0, reorderAt: body.reorderAt ?? 0, unit: body.unit ?? "piece" });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to create product" }, { status: 500 });
  }
};
