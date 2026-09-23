import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { referrals, students } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  PRIORITY,
  REFERRAL_STATUS,
  REFERRAL_STATUS_TITLES_FA,
  ROLE_KEYS,
  type Priority,
  type ReferralStatus,
  type RoleKey,
} from "@/lib/enums";
import { recordAudit } from "@/server/modules/audit/service";

export { REFERRAL_STATUS_TITLES_FA };

const statusEnum = z.enum([
  REFERRAL_STATUS.OPEN,
  REFERRAL_STATUS.IN_REVIEW,
  REFERRAL_STATUS.RESOLVED,
  REFERRAL_STATUS.CANCELLED,
]);

const priorityEnum = z.enum([
  PRIORITY.LOW,
  PRIORITY.MEDIUM,
  PRIORITY.HIGH,
  PRIORITY.URGENT,
]);
const optionalText = z.string().optional().or(z.literal(""));

export const createReferralSchema = z.object({
  studentId: z.string().min(1, "دانش‌آموز الزامی است."),
  createdBy: z.string().min(1),
  assignedTo: optionalText,
  subject: z.string().min(3, "موضوع ارجاع حداقل ۳ نویسه است.").max(200),
  description: optionalText,
  priority: priorityEnum.default(PRIORITY.MEDIUM),
  status: statusEnum.default(REFERRAL_STATUS.OPEN),
});

export const updateReferralStatusSchema = z.object({
  id: z.string().min(1),
  status: statusEnum,
  response: optionalText,
  assignedTo: optionalText,
});

/** گذارهای مجاز وضعیت ارجاع */
export const REFERRAL_STATUS_TRANSITIONS: Record<
  ReferralStatus,
  ReferralStatus[]
> = {
  [REFERRAL_STATUS.OPEN]: [
    REFERRAL_STATUS.IN_REVIEW,
    REFERRAL_STATUS.RESOLVED,
    REFERRAL_STATUS.CANCELLED,
  ],
  [REFERRAL_STATUS.IN_REVIEW]: [
    REFERRAL_STATUS.OPEN,
    REFERRAL_STATUS.RESOLVED,
    REFERRAL_STATUS.CANCELLED,
  ],
  [REFERRAL_STATUS.RESOLVED]: [REFERRAL_STATUS.IN_REVIEW],
  [REFERRAL_STATUS.CANCELLED]: [REFERRAL_STATUS.OPEN],
};

export type ReferralListItem = {
  id: string;
  studentId: string;
  studentName: string | null;
  createdBy: string;
  createdByName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  response: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function referralQuery() {
  return db
    .select({
      id: referrals.id,
      studentId: referrals.studentId,
      studentName: sql<string | null>`(
        select u.full_name from students s
        left join users u on u.id = s.user_id
        where s.id = ${referrals.studentId}
      )`,
      createdBy: referrals.createdBy,
      createdByName: sql<string | null>`(
        select full_name from users u where u.id = ${referrals.createdBy}
      )`,
      assignedTo: referrals.assignedTo,
      assignedToName: sql<string | null>`(
        select full_name from users u where u.id = ${referrals.assignedTo}
      )`,
      subject: referrals.subject,
      description: referrals.description,
      priority: referrals.priority,
      status: referrals.status,
      response: referrals.response,
      resolvedAt: referrals.resolvedAt,
      createdAt: referrals.createdAt,
      updatedAt: referrals.updatedAt,
    })
    .from(referrals);
}

export type ReferralFilters = {
  studentId?: string;
  studentIds?: string[];
  status?: ReferralStatus | ReferralStatus[];
  assignedTo?: string;
  createdBy?: string;
  openOnly?: boolean;
};

function buildConditions(filters: ReferralFilters) {
  const conditions = [];
  if (filters.studentId)
    conditions.push(eq(referrals.studentId, filters.studentId));
  if (filters.assignedTo)
    conditions.push(eq(referrals.assignedTo, filters.assignedTo));
  if (filters.createdBy)
    conditions.push(eq(referrals.createdBy, filters.createdBy));
  if (filters.studentIds) {
    conditions.push(
      filters.studentIds.length > 0
        ? inArray(referrals.studentId, filters.studentIds)
        : sql`1 = 0`,
    );
  }
  if (filters.openOnly) {
    conditions.push(
      inArray(referrals.status, [
        REFERRAL_STATUS.OPEN,
        REFERRAL_STATUS.IN_REVIEW,
      ]),
    );
  } else if (filters.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    conditions.push(inArray(referrals.status, statuses));
  }
  return conditions.length ? and(...conditions) : undefined;
}

export function listReferrals(
  filters: ReferralFilters = {},
): ReferralListItem[] {
  return referralQuery()
    .where(buildConditions(filters))
    .orderBy(desc(referrals.createdAt))
    .all() as ReferralListItem[];
}

export function listOpenReferralsForMentor(
  mentorUserId?: string,
): ReferralListItem[] {
  const rows = listReferrals({ openOnly: true });
  if (!mentorUserId) return rows;
  return rows.filter(
    (row) => !row.assignedTo || row.assignedTo === mentorUserId,
  );
}

export function getReferralById(id: string): ReferralListItem | undefined {
  return referralQuery().where(eq(referrals.id, id)).get() as
    ReferralListItem | undefined;
}

export function createReferral(input: z.infer<typeof createReferralSchema>) {
  if (
    !db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, input.studentId))
      .get()
  ) {
    throw new Error("دانش‌آموز یافت نشد.");
  }

  const now = nowIso();
  const id = createId("ref");
  db.insert(referrals)
    .values({
      id,
      studentId: input.studentId,
      createdBy: input.createdBy,
      assignedTo: input.assignedTo || null,
      subject: input.subject.trim(),
      description: input.description || null,
      priority: input.priority,
      status: input.status,
      response: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getReferralById(id)!;
}

export function assertReferralTransition(
  from: ReferralStatus,
  to: ReferralStatus,
) {
  if (from === to) return;
  const allowed = REFERRAL_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(
      `تغییر وضعیت از «${REFERRAL_STATUS_TITLES_FA[from]}» به «${REFERRAL_STATUS_TITLES_FA[to]}» مجاز نیست.`,
    );
  }
}

/**
 * به‌روزرسانی وضعیت: مربی assign‌شده یا مدیر resolve می‌کند؛
 * سازنده می‌تواند OPEN را CANCEL کند.
 */
export function updateReferralStatus(
  input: z.infer<typeof updateReferralStatusSchema>,
  actorUserId: string,
  actorRole: RoleKey,
) {
  const existing = db
    .select()
    .from(referrals)
    .where(eq(referrals.id, input.id))
    .get();
  if (!existing) throw new Error("ارجاع یافت نشد.");

  const from = existing.status as ReferralStatus;
  const to = input.status;
  assertReferralTransition(from, to);

  if (to === REFERRAL_STATUS.CANCELLED) {
    const canCancel =
      actorRole === ROLE_KEYS.ADMIN ||
      (existing.createdBy === actorUserId && from === REFERRAL_STATUS.OPEN);
    if (!canCancel) {
      throw new Error("فقط سازنده ارجاع باز یا مدیر می‌تواند آن را لغو کند.");
    }
  }

  if (to === REFERRAL_STATUS.RESOLVED || to === REFERRAL_STATUS.IN_REVIEW) {
    const canHandle =
      actorRole === ROLE_KEYS.ADMIN ||
      actorRole === ROLE_KEYS.MENTOR ||
      existing.assignedTo === actorUserId;
    if (!canHandle && to === REFERRAL_STATUS.RESOLVED) {
      throw new Error("فقط مربی مسئول یا مدیر می‌تواند ارجاع را حل کند.");
    }
  }

  if (
    to === REFERRAL_STATUS.RESOLVED &&
    !(input.response || existing.response)?.trim()
  ) {
    throw new Error("برای حل ارجاع، ثبت پاسخ الزامی است.");
  }

  const now = nowIso();
  db.update(referrals)
    .set({
      status: to,
      response:
        input.response !== undefined && input.response !== ""
          ? input.response
          : existing.response,
      assignedTo:
        input.assignedTo !== undefined && input.assignedTo !== ""
          ? input.assignedTo
          : existing.assignedTo,
      resolvedAt:
        to === REFERRAL_STATUS.RESOLVED
          ? now
          : to === REFERRAL_STATUS.OPEN
            ? null
            : existing.resolvedAt,
      updatedAt: now,
    })
    .where(eq(referrals.id, input.id))
    .run();

  const updated = getReferralById(input.id)!;
  recordAudit({
    actorUserId,
    entityType: "referral",
    entityId: input.id,
    action: "status_change",
    before: { status: from, response: existing.response },
    after: { status: to, response: updated.response },
    metadata: { studentId: existing.studentId, subject: existing.subject },
  });
  return updated;
}

export type { Priority };
