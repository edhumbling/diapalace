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

    const expectedCash = body.expectedCash ?? 0;
    const countedCash = body.countedCash ?? 0;
    const cashVariance = countedCash - expectedCash;

    const expectedMomo = body.expectedMomo ?? 0;
    const countedMomo = body.countedMomo ?? 0;
    const momoVariance = countedMomo - expectedMomo;

    const expectedCard = body.expectedCard ?? 0;
    const countedCard = body.countedCard ?? 0;
    const cardVariance = countedCard - expectedCard;

    const hasShortage = cashVariance < 0 || momoVariance < 0 || cardVariance < 0;
    const status = hasShortage ? "FLAGGED" : "CLOSED";

    await db
      .prepare(
        `INSERT INTO shift_reconciliations (
          id, business_id, branch_id, cashier_id,
          expected_cash, counted_cash, cash_variance,
          expected_momo, counted_momo, momo_variance,
          expected_card, counted_card, card_variance,
          closing_notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        recId,
        authOrRes.user.business_id,
        body.branchId || authOrRes.user.business_id,
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
        status
      )
      .run();

    let desc = `Closed register shift. Expected cash: GH₵ ${expectedCash}, Counted: GH₵ ${countedCash}.`;
    if (hasShortage) desc += ` ⚠️ SHORTAGE DETECTED: GH₵ ${cashVariance}`;

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: body.branchId || authOrRes.branches[0]?.id || "",
      branch_name: authOrRes.branches[0]?.name || "Branch",
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
      const branchId = body.branchId || authOrRes.branches[0]?.id || "";
      const branchName = authOrRes.branches.find((branch) => branch.id === branchId)?.name || "Branch";
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
