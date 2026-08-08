import { requireAuth, logAudit } from "../../_lib/auth";
import type { NotificationStatus } from "../../_lib/notifications";

type NotificationRow = {
  id: string;
  business_id: string;
  branch_id: string | null;
  branch_name: string | null;
  recipient_user_id: string;
  category: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "NORMAL" | "INFO";
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  status: NotificationStatus;
  metadata: string | null;
  created_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
  actioned_at: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
};

function serializeNotification(row: NotificationRow) {
  let metadata: Record<string, unknown> = {};
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
  }
  return { ...row, metadata };
}

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const url = new URL(context.request.url);
    const category = url.searchParams.get("category");
    const branchId = url.searchParams.get("branchId");
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
    const conditions = ["recipient_user_id = ?"];
    const bindings: (string | number)[] = [authOrRes.user.id];

    if (category && category !== "ALL") {
      conditions.push("category = ?");
      bindings.push(category);
    }
    if (branchId && branchId !== "ALL") {
      conditions.push("branch_id = ?");
      bindings.push(branchId);
    }
    if (severity && severity !== "ALL") {
      conditions.push("severity = ?");
      bindings.push(severity);
    }
    if (status === "UNREAD") conditions.push("status = 'UNREAD'");
    if (status === "ACTION_REQUIRED") conditions.push("status IN ('UNREAD', 'READ', 'ACKNOWLEDGED')");
    if (status === "ACTIVE") conditions.push("status NOT IN ('RESOLVED', 'DISMISSED', 'ACTIONED')");

    const result = await context.env.diapalace_db
      .prepare(
        `SELECT n.id, n.business_id, n.branch_id, b.name as branch_name, n.recipient_user_id, n.category, n.type, n.severity,
                title, message, entity_type, entity_id, action_url, status, metadata,
                created_at, read_at, acknowledged_at, actioned_at, resolved_at, dismissed_at
         FROM notifications n
         LEFT JOIN branches b ON b.id = n.branch_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, created_at DESC
         LIMIT ?`
      )
      .bind(...bindings, limit)
      .all<NotificationRow>();

    const unread = await context.env.diapalace_db
      .prepare("SELECT COUNT(*) as count FROM notifications WHERE recipient_user_id = ? AND status = 'UNREAD'")
      .bind(authOrRes.user.id)
      .first<{ count: number }>();

    return Response.json({ notifications: (result.results ?? []).map(serializeNotification), unreadCount: unread?.count ?? 0 });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return Response.json({ notifications: [], unreadCount: 0, error: "Failed to fetch notifications" }, { status: 500 });
  }
};

export const onRequestPatch: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const body = await context.request.json() as { ids?: string[]; action?: "read" | "acknowledge" | "action" | "dismiss" };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
    if (!ids.length || !body.action) return Response.json({ error: "Notification IDs and action are required." }, { status: 400 });

    const now = new Date().toISOString();
    const placeholders = ids.map(() => "?").join(", ");
    const update = body.action === "read"
      ? `status = CASE WHEN status = 'UNREAD' THEN 'READ' ELSE status END, read_at = COALESCE(read_at, ?)`
      : body.action === "acknowledge"
        ? `status = CASE WHEN status IN ('UNREAD', 'READ') THEN 'ACKNOWLEDGED' ELSE status END, read_at = COALESCE(read_at, ?), acknowledged_at = COALESCE(acknowledged_at, ?)`
        : body.action === "action"
          ? `status = 'ACTIONED', read_at = COALESCE(read_at, ?), acknowledged_at = COALESCE(acknowledged_at, ?), actioned_at = COALESCE(actioned_at, ?)`
          : `status = 'DISMISSED', read_at = COALESCE(read_at, ?), dismissed_at = COALESCE(dismissed_at, ?)`;
    const timestampBindings = body.action === "read" ? [now] : body.action === "acknowledge" ? [now, now] : body.action === "action" ? [now, now, now] : [now, now];

    await context.env.diapalace_db
      .prepare(`UPDATE notifications SET ${update} WHERE recipient_user_id = ? AND id IN (${placeholders})`)
      .bind(...timestampBindings, authOrRes.user.id, ...ids)
      .run();

    await logAudit(context.env.diapalace_db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      module: "NOTIFICATIONS",
      action: `NOTIFICATION_${body.action.toUpperCase()}ED`,
      entity_type: "NOTIFICATION",
      entity_id: ids.join(","),
      reason: `User ${body.action} ${ids.length} notification(s)`,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Update notification error:", error);
    return Response.json({ error: "Failed to update notifications" }, { status: 500 });
  }
};
