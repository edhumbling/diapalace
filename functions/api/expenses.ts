import { requireAuth, logAudit } from "../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (!["owner", "manager"].includes(authOrRes.user.role)) return Response.json({ error: "You are not allowed to record expenses." }, { status: 403 });

    const body = await context.request.json() as { description?: string; category?: string; amount?: number; date?: string; branchId?: string };
    if (!body.description?.trim() || !body.amount || body.amount <= 0) return Response.json({ error: "Description and a positive amount are required" }, { status: 400 });

    const branchId = body.branchId && authOrRes.branches.some((branch) => branch.id === body.branchId) ? body.branchId : authOrRes.branches[0]?.id || "";
    const expenseId = `EX-${crypto.randomUUID().slice(0, 8)}`;
    const expenseDate = body.date && !isNaN(new Date(body.date).getTime()) ? body.date : new Date().toISOString().slice(0, 10);
    const expense = { id: expenseId, description: body.description.trim(), category: body.category?.trim() || "Other", date: expenseDate, amount: body.amount };

    await context.env.diapalace_db.prepare("INSERT INTO expenses (id, business_id, branch_id, description, category, expense_date, amount) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(expenseId, authOrRes.user.business_id, branchId, expense.description, expense.category, expense.date, expense.amount).run();

    await logAudit(context.env.diapalace_db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: authOrRes.branches.find((branch) => branch.id === branchId)?.name || "Branch",
      module: "SETTINGS",
      action: "EXPENSE_RECORDED",
      entity_type: "EXPENSE",
      entity_id: expenseId,
      new_values: { description: expense.description, category: expense.category, amount: expense.amount },
      reason: `Expense of GH₵ ${expense.amount} recorded`,
      description: `${authOrRes.user.full_name} recorded expense '${expense.description}' of GH₵ ${expense.amount}.`,
    });

    return Response.json(expense);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to create expense" }, { status: 500 });
  }
};