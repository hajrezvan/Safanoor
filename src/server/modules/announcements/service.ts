import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { announcements, grades, groups, students, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  ANNOUNCEMENT_AUDIENCE,
  ANNOUNCEMENT_STATUS,
} from "@/lib/enums";

const audienceEnum = z.enum([
  ANNOUNCEMENT_AUDIENCE.ALL_STUDENTS,
  ANNOUNCEMENT_AUDIENCE.GRADE,
  ANNOUNCEMENT_AUDIENCE.GROUP,
]);

const statusEnum = z.enum([
  ANNOUNCEMENT_STATUS.DRAFT,
  ANNOUNCEMENT_STATUS.PUBLISHED,
  ANNOUNCEMENT_STATUS.ARCHIVED,
]);

export const createAnnouncementSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(1),
  authorUserId: z.string().min(1),
  audience: audienceEnum.default(ANNOUNCEMENT_AUDIENCE.ALL_STUDENTS),
  gradeId: z.string().optional().or(z.literal("")),
  groupId: z.string().optional().or(z.literal("")),
  status: statusEnum.optional(),
});

export const updateAnnouncementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2),
  body: z.string().min(1),
  audience: audienceEnum,
  gradeId: z.string().optional().or(z.literal("")),
  groupId: z.string().optional().or(z.literal("")),
  status: statusEnum,
});

export type AnnouncementListItem = {
  id: string;
  title: string;
  body: string;
  authorUserId: string;
  authorName: string | null;
  audience: string;
  gradeId: string | null;
  gradeTitleFa: string | null;
  groupId: string | null;
  groupTitle: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function baseQuery() {
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      authorUserId: announcements.authorUserId,
      authorName: users.fullName,
      audience: announcements.audience,
      gradeId: announcements.gradeId,
      gradeTitleFa: grades.titleFa,
      groupId: announcements.groupId,
      groupTitle: groups.title,
      status: announcements.status,
      publishedAt: announcements.publishedAt,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorUserId, users.id))
    .leftJoin(grades, eq(announcements.gradeId, grades.id))
    .leftJoin(groups, eq(announcements.groupId, groups.id));
}

export function listAnnouncements(filters: { status?: string } = {}): AnnouncementListItem[] {
  return baseQuery()
    .where(filters.status ? eq(announcements.status, filters.status) : undefined)
    .orderBy(desc(announcements.createdAt))
    .all() as AnnouncementListItem[];
}

export function getAnnouncementById(id: string): AnnouncementListItem | undefined {
  return baseQuery().where(eq(announcements.id, id)).get() as AnnouncementListItem | undefined;
}

export function createAnnouncement(input: z.infer<typeof createAnnouncementSchema>) {
  const now = nowIso();
  const status = input.status ?? ANNOUNCEMENT_STATUS.DRAFT;
  const id = createId("ann");

  db.insert(announcements)
    .values({
      id,
      title: input.title,
      body: input.body,
      authorUserId: input.authorUserId,
      audience: input.audience,
      gradeId: input.gradeId || null,
      groupId: input.groupId || null,
      status,
      publishedAt: status === ANNOUNCEMENT_STATUS.PUBLISHED ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getAnnouncementById(id)!;
}

export function updateAnnouncement(input: z.infer<typeof updateAnnouncementSchema>) {
  const existing = db.select().from(announcements).where(eq(announcements.id, input.id)).get();
  if (!existing) throw new Error("اطلاعیه یافت نشد.");

  const now = nowIso();
  const publishedAt =
    input.status === ANNOUNCEMENT_STATUS.PUBLISHED
      ? existing.publishedAt ?? now
      : existing.publishedAt;

  db.update(announcements)
    .set({
      title: input.title,
      body: input.body,
      audience: input.audience,
      gradeId: input.gradeId || null,
      groupId: input.groupId || null,
      status: input.status,
      publishedAt,
      updatedAt: now,
    })
    .where(eq(announcements.id, input.id))
    .run();

  return getAnnouncementById(input.id)!;
}

export function publishAnnouncement(id: string) {
  const existing = db.select().from(announcements).where(eq(announcements.id, id)).get();
  if (!existing) throw new Error("اطلاعیه یافت نشد.");
  const now = nowIso();
  db.update(announcements)
    .set({
      status: ANNOUNCEMENT_STATUS.PUBLISHED,
      publishedAt: existing.publishedAt ?? now,
      updatedAt: now,
    })
    .where(eq(announcements.id, id))
    .run();
  return getAnnouncementById(id)!;
}

export function deleteAnnouncement(id: string) {
  db.delete(announcements).where(eq(announcements.id, id)).run();
}

/** اطلاعیه‌های منتشرشده قابل‌مشاهده برای دانش‌آموز بر اساس پایه/گروه */
export function listPublishedForStudent(studentId: string): AnnouncementListItem[] {
  const student = db.select().from(students).where(eq(students.id, studentId)).get();
  if (!student) return [];

  const audienceAll = eq(announcements.audience, ANNOUNCEMENT_AUDIENCE.ALL_STUDENTS);
  const audienceGrade =
    student.gradeId != null
      ? and(
          eq(announcements.audience, ANNOUNCEMENT_AUDIENCE.GRADE),
          eq(announcements.gradeId, student.gradeId),
        )
      : sql`0`;
  const audienceGroup =
    student.groupId != null
      ? and(
          eq(announcements.audience, ANNOUNCEMENT_AUDIENCE.GROUP),
          eq(announcements.groupId, student.groupId),
        )
      : sql`0`;

  return baseQuery()
    .where(
      and(
        eq(announcements.status, ANNOUNCEMENT_STATUS.PUBLISHED),
        or(audienceAll, audienceGrade, audienceGroup),
      ),
    )
    .orderBy(desc(announcements.publishedAt), desc(announcements.createdAt))
    .limit(1)
    .all() as AnnouncementListItem[];
}
