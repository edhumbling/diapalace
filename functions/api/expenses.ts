export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const body = await context.request.json() as { description?: string; category?: string; amount?: number; date?: string };
    if (!body.description || !body.amount) return Response.json({ error: "Description and amount are required" }, { status: 400 });
    const expense = { id: `EX-${crypto.randomUUID().slice(0, 8)}`, description: body.description, category: body.category ?? "Other", date: body.date ?? "Today", amount: body.amount };
    await context.env.diapalace_db.prepare("INSERT INTO expenses (id, description, category, expense_date, amount) VALUES (?, ?, ?, ?, ?)").bind(expense.id, expense.description, expense.category, expense.date, expense.amount).run();
    return Response.json(expense);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to create expense" }, { status: 500 });
  }
};
