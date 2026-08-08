import { hashPassword, generateTempPassword, requireAuth, logAudit, type AuthenticatedUser } from "../../_lib/auth";

export const onRequestPatch: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const callerRole = authOrRes.user.role;
    if (callerRole !== "owner" && callerRole !== "manager") {
      return Response.json({ error: "Access denied." }, { status: 403 });
    }

    const employeeId = context.params.id as string;
    if (!employeeId) {
      return Response.json({ error: "Employee ID is required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const body = await context.request.json() as {
      fullName?: string;
      username?: string;
      phone?: string;
      password?: string;
      role?: AuthenticatedUser["role"];
      status?: AuthenticatedUser["status"];
      branchIds?: string[];
      resetPassword?: boolean;
      reason?: string;
    };

    const targetUser = await db
      .prepare("SELECT id, full_name, username, phone, role, status FROM users WHERE id = ? AND business_id = ?")
      .bind(employeeId, authOrRes.user.business_id)
      .first<{ id: string; full_name: string; username: string; phone: string; role: AuthenticatedUser["role"]; status: AuthenticatedUser["status"] }>();

    if (!targetUser) {
      return Response.json({ error: "Employee account not found." }, { status: 404 });
    }

    if (callerRole === "manager") {
      if (targetUser.role === "owner" || targetUser.role === "manager") {
        return Response.json({ error: "Managers cannot modify Owner or Manager accounts." }, { status: 403 });
      }

      if (body.role && body.role !== "cashier") {
        return Response.json({ error: "Managers cannot promote staff to Manager or Owner roles." }, { status: 403 });
      }

      const targetBranches = await db
        .prepare("SELECT branch_id FROM user_branches WHERE user_id = ?")
        .bind(employeeId)
        .all<{ branch_id: string }>();

      const managerBranchSet = new Set(authOrRes.branches.map((b) => b.id));
      const isTargetInManagerBranch = (targetBranches.results ?? []).some((b) => managerBranchSet.has(b.branch_id));

      if (!isTargetInManagerBranch) {
        return Response.json({ error: "Managers can only manage staff in their assigned branch." }, { status: 403 });
      }
    }

    if (targetUser.id === authOrRes.user.id && body.status && body.status !== "active") {
      return Response.json({ error: "You cannot deactivate your own owner account." }, { status: 400 });
    }

    let tempPassword: string | undefined = undefined;
    const statements: D1PreparedStatement[] = [];

    if (body.password) {
      const newHash = await hashPassword(body.password);
      statements.push(db.prepare("UPDATE users SET password_hash = ?, force_password_change = 0 WHERE id = ?").bind(newHash, employeeId));
      statements.push(db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").bind(employeeId, authOrRes.sessionToken));
    } else if (body.resetPassword) {
      tempPassword = generateTempPassword();
      const tempHash = await hashPassword(tempPassword);
      statements.push(db.prepare("UPDATE users SET password_hash = ?, force_password_change = 1 WHERE id = ?").bind(tempHash, employeeId));
      statements.push(db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").bind(employeeId, authOrRes.sessionToken));
    }

    const newName = body.fullName?.trim() ?? targetUser.full_name;
    const newUsername = body.username?.trim().toLowerCase() ?? targetUser.username;
    const newRole = body.role ?? targetUser.role;
    const newStatus = body.status ?? targetUser.status;

    statements.push(
      db.prepare(
        `UPDATE users SET full_name = ?, username = ?, phone = COALESCE(?, phone), role = ?, status = ? WHERE id = ?`
      ).bind(newName, newUsername, body.phone?.trim() ?? null, newRole, newStatus, employeeId)
    );

    if (body.branchIds !== undefined && callerRole === "owner") {
      statements.push(db.prepare("DELETE FROM user_branches WHERE user_id = ?").bind(employeeId));
      for (const bId of body.branchIds) {
        statements.push(
          db.prepare("INSERT INTO user_branches (id, user_id, branch_id) VALUES (?, ?, ?)").bind(
            `ub-${crypto.randomUUID()}`,
            employeeId,
            bId
          )
        );
      }
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }

    const actionType = body.status && body.status !== targetUser.status
      ? (body.status === "deactivated" ? "EMPLOYEE_DEACTIVATED" : "EMPLOYEE_REACTIVATED")
      : (body.role && body.role !== targetUser.role)
      ? "ROLE_CHANGED"
      : (body.resetPassword || body.password)
      ? "PASSWORD_RESET"
      : "EMPLOYEE_UPDATED";

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: authOrRes.branches[0]?.id || "",
      branch_name: authOrRes.branches[0]?.name || "Branch",
      module: "EMPLOYEES",
      action: actionType,
      entity_type: "EMPLOYEE",
      entity_id: employeeId,
      old_values: { full_name: targetUser.full_name, username: targetUser.username, role: targetUser.role, status: targetUser.status },
      new_values: { full_name: newName, username: newUsername, role: newRole, status: newStatus },
      reason: body.reason?.trim() || `${actionType} performed by ${callerRole} ${authOrRes.user.full_name}`,
      description: `${actionType} for '@${targetUser.username}' (${newName})`,
    });

    return Response.json({
      success: true,
      tempPassword,
    });
  } catch (error) {
    console.error("Update employee error:", error);
    return Response.json({ error: "Failed to update employee" }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const callerRole = authOrRes.user.role;
    if (callerRole !== "owner" && callerRole !== "manager") {
      return Response.json({ error: "Access denied." }, { status: 403 });
    }

    const employeeId = context.params.id as string;
    if (!employeeId) {
      return Response.json({ error: "Employee ID is required." }, { status: 400 });
    }

    if (employeeId === authOrRes.user.id) {
      return Response.json({ error: "You cannot delete your own active owner account." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const targetUser = await db
      .prepare("SELECT id, full_name, username, role FROM users WHERE id = ?")
      .bind(employeeId)
      .first<{ id: string; full_name: string; username: string; role: string }>();

    if (targetUser && targetUser.role === "owner") {
      return Response.json({ error: "Owner accounts cannot be deleted." }, { status: 403 });
    }

    await db.batch([
      db.prepare("DELETE FROM users WHERE id = ?").bind(employeeId),
      db.prepare("DELETE FROM user_branches WHERE user_id = ?").bind(employeeId),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(employeeId),
    ]);

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: authOrRes.branches[0]?.id || "",
      module: "EMPLOYEES",
      action: "EMPLOYEE_DELETED",
      entity_type: "EMPLOYEE",
      entity_id: employeeId,
      old_values: targetUser ? { full_name: targetUser.full_name, username: targetUser.username, role: targetUser.role } : null,
      reason: `Employee account '@${targetUser?.username || employeeId}' permanently deleted by ${callerRole}`,
      description: `${callerRole === "owner" ? "Owner" : "Manager"} ${authOrRes.user.full_name} deleted employee '@${targetUser?.username || employeeId}'`,
    });

    return Response.json({ success: true, message: "Employee account deleted." });
  } catch (error) {
    console.error("Delete employee error:", error);
    return Response.json({ error: "Failed to delete employee account." }, { status: 500 });
  }
};
