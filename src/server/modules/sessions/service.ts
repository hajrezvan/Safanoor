import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { mentoringSessions, students, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { todayIsoDate } from "@/lib/date";
import {
  ACTION_STATUS,
  ACTION_TYPE,
  PRIORITY,
  SESSION_CONFIDENTIALITY,
  SESSION_CONFIDENTIALITY_TITLES_FA,
  type SessionConfidentiality,
} from "@/lib/enums";
import { createAction } from "@/server/modules/plans/actions";

export { SESSION_CONFIDENTIALITY_TITLES_FA };
export type { SessionConfidentiality };
const confidentialityEnum = z.enum([
  SESSION_CONFIDENTIALITY.NORMAL,
  SESSION_CONFIDENTIALITY.SENSITIVE,
  SESSION_CONFIDENTIALITY.RESTRICTED,
]);

const optionalText = z.string().optional().or(z.literal(""));

export const createSessionSchema = z.object({
  studentId: z.string().min(1, "دانش‌آموز الزامی است."),
  staffUserId: z.string().min(1),
  date: z.string().min(4, "تاریخ جلسه الزامی است."),
  type: z.string().min(1, "نوع جلسه الزامی است.").max(80),
  durationMinutes: z.coerce.number().int().positive().optional().or(z.literal("")),
  topics: optionalText,
  rawNotes: optionalText,
  summary: optionalText,
  observations: optionalText,
  followUpDate: optionalText,
  referralRequired: z.coerce.boolean().optional().default(false),
  confidentiality: confidentialityEnum.default(SESSION_CONFIDENTIALITY.NORMAL),
});

export const updateSessionSchema = createSessionSchema
  .omit({ staffUserId: true })
  .extend({ id: z.string().min(1) });

export type MentoringSessionListItem = {
  id: string;
  studentId: string;
  studentName: string | null;
  staffUserId: string;
  staffName: string | null;
  date: string;
  type: string;
  durationMinutes: number | null;
  topics: string | null;
  rawNotes: string | null;
  summary: string | null;
  observations: string | null;
  followUpDate: string | null;
  referralRequired: boolean;
  confidentiality: string;
  createdAt: string;
};

function sessionQuery() {
  return db
    .select({
      id: mentoringSessions.id,
      studentId: mentoringSessions.studentId,
      studentName: sql<string | null>`(
        select u.full_name from students s
        left join users u on u.id = s.user_id
        where s.id = ${mentoringSessions.studentId}
      )`,
      staffUserId: mentoringSessions.staffUserId,
      staffName: users.fullName,
      date: mentoringSessions.date,
      type: mentoringSessions.type,
      durationMinutes: mentoringSessions.durationMinutes,
      topics: mentoringSessions.topics,
      rawNotes: mentoringSessions.rawNotes,
      summary: mentoringSessions.summary,
      observations: mentoringSessions.observations,
      followUpDate: mentoringSessions.followUpDate,
      referralRequired: mentoringSessions.referralRequired,
      confidentiality: mentoringSessions.confidentiality,
      createdAt: mentoringSessions.createdAt,
    })
    .from(mentoringSessions)
    .leftJoin(users, eq(mentoringSessions.staffUserId, users.id));
}

export type SessionFilters = {
  studentId?: string;
  studentIds?: string[];
  staffUserId?: string;
};

function buildConditions(filters: SessionFilters) {
  const conditions = [];
  if (filters.studentId) conditions.push(eq(mentoringSessions.studentId, filters.studentId));
  if (filters.staffUserId) conditions.push(eq(mentoringSessions.staffUserId, filters.staffUserId));
  if (filters.studentIds) {
    conditions.push(
      filters.studentIds.length > 0
        ? inArray(mentoringSessions.studentId, filters.studentIds)
        : sql`1 = 0`,
    );
  }
  return conditions.length ? and(...conditions) : undefined;
}

export function listSessions(filters: SessionFilters = {}): MentoringSessionListItem[] {
  return sessionQuery()
    .where(buildConditions(filters))
    .orderBy(desc(mentoringSessions.date), desc(mentoringSessions.createdAt))
    .all() as MentoringSessionListItem[];
}

export function getSessionById(id: string): MentoringSessionListItem | undefined {
  return sessionQuery().where(eq(mentoringSessions.id, id)).get() as
    | MentoringSessionListItem
    | undefined;
}

export function createSession(input: z.infer<typeof createSessionSchema>) {
  if (!db.select({ id: students.id }).from(students).where(eq(students.id, input.studentId)).get()) {
    throw new Error("دانش‌آموز یافت نشد.");
  }

  const duration =
    input.durationMinutes === "" || input.durationMinutes === undefined
      ? null
      : Number(input.durationMinutes);

  const id = createId("mss");
  db.insert(mentoringSessions)
    .values({
      id,
      studentId: input.studentId,
      staffUserId: input.staffUserId,
      date: input.date,
      type: input.type.trim(),
      durationMinutes: duration,
      topics: input.topics || null,
      rawNotes: input.rawNotes || null,
      summary: input.summary || null,
      observations: input.observations || null,
      followUpDate: input.followUpDate || null,
      referralRequired: Boolean(input.referralRequired),
      confidentiality: input.confidentiality,
      createdAt: nowIso(),
    })
    .run();

  return getSessionById(id)!;
}

export function updateSession(input: z.infer<typeof updateSessionSchema>) {
  const existing = db.select().from(mentoringSessions).where(eq(mentoringSessions.id, input.id)).get();
  if (!existing) throw new Error("جلسه یافت نشد.");

  const duration =
    input.durationMinutes === "" || input.durationMinutes === undefined
      ? null
      : Number(input.durationMinutes);

  db.update(mentoringSessions)
    .set({
      studentId: input.studentId,
      date: input.date,
      type: input.type.trim(),
      durationMinutes: duration,
      topics: input.topics || null,
      rawNotes: input.rawNotes || null,
      summary: input.summary || null,
      observations: input.observations || null,
      followUpDate: input.followUpDate || null,
      referralRequired: Boolean(input.referralRequired),
      confidentiality: input.confidentiality,
    })
    .where(eq(mentoringSessions.id, input.id))
    .run();

  return getSessionById(input.id)!;
}

export function deleteSession(id: string) {
  const existing = db.select().from(mentoringSessions).where(eq(mentoringSessions.id, id)).get();
  if (!existing) throw new Error("جلسه یافت نشد.");
  db.delete(mentoringSessions).where(eq(mentoringSessions.id, id)).run();
  return existing.studentId;
}

/** ایجاد Action پیگیری پس از جلسه */
export function createActionFromSession(opts: {
  sessionId: string;
  actorUserId: string;
  title: string;
  description?: string;
  deadline?: string;
  assigneeUserId?: string;
}) {
  const session = getSessionById(opts.sessionId);
  if (!session) throw new Error("جلسه یافت نشد.");

  const student = db.select().from(students).where(eq(students.id, session.studentId)).get();
  if (!student?.userId) throw new Error("دانش‌آموز جلسه یافت نشد.");

  const description =
    opts.description ||
    [
      `اقدام پیگیری جلسه «${session.type}» مورخ ${session.date.slice(0, 10)}`,
      session.summary ? `خلاصه: ${session.summary}` : null,
      session.topics ? `موضوعات: ${session.topics}` : null,
    ]
      .filter(Boolean)
      .join("\n");

  return createAction({
    studentId: session.studentId,
    title: opts.title.trim(),
    description,
    type: ACTION_TYPE.MEETING,
    assigneeUserId: opts.assigneeUserId || student.userId,
    startDate: todayIsoDate(),
    deadline: opts.deadline || session.followUpDate || undefined,
    status: ACTION_STATUS.TODO,
    priority: PRIORITY.MEDIUM,
    createdBy: opts.actorUserId,
  });
}
