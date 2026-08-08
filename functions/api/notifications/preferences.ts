import { requireAuth, logAudit } from "../../_lib/auth";

type PreferenceDefinition = { category: string; type: string; label: string; mandatory: boolean };

const PREFERENCE_DEFINITIONS: PreferenceDefinition[] = [
  { category: "SALES", type: "LARGE_SALE", label: "Large sales", mandatory: false },
  { category: "PAYMENTS", type: "PAYMENT_FAILED", label: "Payment failed", mandatory: true },
  { category: "CASH", type: "CASH_SHORTAGE", label: "Cash discrepancy", mandatory: true },
  { category: "INVENTORY", type: "LOW_STOCK", label: "Low stock", mandatory: false },
  { category: "INVENTORY", type: "OUT_OF_STOCK", label: "Out of stock", mandatory: false },
  { category: "INVENTORY", type: "STOCK_DISCREPANCY", label: "Stock discrepancy", mandatory: false },
  { category: "APPROVALS", type: "REFUND_REQUEST", label: "Refund requests", mandatory: false },
  { category: "EMPLOYEES", type: "EMPLOYEE_CREATED", label: "Employee added", mandatory: false },
  { category: "EMPLOYEES", type: "EMPLOYEE_DEACTIVATED", label: "Employee deactivated", mandatory: false },
  { category: "SECURITY", type: "FAILED_LOGIN", label: "Failed login", mandatory: true },
  { category: "SECURITY", type: "PASSWORD_RESET", label: "Password reset", mandatory: true },
  { category: "BRANCHES", type: "BRANCH_UPDATED", label: "Branch changes", mandatory: false },
];

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
  if (authOrRes instanceof Response) return authOrRes;

  const rows = await context.env.diapalace_db
    .prepare("SELECT category, type, enabled, mandatory FROM notification_preferences WHERE user_id = ?")
    .bind(authOrRes.user.id)
    .all<{ category: string; type: string; enabled: number; mandatory: number }>();
  const saved = new Map((rows.results ?? []).map((row) => [`${row.category}:${row.type}`, row]));
  return Response.json(PREFERENCE_DEFINITIONS.map((definition) => {
    const row = saved.get(`${definition.category}:${definition.type}`);
    return { ...definition, enabled: row ? row.enabled === 1 : true, mandatory: definition.mandatory || row?.mandatory === 1 };
  }));
};

export const onRequestPatch: PagesFunction<CloudflareEnv> = async (context) => {
  const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
  if (authOrRes instanceof Response) return authOrRes;

  const body = await context.request.json() as { category?: string; type?: string; enabled?: boolean };
  const definition = PREFERENCE_DEFINITIONS.find((item) => item.category === body.category && item.type === body.type);
  if (!definition || typeof body.enabled !== "boolean") return Response.json({ error: "Invalid notification preference." }, { status: 400 });
  if (definition.mandatory && !body.enabled) return Response.json({ error: "Critical notifications cannot be disabled." }, { status: 400 });

  await context.env.diapalace_db
    .prepare(
      `INSERT INTO notification_preferences (id, business_id, user_id, category, type, enabled, mandatory)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, category, type) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP`
    )
    .bind(`pref-${crypto.randomUUID()}`, authOrRes.user.business_id, authOrRes.user.id, definition.category, definition.type, body.enabled ? 1 : 0, definition.mandatory ? 1 : 0)
    .run();

  await logAudit(context.env.diapalace_db, {
    business_id: authOrRes.user.business_id,
    user_id: authOrRes.user.id,
    user_name: authOrRes.user.full_name,
    module: "NOTIFICATIONS",
    action: "NOTIFICATION_PREFERENCE_CHANGED",
    entity_type: "NOTIFICATION_PREFERENCE",
    entity_id: `${definition.category}:${definition.type}`,
    new_values: { enabled: body.enabled },
    reason: `${definition.label} notifications ${body.enabled ? "enabled" : "disabled"}`,
  });
  return Response.json({ success: true });
};
