import { requireAuth, logAudit } from "../../_lib/auth";
import { createNotifications, resolveNotifications } from "../../_lib/notifications";
import { computeShiftSalesFigures, getEnabledPaymentMethods, round2, type ShiftRow } from "../../_lib/shift-workflow";

const DIFFERENCE_REASONS = ["Wrong change given", "Counting error", "Missing cash", "Business expense", "Refund issue", "Other"];

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (authOrRes.user.role === "stock_officer") {
      return Response.json({ error: "You do not have access to close a shift." }, { status: 403 });
    }

    const body = (await context.request.json()) as {
      shiftId?: string;
      countedCash?: number;
      countedBreakdown?: Array<{ method: string; counted: number }>;
      differenceReason?: string;
      differenceExplanation?: string;
      submissionId?: string;
    };

    if (!body.shiftId) return Response.json({ error: "Shift is required." }, { status: 400 });
    if (typeof body.countedCash !== "number" || body.countedCash < 0) {
      return Response.json({ error: "Cash counted must be a valid amount." }, { status: 400 });
    }
    const submissionId = body.submissionId?.trim() || `sub-${crypto.randomUUID()}`;

    const db = context.env.diapalace_db;

    const shift = await db
      .prepare("SELECT * FROM shifts WHERE id = ? AND business_id = ?")
      .bind(body.shiftId, authOrRes.user.business_id)
      .first<ShiftRow>();
    if (!shift) return Response.json({ error: "This shift could not be found." }, { status: 404 });

    if (!authOrRes.branches.some((branch) => branch.id === shift.branch_id)) {
      return Response.json({ error: "You do not have access to this branch." }, { status: 403 });
    }
    if (authOrRes.user.role === "cashier" && shift.cashier_id !== authOrRes.user.id) {
      return Response.json({ error: "You can only close your own shift." }, { status: 403 });
    }

    const existing = await db.prepare("SELECT id FROM shift_closings WHERE submission_id = ?").bind(submissionId).first<{ id: string }>();
    if (existing) {
      const prior = await db.prepare("SELECT * FROM shift_closings WHERE id = ?").bind(existing.id).first<any>();
      if (prior) return Response.json(buildResult(prior, true));
    }

    if (shift.status !== "OPEN") return Response.json({ error: "This shift is already closed." }, { status: 409 });

    const branchName = authOrRes.branches.find((branch) => branch.id === shift.branch_id)?.name || "Branch";
    const register = await db.prepare("SELECT name FROM registers WHERE id = ?").bind(shift.register_id).first<{ name: string }>();

    const figures = await computeShiftSalesFigures(db, authOrRes.user.business_id, shift.branch_id, shift.opened_at, null);
    const expectedCash = round2(shift.opening_cash + figures.cashSales - figures.cashRefunds);
    const countedCash = round2(body.countedCash);
    const difference = round2(countedCash - expectedCash);

    const enabledMethods = await getEnabledPaymentMethods(db);
    const breakdown = enabledMethods.map((method) => {
      const expected = figures.breakdown.find((item) => item.method === method)?.expected ?? 0;
      const counted = body.countedBreakdown?.find((item) => item.method === method)?.counted ?? expected;
      return { method, expected: round2(expected), counted: round2(method === "Cash" ? countedCash : counted) };
    });

    const status = difference < 0 ? "SHORT" : difference > 0 ? "OVER" : "CLOSED";
    const reason = (body.differenceReason ?? "").trim();
    const explanation = (body.differenceExplanation ?? "").trim();

    if (difference !== 0) {
      if (!reason || !DIFFERENCE_REASONS.includes(reason)) {
        return Response.json({ error: "Please select a reason for the difference before closing the shift." }, { status: 400 });
      }
      if (!explanation) {
        return Response.json({ error: "Please explain the difference before closing the shift." }, { status: 400 });
      }
    }

    const closingId = `closing-${crypto.randomUUID()}`;
    const closedAt = new Date().toISOString();

    await db.batch([
      db.prepare("UPDATE shifts SET status = 'CLOSED', closed_at = ?, closed_by_id = ? WHERE id = ?").bind(closedAt, authOrRes.user.id, shift.id),
      db.prepare(
        `INSERT INTO shift_closings (
          id, submission_id, business_id, branch_id, register_id, shift_id, cashier_id, closed_by_id,
          opening_cash, total_sales, cash_refunds, expected_cash, counted_cash, cash_difference,
          breakdown, difference_reason, difference_explanation, status, closed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        closingId, submissionId, authOrRes.user.business_id, shift.branch_id, shift.register_id, shift.id, shift.cashier_id, authOrRes.user.id,
        shift.opening_cash, figures.totalSales, figures.cashRefunds, expectedCash, countedCash, difference,
        JSON.stringify(breakdown), reason, explanation, status, closedAt
      ),
    ]);

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: shift.branch_id,
      branch_name: branchName,
      module: "PAYMENTS",
      action: "CASH_COUNT_SUBMITTED",
      entity_type: "REGISTER_SHIFT",
      entity_id: shift.id,
      new_values: { expectedCash, countedCash, breakdown },
      reason: `Cash count submitted: expected GH₵ ${expectedCash.toFixed(2)}, counted GH₵ ${countedCash.toFixed(2)}`,
      description: `${authOrRes.user.full_name} submitted a cash count of GH₵ ${countedCash.toFixed(2)} against an expected GH₵ ${expectedCash.toFixed(2)} on ${register?.name || "Register"}.`,
    });

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: shift.branch_id,
      branch_name: branchName,
      module: "PAYMENTS",
      action: "CASH_UP_COMPLETED",
      entity_type: "REGISTER_SHIFT",
      entity_id: shift.id,
      old_values: { status: shift.status, openedAt: shift.opened_at, openingCash: shift.opening_cash },
      new_values: { status: "CLOSED", closedAt, expectedCash, countedCash, difference },
      reason: `Shift closed with ${difference === 0 ? "a matched count" : difference < 0 ? `a shortage of GH₵ ${Math.abs(difference).toFixed(2)}` : `an overage of GH₵ ${difference.toFixed(2)}`}`,
      description: `${authOrRes.user.full_name} closed the shift on ${register?.name || "Register"}. Expected GH₵ ${expectedCash.toFixed(2)}, counted GH₵ ${countedCash.toFixed(2)}.`,
    });

    if (difference !== 0) {
      const action = difference < 0 ? "CASH_SHORTAGE_REPORTED" : "CASH_OVERAGE_REPORTED";
      await logAudit(db, {
        business_id: authOrRes.user.business_id,
        user_id: authOrRes.user.id,
        user_name: authOrRes.user.full_name,
        branch_id: shift.branch_id,
        branch_name: branchName,
        module: "PAYMENTS",
        action,
        entity_type: "REGISTER_SHIFT",
        entity_id: shift.id,
        new_values: { expectedCash, countedCash, difference, reason, explanation },
        reason: reason || (difference < 0 ? "Cash shortage" : "Cash overage"),
        description: `Cash difference of GH₵ ${Math.abs(difference).toFixed(2)} (${difference < 0 ? "short" : "over"}) reported on ${register?.name || "Register"}. Reason: ${reason || "Not provided"}.`,
      });

      const word = difference < 0 ? "short" : "over";
      const title = difference < 0 ? "Cash shortage" : "Cash overage";
      await createNotifications(db, {
        businessId: authOrRes.user.business_id,
        branchId: shift.branch_id,
        branchName,
        category: "CASH",
        type: difference < 0 ? "CASH_SHORTAGE" : "CASH_OVERAGE",
        severity: Math.abs(difference) >= 100 ? "CRITICAL" : "WARNING",
        title,
        message: `${branchName} (${register?.name || "Register"}) is GH₵ ${Math.abs(difference).toFixed(2)} ${word}. Expected GH₵ ${expectedCash.toFixed(2)}, counted GH₵ ${countedCash.toFixed(2)}. ${reason ? `Reason: ${reason}` : ""}`,
        entityType: "CASH_RECONCILIATION",
        entityId: closingId,
        actionUrl: "/cash-up",
        dedupeKey: `CASH_DIFFERENCE:${closingId}`,
        roles: ["owner", "manager"],
        metadata: { expectedCash, countedCash, difference, reason, branchId: shift.branch_id },
      });
    }

    const row = await db.prepare("SELECT * FROM shift_closings WHERE id = ?").bind(closingId).first<any>();
    return Response.json(buildResult(row, false));
  } catch (error) {
    console.error("Close shift error", error);
    return Response.json({ error: "Cash-up could not be saved. No changes were made." }, { status: 409 });
  }
};

function buildResult(row: any, duplicate: boolean) {
  return {
    duplicate,
    closing: {
      id: row.id,
      shiftId: row.shift_id,
      branchId: row.branch_id,
      registerId: row.register_id,
      openingCash: row.opening_cash,
      totalSales: row.total_sales,
      cashRefunds: row.cash_refunds,
      expectedCash: row.expected_cash,
      countedCash: row.counted_cash,
      difference: row.cash_difference,
      breakdown: typeof row.breakdown === "string" ? JSON.parse(row.breakdown || "[]") : row.breakdown,
      reason: row.difference_reason,
      explanation: row.difference_explanation,
      status: row.status,
      closedAt: row.closed_at,
    },
  };
}
