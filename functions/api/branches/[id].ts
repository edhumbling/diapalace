import { requireAuth, logAudit, verifyPassword } from "../../_lib/auth";

type BranchRow = {
  id: string;
  business_id: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  location: string;
  status: string;
  region: string;
  city: string;
  address: string | null;
  digital_address: string;
  manager_id: string;
  manager_name: string | null;
};

async function collectBranchStats(db: D1Database, branchId: string) {
  const stats = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM sales WHERE branch_id = ?) as sales_count,
        (SELECT COUNT(*) FROM expenses WHERE branch_id = ?) as expense_count,
        (SELECT COUNT(*) FROM purchases WHERE branch_id = ?) as purchase_count,
        (SELECT COUNT(*) FROM user_branches WHERE branch_id = ?) as employee_count,
        (SELECT COUNT(*) FROM stock_transfers WHERE from_branch_id = ? OR to_branch_id = ?) as transfer_count,
        (SELECT COUNT(*) FROM products WHERE branch_id = ?) as product_count,
        (SELECT COUNT(*) FROM inventory_movements WHERE branch_id = ?) as movement_count,
        (SELECT COUNT(*) FROM receipts WHERE branch_id = ?) as receipt_count,
        (SELECT COUNT(*) FROM notifications WHERE branch_id = ?) as notification_count,
        (SELECT COUNT(*) FROM refund_requests WHERE branch_id = ?) as refund_count,
        (SELECT COUNT(*) FROM stock_adjustment_requests WHERE branch_id = ?) as adjustment_count,
        (SELECT COUNT(*) FROM shifts WHERE branch_id = ?) as shift_count,
        (SELECT COUNT(*) FROM shift_closings WHERE branch_id = ?) as closing_count,
        (SELECT COUNT(*) FROM registers WHERE branch_id = ?) as register_count`
    )
    .bind(
      branchId, branchId, branchId, branchId,
      branchId, branchId, branchId, branchId, branchId,
      branchId, branchId, branchId, branchId, branchId
    )
    .first<Record<string, number>>();

  const cleaned = Object.fromEntries(
    Object.entries(stats || {}).map(([key, value]) => [key, Number(value) || 0])
  ) as Record<string, number>;

  return {
    sales: cleaned.sales_count,
    expenses: cleaned.expense_count,
    purchases: cleaned.purchase_count,
    employees: cleaned.employee_count,
    transfers: cleaned.transfer_count,
    products: cleaned.product_count,
    movements: cleaned.movement_count,
    receipts: cleaned.receipt_count,
    notifications: cleaned.notification_count,
    refunds: cleaned.refund_count,
    adjustments: cleaned.adjustment_count,
    shifts: cleaned.shift_count,
    closings: cleaned.closing_count,
    registers: cleaned.register_count,
  };
}

async function findBranch(db: D1Database, businessId: string, branchId: string) {
  return db
    .prepare(
      `SELECT b.*, u.full_name as manager_name
       FROM branches b
       LEFT JOIN users u ON u.id = b.manager_id
       WHERE b.id = ? AND b.business_id = ?`
    )
    .bind(branchId, businessId)
    .first<BranchRow>();
}

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner") {
      return Response.json({ error: "Only the business owner can view branch administration details." }, { status: 403 });
    }

    const branchId = context.params.id as string;
    if (!branchId) {
      return Response.json({ error: "Branch ID is required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const targetBranch = await findBranch(db, authOrRes.user.business_id, branchId);
    if (!targetBranch) {
      return Response.json({ error: "Branch not found." }, { status: 404 });
    }

    const stats = await collectBranchStats(db, branchId);

    const { registers, shifts, closings, ...blockingStats } = stats;
    const totalRecords = Object.values(blockingStats).reduce((sum, value) => sum + value, 0);
    const hasCleanableInfrastructure = registers > 0 && shifts === 0 && closings === 0;

    return Response.json({
      success: true,
      branch: {
        id: targetBranch.id,
        name: targetBranch.name,
        code: targetBranch.code,
        status: targetBranch.status,
        location: targetBranch.location,
        manager_name: targetBranch.manager_name || null,
      },
      stats,
      canDelete: totalRecords === 0,
      hasCleanableInfrastructure,
    });
  } catch (error) {
    console.error("Get branch error:", error);
    return Response.json({ error: "Failed to load branch" }, { status: 500 });
  }
};

export const onRequestPatch: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner") {
      return Response.json({ error: "Only the business owner can manage branch administration." }, { status: 403 });
    }

    const branchId = context.params.id as string;
    if (!branchId) {
      return Response.json({ error: "Branch ID is required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const body = await context.request.json() as {
      name?: string;
      code?: string;
      phone?: string;
      email?: string;
      region?: string;
      city?: string;
      address?: string;
      digitalAddress?: string;
      managerId?: string;
      status?: "active" | "inactive" | "deactivated" | "archived";
      reason?: string;
    };

    const targetBranch = await findBranch(db, authOrRes.user.business_id, branchId);

    if (!targetBranch) {
      return Response.json({ error: "Branch not found." }, { status: 404 });
    }

    // Deactivation Rule 4 & 11: Deactivating a branch forces a mandatory reason
    if (body.status === "deactivated" && targetBranch.status !== "deactivated") {
      if (!body.reason?.trim()) {
        return Response.json({ error: "Deactivating a branch requires a valid operational reason." }, { status: 400 });
      }
    }

    const newName = body.name?.trim() ?? targetBranch.name;
    const newCode = body.code?.trim().toUpperCase() ?? targetBranch.code;
    const newPhone = body.phone?.trim() ?? targetBranch.phone;
    const newEmail = body.email?.trim() ?? targetBranch.email;
    const newRegion = body.region?.trim() ?? targetBranch.region;
    const newCity = body.city?.trim() ?? targetBranch.city;
    const newAddress = body.address?.trim() ?? targetBranch.address;
    const newDigitalAddress = body.digitalAddress?.trim() ?? targetBranch.digital_address;
    const newManagerId = body.managerId !== undefined ? body.managerId : targetBranch.manager_id;
    const newStatus = body.status ?? targetBranch.status;
    const reasonText = body.reason?.trim() ?? "";

    await db
      .prepare(
        `UPDATE branches
         SET name = ?, code = ?, phone = ?, email = ?, region = ?, city = ?, address = ?, digital_address = ?, manager_id = ?, status = ?, deactivation_reason = ?
         WHERE id = ?`
      )
      .bind(
        newName,
        newCode,
        newPhone,
        newEmail,
        newRegion,
        newCity,
        newAddress,
        newDigitalAddress,
        newManagerId,
        newStatus,
        reasonText,
        branchId
      )
      .run();

    // Determine audit action type
    let auditAction = "BRANCH_UPDATED";
    let auditReason = reasonText || `Updated branch details for '${newName}'`;
    let managerName = targetBranch.manager_name || "Unassigned";

    if (body.managerId !== undefined && body.managerId !== targetBranch.manager_id) {
      auditAction = "BRANCH_MANAGER_CHANGED";
      if (newManagerId) {
        const mgrRow = await db.prepare("SELECT full_name FROM users WHERE id = ?").bind(newManagerId).first<{ full_name: string }>();
        if (mgrRow) managerName = mgrRow.full_name;
      }
      auditReason = `Branch manager changed from '${targetBranch.manager_name || "Unassigned"}' to '${managerName}'`;
    } else if (body.status && body.status !== targetBranch.status) {
      if (body.status === "deactivated") auditAction = "BRANCH_DEACTIVATED";
      else if (body.status === "archived") auditAction = "BRANCH_ARCHIVED";
      else if (body.status === "active") auditAction = "BRANCH_RESTORED";
    }

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: newName,
      module: "BRANCH",
      action: auditAction,
      entity_type: "BRANCH",
      entity_id: branchId,
      old_values: { name: targetBranch.name, code: targetBranch.code, status: targetBranch.status, manager_id: targetBranch.manager_id },
      new_values: { name: newName, code: newCode, status: newStatus, manager_id: newManagerId },
      reason: auditReason,
      description: `${auditAction}: '${newName}' (${newCode}) by Owner ${authOrRes.user.full_name}`,
    });

    return Response.json({
      success: true,
      branch: {
        id: branchId,
        name: newName,
        code: newCode,
        phone: newPhone,
        email: newEmail,
        region: newRegion,
        city: newCity,
        address: newAddress,
        digital_address: newDigitalAddress,
        manager_id: newManagerId,
        manager_name: managerName,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("Update branch error:", error);
    return Response.json({ error: "Failed to update branch" }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner") {
      return Response.json({ error: "Only the business owner can delete branches." }, { status: 403 });
    }

    const branchId = context.params.id as string;
    if (!branchId) {
      return Response.json({ error: "Branch ID is required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const targetBranch = await findBranch(db, authOrRes.user.business_id, branchId);
    if (!targetBranch) {
      return Response.json({ error: "Branch not found." }, { status: 404 });
    }

    const body = await context.request.json() as { password?: string; confirmName?: string };
    const isLocalDev = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(context.request.url).hostname);

    // Re-authentication: the owner must prove their identity with their password.
    if (!body.password) {
      return Response.json({ error: "Enter your password to confirm this action." }, { status: 400 });
    }
    const userRow = await db.prepare("SELECT password_hash FROM users WHERE id = ?").bind(authOrRes.user.id).first<{ password_hash: string }>();
    if (!userRow?.password_hash && !isLocalDev) {
      return Response.json({ error: "Set a password on your account before deleting a branch." }, { status: 400 });
    }
    const passwordOk = userRow?.password_hash
      ? await verifyPassword(body.password, userRow.password_hash)
      : isLocalDev;
    if (!passwordOk) {
      return Response.json({ error: "Password is incorrect. No changes were made." }, { status: 401 });
    }

    // Name confirmation guard: the owner must type the branch name.
    if (!body.confirmName || body.confirmName.trim().toLowerCase() !== targetBranch.name.trim().toLowerCase()) {
      return Response.json({ error: "The branch name you typed does not match. No changes were made." }, { status: 400 });
    }

    // Last-branch guard: a business must always keep at least one branch.
    const branchCount = await db
      .prepare("SELECT COUNT(*) as count FROM branches WHERE business_id = ?")
      .bind(authOrRes.user.business_id)
      .first<{ count: number }>();
    if ((branchCount?.count || 0) <= 1) {
      return Response.json({ error: "This is the only branch in your business and cannot be deleted. Deactivate it instead." }, { status: 400 });
    }

    // Safety Rule 5: Check if branch has historical business records.
    const stats = await collectBranchStats(db, branchId);
    const { registers, shifts, closings, ...blockingStats } = stats;
    const totalRecords = Object.values(blockingStats).reduce((sum, value) => sum + value, 0);

    if (totalRecords > 0) {
      await logAudit(db, {
        business_id: authOrRes.user.business_id,
        user_id: authOrRes.user.id,
        user_name: authOrRes.user.full_name,
        branch_id: branchId,
        branch_name: targetBranch.name,
        module: "BRANCH",
        action: "BRANCH_DELETE_BLOCKED",
        entity_type: "BRANCH",
        entity_id: branchId,
        old_values: { stats },
        reason: `Attempted permanent deletion of '${targetBranch.name}' blocked: ${totalRecords} historical business record(s) exist. Recommendation: deactivate or archive.`,
        severity: "WARNING",
      });
      return Response.json(
        {
          error: "This branch contains historical business records and cannot be permanently deleted. No changes were made.",
          recommendation: "Archive Branch",
          hasRecords: true,
          stats,
        },
        { status: 400 }
      );
    }

    // Permanently delete the branch and its auto-created register infrastructure.
    await db.batch([
      db.prepare("DELETE FROM registers WHERE branch_id = ?").bind(branchId),
      db.prepare("DELETE FROM user_branches WHERE branch_id = ?").bind(branchId),
      db.prepare("DELETE FROM branches WHERE id = ? AND business_id = ?").bind(branchId, authOrRes.user.business_id),
    ]);

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      branch_name: targetBranch.name,
      module: "BRANCH",
      action: "BRANCH_DELETED",
      entity_type: "BRANCH",
      entity_id: branchId,
      old_values: { name: targetBranch.name, code: targetBranch.code, status: targetBranch.status },
      reason: `Branch '${targetBranch.name}' (${targetBranch.code || "no code"}) permanently removed by Owner ${authOrRes.user.full_name} after password confirmation.`,
      description: `BRANCH_DELETED: '${targetBranch.name}' (${targetBranch.code || "no code"}) permanently removed by Owner ${authOrRes.user.full_name}`,
    });

    return Response.json({ success: true, message: "Branch deleted permanently." });
  } catch (error) {
    console.error("Delete branch error:", error);
    return Response.json({ error: "Failed to delete branch. No changes were made." }, { status: 500 });
  }
};
