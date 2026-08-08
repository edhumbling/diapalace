export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const body = await context.request.json() as { name?: string; phone?: string };
    if (!body.name) return Response.json({ error: "Customer name is required" }, { status: 400 });
    const customer = { id: `c-${crypto.randomUUID()}`, name: body.name, phone: body.phone ?? "", credit: 0, visits: 0 };
    await context.env.diapalace_db.prepare("INSERT INTO customers (id, name, phone, credit_balance, visit_count) VALUES (?, ?, ?, 0, 0)").bind(customer.id, customer.name, customer.phone).run();
    return Response.json(customer);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to create customer" }, { status: 500 });
  }
};
