import { requireAuth } from "../../_lib/auth";

export const onRequestPatch: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager", "stock_officer"].includes(authOrRes.user.role)) {
      return Response.json({ error: "You are not allowed to change inventory." }, { status: 403 });
    }

    const productId = context.params.id as string;
    const body = await context.request.json() as {
      amount?: number;
      note?: string;
      name?: string;
      description?: string;
      category?: string;
      price?: number;
      cost?: number;
      reorderAt?: number;
      unit?: string;
    };
    const db = context.env.diapalace_db;

    if (typeof body.amount === "number" && body.amount !== 0) {
      if (!body.note?.trim()) return Response.json({ error: "A reason is required for stock adjustments." }, { status: 400 });
      await db.batch([
        db.prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?").bind(body.amount, productId),
        db.prepare("INSERT INTO inventory_movements (id, product_id, type, quantity, reference_type, note) VALUES (?, ?, 'adjustment', ?, 'manual', ?)").bind(crypto.randomUUID(), productId, body.amount, body.note.trim()),
      ]);
      return Response.json({ saved: true, type: "adjustment" });
    }

    if (typeof body.price !== "number" || body.price < 0 || !body.name?.trim()) {
      return Response.json({ error: "Product name and a valid selling price are required." }, { status: 400 });
    }

    const existing = await db.prepare("SELECT name, description, selling_price, category_id, cost_price, reorder_level, unit FROM products WHERE id = ?").bind(productId).first<{
      name: string;
      description: string | null;
      selling_price: number;
      category_id: string;
      cost_price: number;
      reorder_level: number;
      unit: string;
    }>();
    if (!existing) return Response.json({ error: "Product not found." }, { status: 404 });

    const category = body.category?.trim() || "Uncategorised";
    const categoryId = `cat-${category.toLowerCase().replaceAll(" ", "-")}`;
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)").bind(categoryId, category),
      db.prepare("UPDATE products SET name = ?, description = ?, category_id = ?, cost_price = ?, selling_price = ?, reorder_level = ?, unit = ? WHERE id = ?").bind(body.name.trim(), body.description?.trim() ?? "", categoryId, body.cost ?? existing.cost_price, body.price, body.reorderAt ?? existing.reorder_level, body.unit?.trim() || existing.unit, productId),
    ]);

    if (existing.selling_price !== body.price) {
      await db.prepare("INSERT INTO price_change_logs (id, business_id, branch_id, product_id, old_price, new_price, requested_by_id, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), authOrRes.user.business_id, authOrRes.branches[0]?.id || "", productId, existing.selling_price, body.price, authOrRes.user.id, "Product price updated from inventory notebook")
        .run();
    }

    return Response.json({
      saved: true,
      type: "details",
      product: {
        id: productId,
        name: body.name.trim(),
        description: body.description?.trim() ?? "",
        category,
        price: body.price,
        cost: body.cost ?? existing.cost_price,
        reorderAt: body.reorderAt ?? existing.reorder_level,
        unit: body.unit?.trim() || existing.unit,
      },
    });
  } catch (error) {
    console.error("Product update error", error);
    return Response.json({ error: "Unable to update product." }, { status: 409 });
  }
};
