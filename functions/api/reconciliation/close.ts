import { requireAuth, logAudit } from "../../_lib/auth";
import { createNotifications } from "../../_lib/notifications";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const body = await context.request.json() as {
      branchId?: string;
      expectedCash?: number;
      countedCash?: number;
      expectedMomo?: number;
      countedMomo?: number;
      expectedCard?: number;
      countedCard?: number;
      notes?: string;
    };

    const db = context.env.diapalace_db;
    const recId = `rec-${crypto.randomUUID()}`;

    const branchId = body.branchId && authOrRes.branches.some((branch) => branch.id === body.branchId) ? body.branchId : authOrRes.branches[0]?.id || "";
    if (!branchId) return Response.json({ error: "You do not have access to any branch to close a register shift." }, { status: 403 });
    const branchName = authOrRes.branches.find((branch) => branch.id === branchId)?.name || "Branch";

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const expected = await db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN pay.method = 'Cash' THEN pay.amount ELSE 0 END), 0) AS cash,
      COALESCE(SUM(CASE WHEN pay.method IN ('MTN MoMo', 'Telecel Cash', 'AirtelTigo Money') THEN pay.amount ELSE 0 END), 0) AS momo,
      COALESCE(SUM(CASE WHEN pay.method IN ('Card / POS', 'Bank transfer') THEN pay.amount ELSE 0 END), 0) AS card
      FROM payments pay JOIN sales s ON s.id = pay.sale_id
      WHERE s.branch_id = ? AND s.status = 'PAID' AND s.created_at >= ?`).bind(branchId, dayStart.toISOString()).first<{ cash: number; momo: number; card: number }>();

    const expectedCash = Math.round((expected?.cash ?? 0) * 100) / 100;
    const expectedMomo = Math.round((expected?.momo ?? 0) * 100) / 100;
    const expectedCard = Math.round((expected?.card ?? 0) * 100) / 100;
    const countedCash = Math.max(body.countedCash ?? 0, 0);
    const countedMomo = Math.max(body.countedMomo ?? 0, 0);
    const countedCard = Math.max(body.countedCard ?? 0, 0);
    const cashVariance = Math.round((countedCash - expectedCash) * 100) / 100;
    const momoVariance = Math.round((countedMomo - expectedMomo) * 100) / 100;
    const cardVariance = Math.round((countedCard - expectedCard) * 100) / 100;

    const hasShortage = cashVariance < 0 || momoVariance < 0 || cardVariance < 0;
    const status = hasShortage ? "FLAGGED" : "CLOSED";

    await db
      .prepare(
        `INSERT INTO shift_reconciliations (
          id, business_id, branch_id, cashier_id,
          expected_cash, counted_cash, cash_variance,
          expected_momo, counted_momo, momo_variance,
          expected_card, counted_card, card_variance,
          closing_notes, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        recId,
        authOrRes.user.business_id,
        branchId,
        authOrRes.user.id,
        expectedCash,
        countedCash,
        cashVariance,
        expectedMomo,
        countedMomo,
        momoVariance,
        expectedCard,
        countedCard,
        cardVariance,
        body.notes?.trim() ?? "",
        status,
        new Date().toISOString()
      )
      .run();

    let desc = `Closed register shift. Expected cash: GH₵ ${expectedCash}, Counted: GH₵ ${countedCash}.`;
    if (hasShortage) desc += ` ⚠️ SHORTAGE DETECTED: GH₵ ${cashVariance}`;

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: branchName,
      module: "PAYMENTS",
      action: "PAYMENT_RECONCILED",
      entity_type: "REGISTER_SHIFT",
      entity_id: recId,
      old_values: { expectedCash, expectedMomo, expectedCard },
      new_values: { countedCash, countedMomo, countedCard, cashVariance, momoVariance, cardVariance, status },
      reason: body.notes?.trim() || (hasShortage ? `Register shortage of GH₵ ${Math.abs(cashVariance)} logged` : "Normal shift closing"),
      description: desc,
    });

    if (hasShortage) {
      const variance = Math.min(cashVariance, momoVariance, cardVariance);
      await createNotifications(db, {
        businessId: authOrRes.user.business_id,
        branchId,
        branchName,
        category: "CASH",
        type: "CASH_SHORTAGE",
        severity: Math.abs(variance) >= 500 ? "CRITICAL" : "WARNING",
        title: "Cash shortage detected",
        message: `${branchName} has a cash-up variance of GH₵ ${Math.abs(variance).toFixed(2)}. Expected GH₵ ${expectedCash.toFixed(2)}, counted GH₵ ${countedCash.toFixed(2)}.`,
        entityType: "CASH_RECONCILIATION",
        entityId: recId,
        actionUrl: "/understand/reconciliation",
        dedupeKey: `CASH_SHORTAGE:${recId}`,
        roles: ["owner", "manager"],
        metadata: { expectedCash, countedCash, cashVariance, expectedMomo, countedMomo, momoVariance, expectedCard, countedCard, cardVariance },
      });
    }

    return Response.json({
      success: true,
      recId,
      cashVariance,
      momoVariance,
      cardVariance,
      status,
    });
  } catch (error) {
    console.error("Reconciliation error:", error);
    return Response.json({ error: "Failed to record shift closing." }, { status: 500 });
  }
};
