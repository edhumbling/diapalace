import { requireAuth, logAudit } from "../_lib/auth";
import { getEnabledPaymentMethods } from "../_lib/shift-workflow";

export const onRequestPut: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (authOrRes.user.role !== "owner") return Response.json({ error: "Only the business owner can change business settings." }, { status: 403 });

    const body = await context.request.json() as { taxEnabled?: boolean; taxRate?: number; paymentMethods?: Array<{ name: string; enabled: boolean }> };

    const db = context.env.diapalace_db;
    const previousEnabled = await getEnabledPaymentMethods(db);
    const batch = [];

    if (typeof body.taxEnabled === "boolean" && typeof body.taxRate === "number") {
      if (body.taxRate < 0 || body.taxRate > 100) return Response.json({ error: "Invalid tax rate" }, { status: 400 });
      batch.push(
        db.prepare("INSERT INTO settings (key, value) VALUES ('tax_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(body.taxEnabled ? "1" : "0"),
        db.prepare("INSERT INTO settings (key, value) VALUES ('tax_rate', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(body.taxRate)),
      );
    }

    if (Array.isArray(body.paymentMethods)) {
      const names = new Set<string>();
      for (const method of body.paymentMethods) {
        const name = (method.name ?? "").trim();
        if (!name) return Response.json({ error: "Invalid payment method name" }, { status: 400 });
        if (names.has(name)) return Response.json({ error: `Payment method "${name}" appears more than once` }, { status: 400 });
        names.add(name);
        batch.push(
          db.prepare(
            "INSERT INTO payment_methods (name, enabled) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled"
          ).bind(name, method.enabled ? 1 : 0),
        );
      }
    }

    if (batch.length === 0) return Response.json({ error: "No settings to save" }, { status: 400 });

    await db.batch(batch);

    const newEnabled = await getEnabledPaymentMethods(db);
    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      module: "SETTINGS",
      action: "BUSINESS_SETTINGS_CHANGED",
      entity_type: "SETTINGS",
      entity_id: "business",
      old_values: {
        taxEnabled: body.taxEnabled === undefined ? undefined : !body.taxEnabled,
        taxRate: body.taxRate === undefined ? undefined : body.taxRate,
        paymentMethods: previousEnabled,
      },
      new_values: {
        taxEnabled: body.taxEnabled,
        taxRate: body.taxRate,
        paymentMethods: newEnabled,
      },
      reason: "Business settings updated by owner",
      description: `${authOrRes.user.full_name} updated business settings (tax enabled: ${body.taxEnabled ?? "unchanged"}, tax rate: ${body.taxRate ?? "unchanged"}, enabled payment methods: ${newEnabled.join(", ") || "none"}).`,
    });

    return Response.json({ saved: true, paymentMethods: newEnabled });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to save settings" }, { status: 500 });
  }
};
