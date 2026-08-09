import { requireAuth } from "../../_lib/auth";

type ProductListRow = {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  reorder_level: number;
  unit: string;
  branch_id: string;
  branch_name: string;
  updated_at: string | null;
  created_at: string;
};

function parseSort(value: string | null): { column: string; direction: "ASC" | "DESC" } {
  const safeColumns = new Set(["name", "selling_price", "stock_quantity", "updated_at", "created_at"]);
  const direction = value?.toLowerCase().startsWith("-") ? "DESC" : "ASC";
  const raw = value ? value.replace(/^-/, "") : "name";
  return { column: safeColumns.has(raw) ? raw : "name", direction };
}

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const db = context.env.diapalace_db;
    const url = new URL(context.request.url);

    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = [25, 50, 100].includes(Number(url.searchParams.get("pageSize"))) ? Number(url.searchParams.get("pageSize")) : 25;
    const search = (url.searchParams.get("search") ?? "").trim();
    const category = (url.searchParams.get("category") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();
    const sort = parseSort(url.searchParams.get("sort"));

    // Branch filter must respect the user's branch permissions.
    const allowedIds = new Set(authOrRes.branches.map((branch) => branch.id));
    const requestedBranch = (url.searchParams.get("branchId") ?? "").trim();
    const branchIds: string[] = [];
    if (requestedBranch && requestedBranch !== "all") {
      if (!allowedIds.has(requestedBranch)) {
        return Response.json({ error: "You do not have access to this branch." }, { status: 403 });
      }
      branchIds.push(requestedBranch);
    } else {
      branchIds.push(...allowedIds);
    }

    const conditions: string[] = ["p.business_id = ?"];
    const bindings: (string | number)[] = [authOrRes.user.business_id];

    if (search) {
      conditions.push("(LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(COALESCE(p.description, '')) LIKE ?)");
      const term = `%${search.toLowerCase()}%`;
      bindings.push(term, term, term);
    }
    if (category && category !== "All categories") {
      conditions.push("c.name = ?");
      bindings.push(category);
    }
    if (status && status !== "all") {
      if (status === "in_stock") conditions.push("p.stock_quantity > p.reorder_level");
      else if (status === "low_stock") conditions.push("p.reorder_level > 0 AND p.stock_quantity <= p.reorder_level AND p.stock_quantity > 0");
      else if (status === "out_of_stock") conditions.push("p.stock_quantity = 0");
    }
    conditions.push(`p.branch_id IN (${branchIds.map(() => "?").join(", ")})`);
    branchIds.forEach((id) => bindings.push(id));

    const whereSql = conditions.join(" AND ");
    const totalRow = await db.prepare(`SELECT COUNT(*) AS count FROM products p JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`).bind(...bindings).first<{ count: number }>();
    const total = Number(totalRow?.count || 0);

    const offset = (page - 1) * pageSize;
    const items = await db.prepare(
      `SELECT p.id, p.name, COALESCE(p.description, '') AS description, p.sku, c.name AS category,
              p.cost_price, p.selling_price, p.stock_quantity, p.reorder_level, p.unit,
              p.branch_id, COALESCE(b.name, '') AS branch_name, p.updated_at, p.created_at
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN branches b ON b.id = p.branch_id
       WHERE ${whereSql}
       ORDER BY ${sort.column} COLLATE NOCASE ${sort.direction}, p.name COLLATE NOCASE ASC
       LIMIT ? OFFSET ?`
    ).bind(...bindings, pageSize, offset).all<ProductListRow>();

    const categoryRows = await db.prepare("SELECT DISTINCT c.name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.business_id = ? ORDER BY c.name").bind(authOrRes.user.business_id).all<{ name: string }>();

    const rows = items.results ?? [];
    const totalValue = rows.reduce((sum, row) => sum + row.selling_price * row.stock_quantity, 0);
    const lowStockCount = rows.filter((row) => row.reorder_level > 0 && row.stock_quantity <= row.reorder_level).length;

    return Response.json({
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        sku: row.sku,
        category: row.category,
        cost: row.cost_price,
        price: row.selling_price,
        stock: row.stock_quantity,
        reorderAt: row.reorder_level,
        unit: row.unit,
        branchId: row.branch_id,
        branchName: row.branch_name || "Unassigned",
        status: row.stock_quantity === 0 ? "out_of_stock" : row.reorder_level > 0 && row.stock_quantity <= row.reorder_level ? "low_stock" : "in_stock",
        updatedAt: row.updated_at || row.created_at,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      categories: categoryRows.results ?? [],
      totals: {
        productCount: total,
        lowStock: lowStockCount,
        stockValue: totalValue,
        categories: categoryRows.results?.length ?? 0,
      },
      branchFilter: requestedBranch === "all" || !requestedBranch ? "all" : requestedBranch,
    });
  } catch (error) {
    console.error("List products error", error);
    return Response.json({ error: "We couldn't load inventory. Please try again." }, { status: 500 });
  }
};

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
    const createdAt = new Date().toISOString();
    await context.env.diapalace_db.batch([
      context.env.diapalace_db.prepare("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)").bind(categoryId, category),
      context.env.diapalace_db.prepare("INSERT INTO products (id, business_id, branch_id, name, description, sku, category_id, cost_price, selling_price, stock_quantity, reorder_level, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(product.id, authOrRes.user.business_id, authOrRes.branches[0]?.id || "", body.name.trim(), body.description?.trim() ?? "", sku, categoryId, body.cost ?? 0, body.price, body.stock ?? 0, body.reorderAt ?? 0, body.unit ?? "piece", createdAt, createdAt),
      context.env.diapalace_db.prepare("INSERT INTO inventory_movements (id, business_id, branch_id, product_id, type, quantity, reference_type, note, created_at) VALUES (?, ?, ?, ?, 'opening', ?, 'product', 'Opening quantity', ?)").bind(crypto.randomUUID(), authOrRes.user.business_id, authOrRes.branches[0]?.id || "", product.id, body.stock ?? 0, createdAt),
    ]);
    return Response.json({ id: product.id, name: body.name.trim(), description: body.description?.trim() ?? "", sku, category, price: body.price, cost: body.cost ?? 0, stock: body.stock ?? 0, reorderAt: body.reorderAt ?? 0, unit: body.unit ?? "piece" });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to create product" }, { status: 500 });
  }
};
