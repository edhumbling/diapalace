import { requireAuth } from "../../_lib/auth";

type BulkProduct = { name?: string; description?: string; price?: number; quantity?: number; category?: string; reorderAt?: number };

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager", "stock_officer"].includes(authOrRes.user.role)) return Response.json({ error: "You are not allowed to import inventory." }, { status: 403 });

    const body = await context.request.json() as { items?: BulkProduct[] };
    const items = Array.isArray(body.items) ? body.items.slice(0, 250) : [];
    if (!items.length) return Response.json({ error: "Add at least one product row." }, { status: 400 });
    if (items.some((item) => !item.name?.trim() || typeof item.price !== "number" || item.price < 0 || typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 0)) {
      return Response.json({ error: "Every row needs a product name, valid price, and whole-number quantity." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const products: Array<{ id: string; name: string; description: string; sku: string; category: string; price: number; cost: number; stock: number; reorderAt: number; unit: string }> = [];
    for (const item of items) {
      const id = `p-${crypto.randomUUID()}`;
      const category = item.category?.trim() || "Uncategorised";
      const sku = `DP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const product = { id, name: item.name!.trim(), description: item.description?.trim() ?? "", sku, category, price: item.price!, cost: 0, stock: item.quantity!, reorderAt: item.reorderAt ?? 0, unit: "piece" };
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)").bind(`cat-${category.toLowerCase().replaceAll(" ", "-")}`, category),
        db.prepare("INSERT INTO products (id, business_id, branch_id, name, description, sku, category_id, cost_price, selling_price, stock_quantity, reorder_level, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'piece', ?, ?)").bind(id, authOrRes.user.business_id, authOrRes.branches[0]?.id || "", product.name, product.description, sku, `cat-${category.toLowerCase().replaceAll(" ", "-")}`, product.price, product.stock, product.reorderAt, new Date().toISOString(), new Date().toISOString()),
        db.prepare("INSERT INTO inventory_movements (id, business_id, product_id, type, quantity, reference_type, reference_id, note) VALUES (?, ?, ?, 'opening', ?, 'opening_inventory', ?, 'Verified notebook opening stock')").bind(crypto.randomUUID(), authOrRes.user.business_id, id, product.stock, id),
      ]);
      products.push(product);
    }

    return Response.json({ success: true, products, count: products.length });
  } catch (error) {
    console.error("Bulk inventory import error", error);
    return Response.json({ error: "Unable to import inventory." }, { status: 409 });
  }
};
