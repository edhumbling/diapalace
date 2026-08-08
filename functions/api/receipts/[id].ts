import { requireAuth, logAudit } from "../../_lib/auth";
import type { ReceiptData } from "../../../src/lib/receipt-data";

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    const db = context.env.diapalace_db;
    const receiptKey = context.params.id as string;
    const receipt = await db.prepare(`SELECT r.*, u.full_name AS cashier_name, b.name AS current_branch_name FROM receipts r LEFT JOIN users u ON u.id = r.cashier_id LEFT JOIN branches b ON b.id = r.branch_id WHERE r.business_id = ? AND (r.id = ? OR r.sale_id = ? OR r.receipt_number = ?)`).bind(authOrRes.user.business_id, receiptKey, receiptKey, receiptKey).first<{
      id: string; sale_id: string; receipt_number: string; branch_id: string; cashier_id: string; business_name: string; branch_name: string; business_phone: string; business_email: string; branch_address: string; customer_name: string; customer_phone: string; subtotal: number; discount: number; tax: number; total: number; payment_method: string; amount_paid: number; change_amount: number; created_at: string; cashier_name: string; current_branch_name: string;
    }>();
    if (!receipt) return Response.json({ error: "Receipt not found." }, { status: 404 });
    if (authOrRes.user.role !== "owner" && !authOrRes.branches.some((branch) => branch.id === receipt.branch_id)) return Response.json({ error: "You do not have access to this receipt." }, { status: 403 });

    const items = await db.prepare("SELECT product_id, product_name, product_description, quantity, unit_price, total FROM receipt_items WHERE receipt_id = ? ORDER BY rowid").bind(receipt.id).all<{ product_id: string; product_name: string; product_description: string; quantity: number; unit_price: number; total: number }>();
    const result: ReceiptData = {
      id: receipt.id,
      saleId: receipt.sale_id,
      receiptNumber: receipt.receipt_number,
      businessName: receipt.business_name,
      branchName: receipt.branch_name || receipt.current_branch_name || "Branch",
      businessPhone: receipt.business_phone,
      businessEmail: receipt.business_email,
      branchAddress: receipt.branch_address,
      cashierName: receipt.cashier_name || "Staff",
      customerName: receipt.customer_name || undefined,
      customerPhone: receipt.customer_phone || undefined,
      items: (items.results ?? []).map((item) => ({ productId: item.product_id, name: item.product_name, description: item.product_description, quantity: item.quantity, unitPrice: item.unit_price, total: item.total })),
      subtotal: receipt.subtotal,
      discount: receipt.discount,
      tax: receipt.tax,
      total: receipt.total,
      paymentMethod: receipt.payment_method,
      amountPaid: receipt.amount_paid,
      change: receipt.change_amount,
      createdAt: receipt.created_at,
      footer: "Thank you for shopping with us.",
    };
    await logAudit(db, { business_id: authOrRes.user.business_id, user_id: authOrRes.user.id, user_name: authOrRes.user.full_name, branch_id: receipt.branch_id, branch_name: result.branchName, module: "SALES", action: "RECEIPT_REPRINTED", entity_type: "RECEIPT", entity_id: receipt.id, reason: "Receipt reprinted or downloaded", description: `Receipt ${receipt.receipt_number} accessed by ${authOrRes.user.full_name}.` });
    return Response.json(result);
  } catch (error) {
    console.error("Receipt fetch error", error);
    return Response.json({ error: "Unable to load receipt." }, { status: 500 });
  }
};
