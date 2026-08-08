import { requireAuth, logAudit } from "../../_lib/auth";
import { createNotifications } from "../../_lib/notifications";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (authOrRes.user.role !== "owner" && authOrRes.user.role !== "manager") {
      return Response.json({ error: "Only an owner or manager can acknowledge a cash difference." }, { status: 403 });
    }

    const body = (await context.request.json()) as { closingId?: string; note?: string };
    if (!body.closingId) return Response.json({ error: "Cash-up is required." }, { status: 400 });
    const note = (body.note ?? "").trim();

    const db = context.env.diapalace_db;
    const closing = await db
      .prepare("SELECT * FROM shift_closings WHERE id = ? AND business_id = ?")
      .bind(body.closingId, authOrRes.user.business_id)
      .first<any>();
    if (!closing) return Response.json({ error: "This cash-up could not be found." }, { status: 404 });
    if (!authOrRes.branches.some((branch) => branch.id === closing.branch_id)) {
      return Response.json({ error: "You do not have access to this branch." }, { status: 403 });
    }
    if (closing.acknowledged_at) {
      return Response.json({ error: "This cash-up has already been acknowledged." }, { status: 409 });
    }
    if (closing.cash_difference === 0) {
      return Response.json({ error: "This cash-up has no difference to acknowledge." }, { status: 400 });
    }

    const acknowledgedAt = new Date().toISOString();
    const branchName = authOrRes.branches.find((branch) => branch.id === closing.branch_id)?.name || "Branch";

    await db
      .prepare("UPDATE shift_closings SET acknowledged_by_id = ?, acknowledged_at = ?, acknowledged_note = ? WHERE id = ?")
      .bind(authOrRes.user.id, acknowledgedAt, note, closing.id)
      .run();

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: closing.branch_id,
      branch_name: branchName,
      module: "PAYMENTS",
      action: "CASH_UP_ACKNOWLEDGED",
      entity_type: "REGISTER_SHIFT",
      entity_id: closing.id,
      old_values: { status: closing.status, difference: closing.cash_difference },
      new_values: { acknowledgedAt, note },
      reason: note || "Cash difference acknowledged",
      description: `${authOrRes.user.full_name} acknowledged the cash difference of GH₵ ${Math.abs(closing.cash_difference).toFixed(2)} on the cash-up.`,
    });

    if (authOrRes.user.role === "manager") {
      await createNotifications(db, {
        businessId: authOrRes.user.business_id,
        branchId: closing.branch_id,
        branchName,
        category: "CASH",
        type: "CASH_ACKNOWLEDGED",
        severity: "INFO",
        title: "Cash difference acknowledged",
        message: `${branchName} cash difference of GH₵ ${Math.abs(closing.cash_difference).toFixed(2)} was acknowledged by ${authOrRes.user.full_name}.${note ? ` Note: ${note}` : ""}`,
        entityType: "CASH_RECONCILIATION",
        entityId: closing.id,
        actionUrl: "/understand/reconciliation",
        dedupeKey: `CASH_ACKNOWLEDGED:${closing.id}`,
        roles: ["owner"],
        metadata: { note, acknowledgedBy: authOrRes.user.id },
      });
    }

    return Response.json({ closingId: closing.id, acknowledgedAt, acknowledgedBy: authOrRes.user.full_name });
  } catch (error) {
    console.error("Acknowledge cash-up error", error);
    return Response.json({ error: "The cash-up could not be acknowledged. No changes were made." }, { status: 409 });
  }
};
