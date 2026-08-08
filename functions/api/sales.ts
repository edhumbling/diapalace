import { requireAuth, logAudit } from "../_lib/auth";
import { createNotifications } from "../_lib/notifications";
import { getPosState } from "../_lib/pos-database";
import type { ReceiptData } from "../../src/lib/receipt-data";

type ReceiptRow = {
  id: string;
  sale_id: string;
  receipt_number: string;
  branch_id: string;
  business_name: string;
  branch_name: string;
  business_phone: string;
  business_email: string;
  branch_address: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string;
  amount_paid: number;
  change_amount: number;
  created_at: string;
  cashier_name: string;
};

async function loadReceipt(db: D1Database, receiptId: string): Promise<ReceiptData | null> {
  const row = await db.prepare(`SELECT r.*, u.full_name AS cashier_name FROM receipts r LEFT JOIN users u ON u.id = r.cashier_id WHERE r.id = ?`).bind(receiptId).first<ReceiptRow>();
  if (!row) return null;
  const items = await db.prepare("SELECT product_id, product_name, product_description, quantity, unit_price, total FROM receipt_items WHERE receipt_id = ? ORDER BY rowid").bind(row.id).all<{ product_id: string; product_name: string; product_description: string; quantity: number; unit_price: number; total: number }>();
  return {
    id: row.id,
    saleId: row.sale_id,
    receiptNumber: row.receipt_number,
    businessName: row.business_name,
    branchName: row.branch_name,
    businessPhone: row.business_phone,
    businessEmail: row.business_email,
    branchAddress: row.branch_address,
    cashierName: row.cashier_name || "Staff",
    customerName: row.customer_name || undefined,
    customerPhone: row.customer_phone || undefined,
    items: (items.results ?? []).map((item) => ({ productId: item.product_id, name: item.product_name, description: item.product_description, quantity: item.quantity, unitPrice: item.unit_price, total: item.total })),
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    paymentMethod: row.payment_method,
    amountPaid: row.amount_paid,
    change: row.change_amount,
    createdAt: row.created_at,
    footer: "Thank you for shopping with us.",
  };
}

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager", "cashier"].includes(authOrRes.user.role)) return Response.json({ error: "You are not authorized to complete sales." }, { status: 403 });

    const body = await context.request.json() as { customerId?: string; branchId?: string; idempotencyKey?: string; items?: Array<{ productId: string; qty: number; price: number }>; subtotal?: number; discount?: number; tax?: number; total?: number; method?: string; reference?: string; amountPaid?: number };
    if (!body.items?.length || typeof body.total !== "number" || !body.method) return Response.json({ error: "Sale items and payment are required." }, { status: 400 });
    if (body.items.some((item) => !item.productId || !Number.isInteger(item.qty) || item.qty <= 0)) return Response.json({ error: "Sale quantities must be whole numbers greater than zero." }, { status: 400 });

    const db = context.env.diapalace_db;
    const idempotencyKey = body.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await db.prepare("SELECT id, sale_id FROM receipts WHERE business_id = ? AND idempotency_key = ?").bind(authOrRes.user.business_id, idempotencyKey).first<{ id: string; sale_id: string }>();
      if (existing) {
        const receipt = await loadReceipt(db, existing.id);
        const state = await getPosState(db);
        const sale = state.sales.find((item) => item.id === receipt?.receiptNumber);
        if (receipt) return Response.json({ sale, receipt, state, duplicate: true });
      }
    }

    const branchId = body.branchId && authOrRes.branches.some((branch) => branch.id === body.branchId) ? body.branchId : authOrRes.branches[0]?.id || "";
    const branch = await db.prepare("SELECT name, phone, address FROM branches WHERE id = ?").bind(branchId).first<{ name: string; phone: string; address: string | null }>();
    const business = await db.prepare("SELECT name, phone, email FROM businesses WHERE id = ?").bind(authOrRes.user.business_id).first<{ name: string; phone: string; email: string }>();
    const customer = body.customerId ? await db.prepare("SELECT name, phone FROM customers WHERE id = ?").bind(body.customerId).first<{ name: string; phone: string }>() : null;
    const productSnapshots: ReceiptData["items"] = [];
    for (const item of body.items) {
      const product = await db.prepare("SELECT id, name, COALESCE(description, '') AS description, stock_quantity, selling_price FROM products WHERE id = ?").bind(item.productId).first<{ id: string; name: string; description: string; stock_quantity: number; selling_price: number }>();
      if (!product) return Response.json({ error: "One of the selected products is no longer available." }, { status: 409 });
      if (product.stock_quantity < item.qty) return Response.json({ error: `${product.name} does not have enough stock to complete this sale.` }, { status: 409 });
      productSnapshots.push({ productId: product.id, name: product.name, description: product.description, quantity: item.qty, unitPrice: product.selling_price, total: product.selling_price * item.qty });
    }

    const subtotal = productSnapshots.reduce((sum, item) => sum + item.total, 0);
    const discount = Math.min(Math.max(body.discount ?? 0, 0), subtotal);
    const tax = Math.max(body.tax ?? 0, 0);
    const total = Math.max(0, subtotal - discount + tax);
    const amountPaid = body.amountPaid ?? total;
    if (amountPaid < total) return Response.json({ error: "Payment received does not cover the sale total." }, { status: 400 });
    const change = Math.max(0, amountPaid - total);
    const saleId = crypto.randomUUID();
    const receiptNumber = `DP-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(2, 14)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const receiptId = `rcpt-${crypto.randomUUID()}`;
    const statements: D1PreparedStatement[] = [db.prepare("INSERT INTO sales (id, business_id, branch_id, invoice_number, customer_id, cashier_id, subtotal, discount, tax, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?)").bind(saleId, authOrRes.user.business_id, branchId, receiptNumber, body.customerId ?? null, authOrRes.user.id, subtotal, discount, tax, total, createdAt)];
    for (const item of productSnapshots) {
      statements.push(db.prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?").bind(item.quantity, item.productId));
      statements.push(db.prepare("INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), saleId, item.productId, item.quantity, item.unitPrice, item.total));
      statements.push(db.prepare("INSERT INTO inventory_movements (id, business_id, branch_id, product_id, type, quantity, reference_type, reference_id, note) VALUES (?, ?, ?, ?, 'sale', ?, 'sale', ?, 'POS checkout')").bind(crypto.randomUUID(), authOrRes.user.business_id, branchId, item.productId, -item.quantity, saleId));
    }
    statements.push(db.prepare("INSERT INTO payments (id, sale_id, method, amount, reference, status, paid_at) VALUES (?, ?, ?, ?, ?, 'PAID', ?)").bind(crypto.randomUUID(), saleId, body.method, total, body.reference ?? null, createdAt));
    statements.push(db.prepare("INSERT INTO receipts (id, sale_id, receipt_number, business_id, branch_id, cashier_id, business_name, branch_name, business_phone, business_email, branch_address, customer_name, customer_phone, subtotal, discount, tax, total, payment_method, amount_paid, change_amount, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(receiptId, saleId, receiptNumber, authOrRes.user.business_id, branchId, authOrRes.user.id, business?.name || "Dia's Palace", branch?.name || "Branch", business?.phone || branch?.phone || "", business?.email || "", branch?.address || "", customer?.name || "", customer?.phone || "", subtotal, discount, tax, total, body.method, amountPaid, change, idempotencyKey || null, createdAt));
    for (const item of productSnapshots) statements.push(db.prepare("INSERT INTO receipt_items (id, receipt_id, product_id, product_name, product_description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), receiptId, item.productId, item.name, item.description, item.quantity, item.unitPrice, item.total));
    await db.batch(statements);

    const state = await getPosState(db, branchId);
    const sale = state.sales.find((item) => item.id === receiptNumber);
    const receipt: ReceiptData = { id: receiptId, saleId, receiptNumber, businessName: business?.name || "Dia's Palace", branchName: branch?.name || "Branch", businessPhone: business?.phone || branch?.phone || "", businessEmail: business?.email, branchAddress: branch?.address || "", cashierName: authOrRes.user.full_name, customerName: customer?.name, customerPhone: customer?.phone, items: productSnapshots, subtotal, discount, tax, total, paymentMethod: body.method, amountPaid, change, createdAt, footer: "Thank you for shopping with us." };
    await logAudit(db, { business_id: authOrRes.user.business_id, user_id: authOrRes.user.id, user_name: authOrRes.user.full_name, branch_id: branchId, branch_name: branch?.name || "Branch", module: "SALES", action: "SALE_COMPLETED", entity_type: "SALE", entity_id: saleId, new_values: { receiptNumber, total, paymentMethod: body.method }, reason: "Sale completed", description: `Sale ${receiptNumber} completed.` });

    for (const item of productSnapshots) {
      const product = await db.prepare("SELECT stock_quantity, reorder_level FROM products WHERE id = ?").bind(item.productId).first<{ stock_quantity: number; reorder_level: number }>();
      if (product && product.reorder_level > 0 && product.stock_quantity <= product.reorder_level) await createNotifications(db, { businessId: authOrRes.user.business_id, branchId, branchName: branch?.name || "Branch", category: "INVENTORY", type: "LOW_STOCK", severity: product.stock_quantity === 0 ? "CRITICAL" : "WARNING", title: product.stock_quantity === 0 ? "Out of stock" : "Low stock", message: `${item.name} has ${product.stock_quantity} remaining after sale ${receiptNumber}.`, entityType: "PRODUCT", entityId: item.productId, actionUrl: "/manage/inventory", dedupeKey: `LOW_STOCK:${branchId}:${item.productId}`, roles: ["owner", "manager", "stock_officer"], metadata: { remaining: product.stock_quantity, threshold: product.reorder_level } });
    }
    return Response.json({ sale, receipt, state });
  } catch (error) {
    console.error("Sale transaction rolled back", error);
    return Response.json({ error: "Sale could not be completed. No changes were made." }, { status: 409 });
  }
};
