export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const body = await context.request.json() as { supplier?: string; amount?: number; status?: "Received" | "Pending"; date?: string };
    if (!body.supplier || !body.amount) return Response.json({ error: "Supplier and amount are required" }, { status: 400 });
    const purchase = { id: `PO-${crypto.randomUUID().slice(0, 8)}`, supplier: body.supplier, date: body.date ?? "Today", amount: body.amount, status: body.status ?? "Pending" as const };
    await context.env.diapalace_db.prepare("INSERT INTO purchases (id, invoice_number, supplier_name, purchase_date, amount, status) VALUES (?, ?, ?, ?, ?, ?)").bind(purchase.id, purchase.id, purchase.supplier, purchase.date, purchase.amount, purchase.status).run();
    return Response.json(purchase);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to create purchase" }, { status: 500 });
  }
};
