import { requireAuth, logAudit } from "../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const body = await context.request.json() as { name?: string; phone?: string };
    if (!body.name?.trim()) return Response.json({ error: "Customer name is required" }, { status: 400 });

    const customerId = `c-${crypto.randomUUID()}`;
    const branchId = authOrRes.branches[0]?.id || "";
    await context.env.diapalace_db.prepare("INSERT INTO customers (id, business_id, name, phone, credit_balance, visit_count) VALUES (?, ?, ?, ?, 0, 0)").bind(customerId, authOrRes.user.business_id, body.name.trim(), body.phone?.trim() ?? "").run();

    await logAudit(context.env.diapalace_db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: authOrRes.branches[0]?.name || "Branch",
      module: "SETTINGS",
      action: "CUSTOMER_CREATED",
      entity_type: "CUSTOMER",
      entity_id: customerId,
      new_values: { name: body.name.trim(), phone: body.phone?.trim() ?? "" },
      reason: `Customer '${body.name.trim()}' registered`,
      description: `${authOrRes.user.full_name} added customer '${body.name.trim()}'.`,
    });

    return Response.json({ id: customerId, name: body.name.trim(), phone: body.phone?.trim() ?? "", credit: 0, visits: 0 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to create customer" }, { status: 500 });
  }
};