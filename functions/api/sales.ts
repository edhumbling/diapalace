import { requireAuth, logAudit } from "../_lib/auth";
import { createNotifications } from "../_lib/notifications";
import { getPosState } from "../_lib/pos-database";
import { getOpenShift } from "../_lib/shift-workflow";
import type { ReceiptData } from "../../src/lib/receipt-data";

// The payments table constrains method names. Custom names added through Settings
// cannot be recorded until renamed to one of these supported methods.
const CANONICAL_PAYMENT_METHODS = ["Cash", "MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Card / POS", "Bank transfer", "Credit"];

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
  footer: string;
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
    footer: row.footer || "Thank you for shopping with us.",
  };
}

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager", "cashier"].includes(authOrRes.user.role)) return Response.json({ error: "You are not authorized to complete sales." }, { status: 403 });

    const body = await context.request.json() as { customerId?: string; branchId?: string; idempotencyKey?: string; items?: Array<{ productId: string; qty: number; price: number }>; subtotal?: number; discount?: number; tax?: number; total?: number; method?: string; reference?: string; amountPaid?: number };
    if (!body.items?.length || !body.method) return Response.json({ error: "Sale items and payment are required." }, { status: 400 });
    if (body.items.some((item) => !item.productId || !Number.isInteger(item.qty) || item.qty <= 0)) return Response.json({ error: "Sale quantities must be whole numbers greater than zero." }, { status: 400 });

    const db = context.env.diapalace_db;

    // 1. Payment method must be enabled AND supported by the payments table.
    if (!CANONICAL_PAYMENT_METHODS.includes(body.method)) {
      return Response.json({ error: `The payment method "${body.method}" is not supported. Use a supported method name in Settings, or contact support. No changes were made.` }, { status: 400 });
    }
    const enabledMethods = await db.prepare("SELECT name FROM payment_methods WHERE enabled = 1").all<{ name: string }>();
    if (!(enabledMethods.results ?? []).some((method) => method.name === body.method)) {
      return Response.json({ error: `${body.method} is not enabled for this business. Ask the owner to enable it in Settings.` }, { status: 400 });
    }

    // 2. Idempotency: a network retry must never create a second sale.
    const idempotencyKey = body.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await db.prepare("SELECT id, sale_id FROM receipts WHERE business_id = ? AND idempotency_key = ?").bind(authOrRes.user.business_id, idempotencyKey).first<{ id: string; sale_id: string }>();
      if (existing) {
        const receipt = await loadReceipt(db, existing.id);
        let state: Awaited<ReturnType<typeof getPosState>> | null = null;
        try { state = await getPosState(db); } catch (stateError) { console.error("POS state unavailable during duplicate sale check", stateError); }
        const sale = state?.sales.find((item) => item.id === receipt?.receiptNumber) ?? null;
        if (receipt) return Response.json({ sale, receipt, state, duplicate: true });
      }
    }

    // 3. Branch must be one the user is authorized for.
    const branchId = body.branchId && authOrRes.branches.some((branch) => branch.id === body.branchId) ? body.branchId : authOrRes.branches[0]?.id || "";
    if (!branchId) return Response.json({ error: "You are not assigned to any branch. Ask the owner to assign you to a branch." }, { status: 403 });

    // 4. Register shift: sales must belong to an open shift so cash-up is accurate.
    const openShift = await getOpenShift(db, branchId, authOrRes.user.id);
    if (!openShift) {
      return Response.json({ error: "Sale could not be completed. There is no active register shift. Open a shift from Cash-up before recording sales. No changes were made." }, { status: 409 });
    }

    // 5. Authoritative data from D1 — the browser only supplies product IDs and quantities.
    const branch = await db.prepare("SELECT name, phone, address FROM branches WHERE id = ?").bind(branchId).first<{ name: string; phone: string; address: string | null }>();
    const business = await db.prepare("SELECT name, phone, email, receipt_footer FROM businesses WHERE id = ?").bind(authOrRes.user.business_id).first<{ name: string; phone: string; email: string; receipt_footer: string | null }>();

    // Customer must exist; an unknown customer id is treated as a walk-in rather than failing the sale.
    let customer: { name: string; phone: string } | null = null;
    if (body.customerId) {
      customer = await db.prepare("SELECT name, phone FROM customers WHERE id = ?").bind(body.customerId).first<{ name: string; phone: string }>();
      if (!customer) {
        console.warn(`Sale ${body.idempotencyKey ?? "?"}: customerId "${body.customerId}" did not resolve; recorded as walk-in.`);
      }
    }

    const productSnapshots: ReceiptData["items"] = [];
    for (const item of body.items) {
      const product = await db.prepare("SELECT id, name, COALESCE(description, '') AS description, stock_quantity, selling_price FROM products WHERE id = ? AND business_id = ? AND (branch_id = ? OR branch_id IS NULL)").bind(item.productId, authOrRes.user.business_id, branchId).first<{ id: string; name: string; description: string; stock_quantity: number; selling_price: number }>();
      if (!product) return Response.json({ error: "One of the selected products is not available at this branch. No changes were made." }, { status: 409 });
      if (product.stock_quantity < item.qty) return Response.json({ error: `Sale could not be completed. Only ${product.stock_quantity} unit(s) of ${product.name} are available. No changes were made.` }, { status: 409 });
      productSnapshots.push({ productId: product.id, name: product.name, description: product.description, quantity: item.qty, unitPrice: product.selling_price, total: Math.round(product.selling_price * item.qty * 100) / 100 });
    }

    // 6. Server-authority totals: prices, discount caps and tax are computed here.
    const subtotal = Math.round(productSnapshots.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
    const requestedDiscount = Math.min(Math.max(body.discount ?? 0, 0), subtotal);
    const cashierDiscountCap = Math.round(subtotal * 0.05 * 100) / 100;
    const managerDiscountCap = Math.round(subtotal * 0.15 * 100) / 100;
    const allowedDiscount = authOrRes.user.role === "cashier" ? cashierDiscountCap : authOrRes.user.role === "manager" ? managerDiscountCap : subtotal;
    const discount = Math.round(Math.min(requestedDiscount, allowedDiscount) * 100) / 100;
    if (requestedDiscount > allowedDiscount + 0.001) {
      const capText = authOrRes.user.role === "cashier" ? `GH₵ ${cashierDiscountCap.toFixed(2)} (5%)` : `GH₵ ${managerDiscountCap.toFixed(2)} (15%)`;
      return Response.json({ error: `Discount of GH₵ ${requestedDiscount.toFixed(2)} exceeds your authority (${capText}). Ask a manager or the owner to approve this discount. No changes were made.` }, { status: 403 });
    }
    const settingsRows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('tax_enabled', 'tax_rate')").all<{ key: string; value: string }>();
    const settingsMap = new Map((settingsRows.results ?? []).map((setting) => [setting.key, setting.value]));
    const taxEnabled = settingsMap.get("tax_enabled") === "1";
    const taxRate = Number(settingsMap.get("tax_rate") ?? 15);
    const tax = taxEnabled ? Math.round((subtotal - discount) * taxRate * 100) / 10000 : 0;
    const total = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100);
    const amountPaid = Math.max(0, Math.round((body.amountPaid ?? total) * 100) / 100);
    if (amountPaid < total - 0.001) return Response.json({ error: "Payment received does not cover the sale total. No changes were made." }, { status: 400 });
    const change = Math.round(Math.max(0, amountPaid - total) * 100) / 100;

    const saleId = crypto.randomUUID();
    const receiptNumber = `DP-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(2, 14)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const receiptId = `rcpt-${crypto.randomUUID()}`;
    const footer = business?.receipt_footer?.trim() || "Thank you for shopping with us.";
    const statements: D1PreparedStatement[] = [
      db.prepare("INSERT INTO sales (id, business_id, branch_id, invoice_number, customer_id, cashier_id, subtotal, discount, tax, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?)").bind(saleId, authOrRes.user.business_id, branchId, receiptNumber, customer ? body.customerId : null, authOrRes.user.id, subtotal, discount, tax, total, createdAt),
    ];
    for (const item of productSnapshots) {
      statements.push(db.prepare("UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ? AND business_id = ?").bind(item.quantity, createdAt, item.productId, authOrRes.user.business_id));
      statements.push(db.prepare("INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), saleId, item.productId, item.quantity, item.unitPrice, item.total));
      statements.push(db.prepare("INSERT INTO inventory_movements (id, business_id, branch_id, product_id, type, quantity, reference_type, reference_id, note, created_at) VALUES (?, ?, ?, ?, 'sale', ?, 'sale', ?, 'POS checkout', ?)").bind(crypto.randomUUID(), authOrRes.user.business_id, branchId, item.productId, -item.quantity, saleId, createdAt));
    }
    statements.push(db.prepare("INSERT INTO payments (id, sale_id, method, amount, reference, status, paid_at) VALUES (?, ?, ?, ?, ?, 'PAID', ?)").bind(crypto.randomUUID(), saleId, body.method, amountPaid, body.reference ?? null, createdAt));
    statements.push(db.prepare("INSERT INTO receipts (id, sale_id, receipt_number, business_id, branch_id, cashier_id, business_name, branch_name, business_phone, business_email, branch_address, customer_name, customer_phone, subtotal, discount, tax, total, payment_method, amount_paid, change_amount, footer, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(receiptId, saleId, receiptNumber, authOrRes.user.business_id, branchId, authOrRes.user.id, business?.name || "Dia's Palace", branch?.name || "Branch", business?.phone || branch?.phone || "", business?.email || "", branch?.address || "", customer?.name || "", customer?.phone || "", subtotal, discount, tax, total, body.method, amountPaid, change, footer, idempotencyKey || null, createdAt));
    for (const item of productSnapshots) statements.push(db.prepare("INSERT INTO receipt_items (id, receipt_id, product_id, product_name, product_description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), receiptId, item.productId, item.name, item.description, item.quantity, item.unitPrice, item.total));
    await db.batch(statements);

    // 7. Post-commit steps must never turn a committed sale into a failure response.
    try {
      await logAudit(db, { business_id: authOrRes.user.business_id, user_id: authOrRes.user.id, user_name: authOrRes.user.full_name, branch_id: branchId, branch_name: branch?.name || "Branch", module: "SALES", action: "SALE_COMPLETED", entity_type: "SALE", entity_id: saleId, new_values: { receiptNumber, total, paymentMethod: body.method, shiftId: openShift.id }, reason: "Sale completed", description: `Sale ${receiptNumber} completed.` });
      if (discount > 0) {
        await logAudit(db, { business_id: authOrRes.user.business_id, user_id: authOrRes.user.id, user_name: authOrRes.user.full_name, branch_id: branchId, branch_name: branch?.name || "Branch", module: "SALES", action: "SALE_DISCOUNTED", entity_type: "SALE", entity_id: saleId, new_values: { subtotal, discount, total }, reason: `Discount of GH₵ ${discount.toFixed(2)} applied by ${authOrRes.user.role}`, description: `Discount of GH₵ ${discount.toFixed(2)} applied to sale ${receiptNumber}.` });
      }
      for (const item of productSnapshots) {
        const product = await db.prepare("SELECT stock_quantity, reorder_level FROM products WHERE id = ?").bind(item.productId).first<{ stock_quantity: number; reorder_level: number }>();
        if (product && product.reorder_level > 0 && product.stock_quantity <= product.reorder_level) await createNotifications(db, { businessId: authOrRes.user.business_id, branchId, branchName: branch?.name || "Branch", category: "INVENTORY", type: "LOW_STOCK", severity: product.stock_quantity === 0 ? "CRITICAL" : "WARNING", title: product.stock_quantity === 0 ? "Out of stock" : "Low stock", message: `${item.name} has ${product.stock_quantity} remaining after sale ${receiptNumber}.`, entityType: "PRODUCT", entityId: item.productId, actionUrl: "/inventory", dedupeKey: `LOW_STOCK:${branchId}:${item.productId}`, roles: ["owner", "manager", "stock_officer"], metadata: { remaining: product.stock_quantity, threshold: product.reorder_level } });
      }
    } catch (postError) {
      console.error("Post-sale audit/notification error (sale committed)", postError);
    }

    const receipt: ReceiptData = { id: receiptId, saleId, receiptNumber, businessName: business?.name || "Dia's Palace", branchName: branch?.name || "Branch", businessPhone: business?.phone || branch?.phone || "", businessEmail: business?.email || "", branchAddress: branch?.address || "", cashierName: authOrRes.user.full_name, customerName: customer?.name, customerPhone: customer?.phone, items: productSnapshots, subtotal, discount, tax, total, paymentMethod: body.method, amountPaid, change, createdAt, footer };

    let state: Awaited<ReturnType<typeof getPosState>> | null = null;
    try {
      state = await getPosState(db, branchId || undefined);
    } catch (stateError) {
      console.error("Fresh POS state could not be loaded after a completed sale", stateError);
    }
    const sale = state?.sales.find((item) => item.id === receiptNumber) ?? null;
    return Response.json({ sale, receipt, state });
  } catch (error) {
    console.error("Sale transaction failed", error);
    return Response.json({ error: "Sale could not be completed. No changes were made. Please try again." }, { status: 409 });
  }
};
