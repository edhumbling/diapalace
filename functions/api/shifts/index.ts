import { requireAuth, logAudit } from "../../_lib/auth";
import {
  getEnabledPaymentMethods,
  getOpenShift,
  resolveRegister,
  computeShiftSalesFigures,
  round2,
  type ShiftRow,
} from "../../_lib/shift-workflow";

type AuthContext = Exclude<Awaited<ReturnType<typeof requireAuth>>, Response>;

function ensureBranchAccess(authOrRes: AuthContext, branchId: string) {
  return authOrRes.branches.some((branch) => branch.id === branchId);
}

function shiftPayload(shift: ShiftRow, extra: Record<string, unknown> = {}) {
  return { id: shift.id, branchId: shift.branch_id, registerId: shift.register_id, cashierId: shift.cashier_id, openingCash: shift.opening_cash, openedAt: shift.opened_at, status: shift.status, ...extra };
}

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    const db = context.env.diapalace_db;
    const url = new URL(context.request.url);
    const requestedBranch = url.searchParams.get("branchId");
    const isOwner = authOrRes.user.role === "owner";
    const isManager = authOrRes.user.role === "manager";
    const isCashier = authOrRes.user.role === "cashier";

    if (authOrRes.user.role === "stock_officer") {
      return Response.json({ error: "You do not have access to Close Shift." }, { status: 403 });
    }

    const branchId = isCashier
      ? authOrRes.branches[0]?.id || ""
      : requestedBranch && requestedBranch !== "all"
        ? requestedBranch
        : authOrRes.branches[0]?.id || "";
    if (!branchId) return Response.json({ error: "No branch is assigned to your account." }, { status: 403 });
    if (!ensureBranchAccess(authOrRes, branchId)) {
      return Response.json({ error: "You do not have access to this branch." }, { status: 403 });
    }

    const branchRow = await db.prepare("SELECT name FROM branches WHERE id = ?").bind(branchId).first<{ name: string }>();
    const registers = await db.prepare("SELECT id, name FROM registers WHERE business_id = ? AND branch_id = ? AND status = 'active' ORDER BY created_at").bind(authOrRes.user.business_id, branchId).all<{ id: string; name: string }>();
    const paymentMethods = await getEnabledPaymentMethods(db);

    const cashierFilter = isCashier ? " AND cashier_id = ?" : "";
    const cashierParam = isCashier ? [authOrRes.user.id] : [];
    const shiftsParam = isCashier ? [authOrRes.user.business_id, branchId, ...cashierParam] : [authOrRes.user.business_id, branchId];

    const openRows = await db
      .prepare(`SELECT s.*, u.full_name AS cashier_name, r.name AS register_name FROM shifts s LEFT JOIN users u ON u.id = s.cashier_id LEFT JOIN registers r ON r.id = s.register_id WHERE s.business_id = ? AND s.branch_id = ? AND s.status = 'OPEN'${cashierFilter} ORDER BY s.opened_at DESC`)
      .bind(...shiftsParam)
      .all<any>();

    const closingRows = await db
      .prepare(`SELECT sc.*, u.full_name AS cashier_name, r.name AS register_name, cb.full_name AS acknowledged_by_name FROM shift_closings sc LEFT JOIN users u ON u.id = sc.cashier_id LEFT JOIN registers r ON r.id = sc.register_id LEFT JOIN users cb ON cb.id = sc.acknowledged_by_id WHERE sc.business_id = ? AND sc.branch_id = ?${cashierFilter.replace("cashier_id", "sc.cashier_id")} ORDER BY sc.closed_at DESC LIMIT 100`)
      .bind(...shiftsParam)
      .all<any>();

    const closings = (closingRows.results ?? []).map((row) => ({
      id: row.id,
      shiftId: row.shift_id,
      registerId: row.register_id,
      registerName: row.register_name || "Register",
      cashierId: row.cashier_id,
      cashierName: row.cashier_name || "Staff",
      openingCash: row.opening_cash,
      totalSales: row.total_sales,
      cashRefunds: row.cash_refunds,
      expectedCash: row.expected_cash,
      countedCash: row.counted_cash,
      difference: row.cash_difference,
      breakdown: typeof row.breakdown === "string" ? JSON.parse(row.breakdown || "[]") : row.breakdown,
      reason: row.difference_reason,
      explanation: row.difference_explanation,
      status: row.status,
      closedAt: row.closed_at,
      acknowledged: Boolean(row.acknowledged_at),
      acknowledgedBy: row.acknowledged_by_name || "",
      acknowledgedNote: row.acknowledged_note,
      reopened: Boolean(row.reopened_at),
      reopenedReason: row.reopened_reason,
    }));

    let current: {
      shift: ReturnType<typeof shiftPayload> | null;
      expected: { totalSales: number; cashSales: number; cashRefunds: number; expectedCash: number; breakdown: Array<{ method: string; expected: number }> } | null;
    } = { shift: null, expected: null };

    if (isCashier) {
      const openShift = await getOpenShift(db, branchId, authOrRes.user.id);
      if (openShift) {
        const figures = await computeShiftSalesFigures(db, authOrRes.user.business_id, branchId, openShift.opened_at, null);
        current = {
          shift: shiftPayload(openShift, { registerName: registers.results?.find((r) => r.id === openShift.register_id)?.name || "Register" }),
          expected: { ...figures, expectedCash: round2(openShift.opening_cash + figures.cashSales - figures.cashRefunds) },
        };
      }
    } else {
      const latestOpen = openRows.results?.[0];
      if (latestOpen) {
        const figures = await computeShiftSalesFigures(db, authOrRes.user.business_id, branchId, latestOpen.opened_at, null);
        current = {
          shift: shiftPayload(latestOpen, { registerName: latestOpen.register_name, cashierName: latestOpen.cashier_name }),
          expected: { ...figures, expectedCash: round2(latestOpen.opening_cash + figures.cashSales - figures.cashRefunds) },
        };
      }
    }

    return Response.json({
      branchId,
      branchName: branchRow?.name || "Branch",
      registers: registers.results ?? [],
      paymentMethods,
      openShifts: (openRows.results ?? []).map((row) => shiftPayload(row, { registerName: row.register_name, cashierName: row.cashier_name })),
      closings,
      current,
      canOpenShift: isOwner || isManager || isCashier,
      canReopen: isOwner,
      canAcknowledge: isOwner || isManager,
    });
  } catch (error) {
    console.error("Fetch shifts error", error);
    return Response.json({ error: "We couldn't load this shift." }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    if (authOrRes.user.role === "stock_officer") {
      return Response.json({ error: "You do not have access to open a shift." }, { status: 403 });
    }

    const body = (await context.request.json()) as { branchId?: string; registerId?: string; openingCash?: number };
    const db = context.env.diapalace_db;
    const isCashier = authOrRes.user.role === "cashier";

    const branchId = body.branchId && !isCashier ? body.branchId : authOrRes.branches[0]?.id || "";
    if (!branchId) return Response.json({ error: "No branch is assigned to your account." }, { status: 403 });
    if (!ensureBranchAccess(authOrRes, branchId)) {
      return Response.json({ error: "You do not have access to this branch." }, { status: 403 });
    }

    const openingCash = Math.max(0, round2(body.openingCash ?? 0));
    const register = await resolveRegister(db, authOrRes.user.business_id, branchId, body.registerId);
    if (!register) return Response.json({ error: "This branch has no active register. Contact your business owner." }, { status: 409 });

    const existingShift = await db.prepare("SELECT id FROM shifts WHERE cashier_id = ? AND status = 'OPEN' LIMIT 1").bind(authOrRes.user.id).first<{ id: string }>();
    if (existingShift) return Response.json({ error: "You already have an open shift. Close it before opening a new one." }, { status: 409 });

    const registerBusy = await db.prepare("SELECT id FROM shifts WHERE register_id = ? AND status = 'OPEN' LIMIT 1").bind(register.id).first<{ id: string }>();
    if (registerBusy) return Response.json({ error: `This register already has an open shift. Use a different register or close that shift first.` }, { status: 409 });

    const shiftId = `shift-${crypto.randomUUID()}`;
    const openedAt = new Date().toISOString();
    await db
      .prepare("INSERT INTO shifts (id, business_id, branch_id, register_id, cashier_id, opened_by_id, opening_cash, opened_at, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', '')")
      .bind(shiftId, authOrRes.user.business_id, branchId, register.id, authOrRes.user.id, authOrRes.user.id, openingCash, openedAt)
      .run();

    const branchName = authOrRes.branches.find((b) => b.id === branchId)?.name || "Branch";
    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: branchName,
      module: "PAYMENTS",
      action: "SHIFT_OPENED",
      entity_type: "REGISTER_SHIFT",
      entity_id: shiftId,
      new_values: { register: register.name, openingCash, openedAt },
      reason: `Shift opened on ${register.name} with opening cash of GH₵ ${openingCash.toFixed(2)}`,
      description: `${authOrRes.user.full_name} opened a shift on ${register.name} (${branchName}) with GH₵ ${openingCash.toFixed(2)} opening cash.`,
    });

    return Response.json({ id: shiftId, branchId, registerId: register.id, registerName: register.name, openingCash, openedAt, status: "OPEN" });
  } catch (error) {
    console.error("Open shift error", error);
    return Response.json({ error: "We couldn't open this shift. Please try again." }, { status: 500 });
  }
};
