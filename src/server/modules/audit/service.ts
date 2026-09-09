import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

export type AuditEntityType =
  | "user"
  | "student"
  | "mentor_assignment"
  | "action"
  | "referral"
  | "ai_interaction"
  | string;

export type RecordAuditInput = {
  actorUserId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/** ثبت رویداد حسابرسی — همگام و سبک برای SQLite. */
export function recordAudit(input: RecordAuditInput) {
  if (!input.actorUserId) return;

  db.insert(auditEvents)
    .values({
      id: createId("aud"),
      actorUserId: input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeJson: toJson(input.before),
      afterJson: toJson(input.after),
      metadataJson: toJson(input.metadata),
      createdAt: nowIso(),
    })
    .run();
}

export type AuditEventListItem = {
  id: string;
  actorUserId: string;
  actorName: string | null;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson: string | null;
  afterJson: string | null;
  metadataJson: string | null;
  createdAt: string;
};

/** رویدادهای مرتبط با یک دانش‌آموز (موجودیت student یا metadata.studentId). */
export function listAuditEventsForStudent(studentId: string, limit = 80): AuditEventListItem[] {
  const rows = db
    .select({
      id: auditEvents.id,
      actorUserId: auditEvents.actorUserId,
      actorName: users.fullName,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      action: auditEvents.action,
      beforeJson: auditEvents.beforeJson,
      afterJson: auditEvents.afterJson,
      metadataJson: auditEvents.metadataJson,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorUserId, users.id))
    .where(
      or(
        and(eq(auditEvents.entityType, "student"), eq(auditEvents.entityId, studentId)),
        like(auditEvents.metadataJson, `%"studentId":"${studentId}"%`),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
    .all();

  return rows;
}

export function countAuditEvents() {
  const row = db.select({ count: sql<number>`count(*)` }).from(auditEvents).get();
  return row?.count ?? 0;
}
