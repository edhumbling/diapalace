import { requireAuth, logAudit } from "../../_lib/auth";
import { createNotifications } from "../../_lib/notifications";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (authOrRes.user.role !== "owner") {
      return Response.json({ error: "Only the business owner can reopen a closed shift." }, { status: 403 });
    }

    const body = (await context.request.json()) as { closingId?: string; reason?: string };
    if (!body.closingId) return Response.json({ error: "Cash-up is required." }, { status: 400 });
    const reason = (body.reason ?? "").trim();
    if (!reason) return Response.json({ error: "Please explain why you are reopening this shift." }, { status: 400 });

    const db = context.env.diapalace_db;
    const closing = await db
      .prepare("SELECT * FROM shift_closings WHERE id = ? AND business_id = ?")
      .bind(body.closingId, authOrRes.user.business_id)
      .first<any>();
    if (!closing) return Response.json({ error: "This cash-up could not be found." }, { status: 404 });
    if (!authOrRes.branches.some((branch) => branch.id === closing.branch_id)) {
      return Response.json({ error: "You do not have access to this branch." }, { status: 403 });
    }
    if (closing.reopened_at) {
      return Response.json({ error: "This cash-up has already been reopened." }, { status: 409 });
    }

    const shift = await db.prepare("SELECT * FROM shifts WHERE id = ?").bind(closing.shift_id).first<any>();
    if (!shift) return Response.json({ error: "The related shift could not be found." }, { status: 404 });
    if (shift.status === "OPEN") return Response.json({ error: "This shift is already open." }, { status: 409 });

    const reopenedAt = new Date().toISOString();
    const branchName = authOrRes.branches.find((branch) => branch.id === closing.branch_id)?.name || "Branch";

    await db.batch([
      db.prepare("UPDATE shifts SET status = 'OPEN' WHERE id = ?").bind(shift.id),
      db.prepare("UPDATE shift_closings SET reopened_at = ?, reopened_by_id = ?, reopened_reason = ? WHERE id = ?").bind(reopenedAt, authOrRes.user.id, reason, closing.id),
    ]);

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: closing.branch_id,
      branch_name: branchName,
      module: "PAYMENTS",
      action: "CASH_UP_REOPENED",
      entity_type: "REGISTER_SHIFT",
      entity_id: closing.shift_id,
      old_values: { status: closing.status, closedAt: closing.closed_at, difference: closing.cash_difference },
      new_values: { status: "OPEN", reopenedAt, reason },
      reason: `Shift reopened: ${reason}`,
      description: `${authOrRes.user.full_name} reopened the closed shift (previous difference GH₵ ${closing.cash_difference}) because ${reason}.`,
    });

    await createNotifications(db, {
      businessId: authOrRes.user.business_id,
      branchId: closing.branch_id,
      branchName,
      category: "CASH",
      type: "SHIFT_REOPENED",
      severity: "WARNING",
      title: "Shift reopened",
      message: `${branchName} reopened the closed shift on register ${closing.register_id ? "for further count" : ""} because ${reason}. A new cash count is required.`,
      entityType: "CASH_RECONCILIATION",
      entityId: closing.id,
      actionUrl: "/understand/reconciliation",
      dedupeKey: `SHIFT_REOPENED:${closing.id}`,
      roles: ["owner", "manager"],
      metadata: { reason, shiftId: shift.id },
    });

    return Response.json({ shiftId: shift.id, reopenedAt, reason });
  } catch (error) {
    console.error("Reopen shift error", error);
    return Response.json({ error: "The shift could not be reopened. No changes were made." }, { status: 409 });
  }
};
