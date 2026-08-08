import { requireAuth, logAudit } from "../../_lib/auth";

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

    const targetBranch = await db
      .prepare(
        `SELECT b.*, u.full_name as manager_name
         FROM branches b
         LEFT JOIN users u ON u.id = b.manager_id
         WHERE b.id = ? AND b.business_id = ?`
      )
      .bind(branchId, authOrRes.user.business_id)
      .first<any>();

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
    const db = context.env.diapalace_db;

    // Safety Rule 5: Check if branch has historical sales, expenses, or staff
    const stats = await db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM sales WHERE branch_id = ?) as sales_count,
          (SELECT COUNT(*) FROM expenses WHERE branch_id = ?) as expense_count,
          (SELECT COUNT(*) FROM user_branches WHERE branch_id = ?) as employee_count`
      )
      .bind(branchId, branchId, branchId)
      .first<{ sales_count: number; expense_count: number; employee_count: number }>();

    const totalRecords = (stats?.sales_count || 0) + (stats?.expense_count || 0) + (stats?.employee_count || 0);

    if (totalRecords > 0) {
      return Response.json(
        {
          error: "Cannot permanently delete. This branch contains historical business records.",
          recommendation: "Archive Branch",
          hasRecords: true,
          stats: {
            sales: stats?.sales_count || 0,
            expenses: stats?.expense_count || 0,
            employees: stats?.employee_count || 0,
          },
        },
        { status: 400 }
      );
    }

    await db.prepare("DELETE FROM branches WHERE id = ? AND business_id = ?").bind(branchId, authOrRes.user.business_id).run();

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: branchId,
      module: "BRANCH",
      action: "BRANCH_DELETED",
      entity_type: "BRANCH",
      entity_id: branchId,
      reason: `Branch ${branchId} with 0 historical records permanently removed by Owner`,
    });

    return Response.json({ success: true, message: "Branch deleted permanently." });
  } catch (error) {
    console.error("Delete branch error:", error);
    return Response.json({ error: "Failed to delete branch" }, { status: 500 });
  }
};
