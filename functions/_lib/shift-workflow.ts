export type ShiftRow = {
  id: string;
  business_id: string;
  branch_id: string;
  register_id: string;
  cashier_id: string;
  opened_by_id: string;
  opening_cash: number;
  opened_at: string;
  closed_at: string | null;
  closed_by_id: string | null;
  status: "OPEN" | "CLOSED";
  notes: string;
};

export type ShiftSalesFigures = {
  totalSales: number;
  cashSales: number;
  cashRefunds: number;
  breakdown: Array<{ method: string; expected: number }>;
};

export const round2 = (value: number) => Math.round(value * 100) / 100;

export async function getEnabledPaymentMethods(db: D1Database): Promise<string[]> {
  const res = await db
    .prepare("SELECT name FROM payment_methods WHERE enabled = 1 ORDER BY name")
    .all<{ name: string }>();
  return (res.results ?? []).map((row) => row.name);
}

export async function resolveRegister(
  db: D1Database,
  businessId: string,
  branchId: string,
  registerId?: string | null
): Promise<{ id: string; name: string } | null> {
  if (registerId) {
    return db
      .prepare("SELECT id, name FROM registers WHERE id = ? AND business_id = ? AND branch_id = ? AND status = 'active'")
      .bind(registerId, businessId, branchId)
      .first<{ id: string; name: string }>();
  }
  return db
    .prepare("SELECT id, name FROM registers WHERE business_id = ? AND branch_id = ? AND status = 'active' ORDER BY created_at LIMIT 1")
    .bind(businessId, branchId)
    .first<{ id: string; name: string }>();
}

export async function getOpenShift(db: D1Database, branchId: string, cashierId: string): Promise<ShiftRow | null> {
  return db
    .prepare("SELECT * FROM shifts WHERE branch_id = ? AND cashier_id = ? AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1")
    .bind(branchId, cashierId)
    .first<ShiftRow>();
}

export async function computeShiftSalesFigures(
  db: D1Database,
  businessId: string,
  branchId: string,
  fromIso: string,
  toIso: string | null
): Promise<ShiftSalesFigures> {
  const end = toIso ?? new Date().toISOString();
  const payRows = await db
    .prepare(
      `SELECT pay.method AS method, SUM(pay.amount) AS amount
       FROM payments pay
       JOIN sales s ON s.id = pay.sale_id
       WHERE s.business_id = ? AND s.branch_id = ? AND s.status = 'PAID'
         AND s.created_at >= ? AND s.created_at < ?
       GROUP BY pay.method`
    )
    .bind(businessId, branchId, fromIso, end)
    .all<{ method: string; amount: number }>();

  const refundRow = await db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS amount
       FROM refund_requests
       WHERE business_id = ? AND branch_id = ? AND status = 'APPROVED' AND method = 'Cash'
         AND approved_at >= ? AND approved_at < ?`
    )
    .bind(businessId, branchId, fromIso, end)
    .first<{ amount: number }>();

  const breakdown: Array<{ method: string; expected: number }> = [];
  let totalSales = 0;
  let cashSales = 0;
  for (const row of payRows.results ?? []) {
    const amount = round2(row.amount);
    breakdown.push({ method: row.method, expected: amount });
    totalSales += amount;
    if (row.method === "Cash") cashSales = amount;
  }
  totalSales = round2(totalSales);
  const cashRefunds = round2(refundRow?.amount ?? 0);

  return { totalSales, cashSales, cashRefunds, breakdown };
}
