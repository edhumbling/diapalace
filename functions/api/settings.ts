import { requireAuth, logAudit } from "../_lib/auth";

export const onRequestPut: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (authOrRes.user.role !== "owner") return Response.json({ error: "Only the business owner can change business settings." }, { status: 403 });

    const body = await context.request.json() as { taxEnabled?: boolean; taxRate?: number };
    if (typeof body.taxEnabled !== "boolean" || typeof body.taxRate !== "number" || body.taxRate < 0 || body.taxRate > 100) return Response.json({ error: "Invalid settings" }, { status: 400 });

    await context.env.diapalace_db.batch([
      context.env.diapalace_db.prepare("INSERT INTO settings (key, value) VALUES ('tax_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(body.taxEnabled ? "1" : "0"),
      context.env.diapalace_db.prepare("INSERT INTO settings (key, value) VALUES ('tax_rate', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(body.taxRate)),
    ]);

    await logAudit(context.env.diapalace_db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      module: "SETTINGS",
      action: "BUSINESS_SETTINGS_CHANGED",
      entity_type: "SETTINGS",
      entity_id: "tax",
      old_values: { taxEnabled: !body.taxEnabled, taxRate: body.taxRate },
      new_values: { taxEnabled: body.taxEnabled, taxRate: body.taxRate },
      reason: "Business tax settings updated by owner",
      description: `${authOrRes.user.full_name} updated tax settings (enabled: ${body.taxEnabled}, rate: ${body.taxRate}%).`,
    });

    return Response.json({ saved: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to save settings" }, { status: 500 });
  }
};