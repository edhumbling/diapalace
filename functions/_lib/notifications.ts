import { logAudit, type AuthenticatedUser, type AuditModule } from "./auth";

export type NotificationCategory =
  | "SALES"
  | "PAYMENTS"
  | "CASH"
  | "INVENTORY"
  | "PURCHASING"
  | "EMPLOYEES"
  | "BRANCHES"
  | "EXPENSES"
  | "SECURITY"
  | "APPROVALS"
  | "REPORTS"
  | "SYSTEM";

export type NotificationSeverity = "CRITICAL" | "WARNING" | "NORMAL" | "INFO";
export type NotificationStatus = "UNREAD" | "READ" | "ACKNOWLEDGED" | "ACTIONED" | "RESOLVED" | "DISMISSED";

export type NotificationEvent = {
  businessId: string;
  branchId?: string | null;
  branchName?: string;
  category: NotificationCategory;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  dedupeKey: string;
  roles: AuthenticatedUser["role"][];
  metadata?: Record<string, unknown>;
};

type Recipient = { id: string; role: AuthenticatedUser["role"] };

const NOTIFICATION_AUDIT_MODULE: AuditModule = "NOTIFICATIONS";

async function resolveRecipients(db: D1Database, event: NotificationEvent): Promise<Recipient[]> {
  const rolePlaceholders = event.roles.map(() => "?").join(", ");
  const branchCondition = event.branchId
    ? `AND (u.role = 'owner' OR ub.branch_id = ? OR b.manager_id = u.id)`
    : "";
  const bindings: (string | null)[] = [event.businessId, ...event.roles];
  if (event.branchId) bindings.push(event.branchId);

  const result = await db
    .prepare(
      `SELECT DISTINCT u.id, u.role
       FROM users u
       LEFT JOIN user_branches ub ON ub.user_id = u.id
       LEFT JOIN branches b ON b.id = ub.branch_id
       WHERE u.business_id = ?
         AND u.status = 'active'
         AND u.role IN (${rolePlaceholders})
         ${branchCondition}`
    )
    .bind(...bindings)
    .all<Recipient>();

  return result.results ?? [];
}

export async function createNotifications(db: D1Database, event: NotificationEvent) {
  const recipients = await resolveRecipients(db, event);
  const created: string[] = [];

  for (const recipient of recipients) {
    const existing = await db
      .prepare(
        `SELECT id FROM notifications
         WHERE recipient_user_id = ? AND dedupe_key = ?
           AND status NOT IN ('RESOLVED', 'DISMISSED', 'ACTIONED')
         LIMIT 1`
      )
      .bind(recipient.id, event.dedupeKey)
      .first<{ id: string }>();
    if (existing) continue;

    const preference = await db
      .prepare("SELECT enabled, mandatory FROM notification_preferences WHERE user_id = ? AND category = ? AND type = ?")
      .bind(recipient.id, event.category, event.type)
      .first<{ enabled: number; mandatory: number }>();
    const isMandatory = event.severity === "CRITICAL" || preference?.mandatory === 1;
    if (preference && preference.enabled === 0 && !isMandatory) continue;

    const notificationId = `ntf-${crypto.randomUUID()}`;
    await db
      .prepare(
        `INSERT INTO notifications (
          id, business_id, branch_id, recipient_user_id, category, type, severity,
          title, message, entity_type, entity_id, action_url, dedupe_key, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        notificationId,
        event.businessId,
        event.branchId ?? null,
        recipient.id,
        event.category,
        event.type,
        event.severity,
        event.title,
        event.message,
        event.entityType ?? null,
        event.entityId ?? null,
        event.actionUrl ?? null,
        event.dedupeKey,
        event.metadata ? JSON.stringify(event.metadata) : null
      )
      .run();
    created.push(notificationId);

    await logAudit(db, {
      business_id: event.businessId,
      user_id: recipient.id,
      branch_id: event.branchId ?? "",
      branch_name: event.branchName ?? "Branch",
      module: NOTIFICATION_AUDIT_MODULE,
      action: "NOTIFICATION_CREATED",
      entity_type: "NOTIFICATION",
      entity_id: notificationId,
      new_values: { category: event.category, type: event.type, severity: event.severity },
      reason: event.title,
      description: event.message,
    });
  }

  return created;
}

export async function resolveNotifications(db: D1Database, businessId: string, dedupeKey: string, actorId: string, reason: string) {
  const rows = await db
    .prepare(
      `SELECT id, recipient_user_id, branch_id
       FROM notifications
       WHERE business_id = ? AND dedupe_key = ?
         AND status NOT IN ('RESOLVED', 'DISMISSED', 'ACTIONED')`
    )
    .bind(businessId, dedupeKey)
    .all<{ id: string; recipient_user_id: string; branch_id: string | null }>();
  if (!rows.results?.length) return 0;

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE notifications
       SET status = 'RESOLVED', resolved_at = ?
       WHERE business_id = ? AND dedupe_key = ?
         AND status NOT IN ('RESOLVED', 'DISMISSED', 'ACTIONED')`
    )
    .bind(now, businessId, dedupeKey)
    .run();

  await logAudit(db, {
    business_id: businessId,
    user_id: actorId,
    branch_id: rows.results[0].branch_id ?? "",
    module: NOTIFICATION_AUDIT_MODULE,
    action: "NOTIFICATION_RESOLVED",
    entity_type: "NOTIFICATION",
    entity_id: rows.results[0].id,
    reason,
    description: `Resolved ${rows.results.length} notification(s): ${reason}`,
  });
  return rows.results.length;
}
