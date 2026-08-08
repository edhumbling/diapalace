import { hashPassword, verifyPassword, requireAuth, logAudit } from "../../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const body = await context.request.json() as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.newPassword || body.newPassword.length < 6) {
      return Response.json({ error: "New password must be at least 6 characters." }, { status: 400 });
    }

    const db = context.env.diapalace_db;

    // If force_password_change is false, currentPassword must be verified
    if (!authOrRes.user.force_password_change) {
      if (!body.currentPassword) {
        return Response.json({ error: "Current password is required." }, { status: 400 });
      }

      const userRow = await db
        .prepare("SELECT password_hash FROM users WHERE id = ?")
        .bind(authOrRes.user.id)
        .first<{ password_hash: string }>();

      if (!userRow || !(await verifyPassword(body.currentPassword, userRow.password_hash))) {
        return Response.json({ error: "Current password is incorrect." }, { status: 401 });
      }
    }

    const newHash = await hashPassword(body.newPassword);
    await db
      .prepare("UPDATE users SET password_hash = ?, force_password_change = 0 WHERE id = ?")
      .bind(newHash, authOrRes.user.id)
      .run();

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      action: "Password Change",
      description: `${authOrRes.user.full_name} changed their password`,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return Response.json({ error: "Failed to change password" }, { status: 500 });
  }
};
