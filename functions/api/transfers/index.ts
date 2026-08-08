import { requireAuth, logAudit } from "../../_lib/auth";

type TransferRow = {
  id: string;
  transfer_number: string;
  from_branch_id: string;
  from_branch_name?: string;
  to_branch_id: string;
  to_branch_name?: string;
  product_id: string;
  product_name?: string;
  quantity_dispatched: number;
  quantity_received: number;
  status: "IN_TRANSIT" | "COMPLETED" | "DISCREPANCY";
  notes: string;
  created_at: string;
  completed_at: string | null;
};

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const db = context.env.diapalace_db;
    const transfers = await db
      .prepare(
        `SELECT t.id, t.transfer_number, t.from_branch_id, fb.name as from_branch_name,
                t.to_branch_id, tb.name as to_branch_name, t.product_id, p.name as product_name,
                t.quantity_dispatched, t.quantity_received, t.status, t.notes, t.created_at, t.completed_at
         FROM stock_transfers t
         LEFT JOIN branches fb ON fb.id = t.from_branch_id
         LEFT JOIN branches tb ON tb.id = t.to_branch_id
         LEFT JOIN products p ON p.id = t.product_id
         WHERE t.business_id = ?
         ORDER BY t.created_at DESC`
      )
      .bind(authOrRes.user.business_id)
      .all<TransferRow>();

    return Response.json(transfers.results ?? []);
  } catch (error) {
    console.error("Fetch transfers error:", error);
    return Response.json({ error: "Failed to fetch transfers" }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const body = await context.request.json() as {
      fromBranchId?: string;
      toBranchId?: string;
      productId?: string;
      quantity?: number;
      notes?: string;
    };

    if (!body.fromBranchId || !body.toBranchId || !body.productId || !body.quantity || body.quantity <= 0) {
      return Response.json({ error: "From branch, To branch, Product, and positive Quantity are required." }, { status: 400 });
    }

    if (body.fromBranchId === body.toBranchId) {
      return Response.json({ error: "Source and destination branch cannot be the same." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const transferId = `tr-${crypto.randomUUID()}`;
    const transferNumber = `TR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Check available stock in sending branch
    const product = await db
      .prepare("SELECT stock_quantity, name FROM products WHERE id = ?")
      .bind(body.productId)
      .first<{ stock_quantity: number; name: string }>();

    if (!product || product.stock_quantity < body.quantity) {
      return Response.json({ error: `Insufficient stock for dispatch. Available: ${product?.stock_quantity ?? 0}` }, { status: 400 });
    }

    await db.batch([
      db.prepare(
        `INSERT INTO stock_transfers (id, transfer_number, business_id, from_branch_id, to_branch_id, product_id, quantity_dispatched, dispatched_by_id, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'IN_TRANSIT', ?)`
      ).bind(
        transferId,
        transferNumber,
        authOrRes.user.business_id,
        body.fromBranchId,
        body.toBranchId,
        body.productId,
        body.quantity,
        authOrRes.user.id,
        body.notes?.trim() ?? ""
      ),
      // Deduct stock from origin branch
      db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?").bind(body.quantity, body.productId),
      db.prepare(
        "INSERT INTO inventory_movements (id, product_id, type, quantity, reference_type, reference_id, note) VALUES (?, ?, 'adjustment', ?, 'transfer_dispatch', ?, ?)"
      ).bind(crypto.randomUUID(), body.productId, -body.quantity, transferId, `Dispatched for transfer ${transferNumber}`),
    ]);

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      action: "Create Transfer",
      description: `Created transfer ${transferNumber} of ${body.quantity} units of ${product.name}`,
    });

    return Response.json({ success: true, transferNumber });
  } catch (error) {
    console.error("Create transfer error:", error);
    return Response.json({ error: "Failed to create transfer manifest." }, { status: 500 });
  }
};
