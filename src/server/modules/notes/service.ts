import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { mentorNotes, students, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  NOTE_VISIBILITY,
  NOTE_VISIBILITY_TITLES_FA,
  ROLE_KEYS,
  type RoleKey,
} from "@/lib/enums";
import { canStaffAccessStudent } from "@/server/modules/students/service";

export { NOTE_VISIBILITY_TITLES_FA };
const visibilityEnum = z.enum([
  NOTE_VISIBILITY.PRIVATE_STAFF,
  NOTE_VISIBILITY.MENTOR_ONLY,
  NOTE_VISIBILITY.STUDENT_VISIBLE,
]);

const optionalText = z.string().optional().or(z.literal(""));

export const createNoteSchema = z.object({
  authorUserId: z.string().min(1),
  studentId: z.string().min(1, "دانش‌آموز الزامی است."),
  content: z.string().min(1, "متن یادداشت خالی است.").max(8000),
  visibility: visibilityEnum.default(NOTE_VISIBILITY.PRIVATE_STAFF),
  tags: optionalText,
});

export const updateNoteSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1, "متن یادداشت خالی است.").max(8000),
  visibility: visibilityEnum,
  tags: optionalText,
});

export type MentorNoteListItem = {
  id: string;
  authorUserId: string;
  authorName: string | null;
  studentId: string;
  studentName: string | null;
  content: string;
  visibility: string;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * قوانین MVP مشاهده یادداشت:
 * - STUDENT_VISIBLE: دانش‌آموز + همه کارکنان با scope
 * - PRIVATE_STAFF: مربی/کمک‌مربی با scope (نه دانش‌آموز)
 * - MENTOR_ONLY: مربی + مدیر (نه کمک‌مربی، نه دانش‌آموز)
 */
export function canViewerSeeNoteVisibility(
  visibility: string,
  viewerRole: RoleKey,
): boolean {
  if (viewerRole === ROLE_KEYS.ADMIN) return true;

  if (visibility === NOTE_VISIBILITY.STUDENT_VISIBLE) {
    return (
      viewerRole === ROLE_KEYS.STUDENT ||
      viewerRole === ROLE_KEYS.MENTOR ||
      viewerRole === ROLE_KEYS.ASSISTANT_MENTOR
    );
  }

  if (visibility === NOTE_VISIBILITY.PRIVATE_STAFF) {
    return (
      viewerRole === ROLE_KEYS.MENTOR ||
      viewerRole === ROLE_KEYS.ASSISTANT_MENTOR
    );
  }

  if (visibility === NOTE_VISIBILITY.MENTOR_ONLY) {
    return viewerRole === ROLE_KEYS.MENTOR;
  }

  return false;
}

export function assertCanViewNote(
  note: { visibility: string; authorUserId: string; studentId: string },
  viewerUserId: string,
  viewerRole: RoleKey,
) {
  if (viewerRole === ROLE_KEYS.STUDENT) {
    const student = db
      .select()
      .from(students)
      .where(eq(students.id, note.studentId))
      .get();
    if (!student || student.userId !== viewerUserId) {
      throw new Error("دسترسی به این یادداشت مجاز نیست.");
    }
    if (note.visibility !== NOTE_VISIBILITY.STUDENT_VISIBLE) {
      throw new Error("این یادداشت برای دانش‌آموز قابل مشاهده نیست.");
    }
    return;
  }

  if (viewerRole !== ROLE_KEYS.ADMIN) {
    if (!canStaffAccessStudent(viewerUserId, viewerRole, note.studentId)) {
      throw new Error("این دانش‌آموز در محدوده شما نیست.");
    }
  }

  if (!canViewerSeeNoteVisibility(note.visibility, viewerRole)) {
    throw new Error("سطح دسترسی این یادداشت برای نقش شما مجاز نیست.");
  }
}

function noteQuery() {
  return db
    .select({
      id: mentorNotes.id,
      authorUserId: mentorNotes.authorUserId,
      authorName: users.fullName,
      studentId: mentorNotes.studentId,
      studentName: sql<string | null>`(
        select u.full_name from students s
        left join users u on u.id = s.user_id
        where s.id = ${mentorNotes.studentId}
      )`,
      content: mentorNotes.content,
      visibility: mentorNotes.visibility,
      tags: mentorNotes.tags,
      createdAt: mentorNotes.createdAt,
      updatedAt: mentorNotes.updatedAt,
    })
    .from(mentorNotes)
    .leftJoin(users, eq(mentorNotes.authorUserId, users.id));
}

export function createNote(input: z.infer<typeof createNoteSchema>) {
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
  const id = createId("nte");
  db.insert(mentorNotes)
    .values({
      id,
      authorUserId: input.authorUserId,
      studentId: input.studentId,
      content: input.content.trim(),
      visibility: input.visibility,
      tags: input.tags || null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getNoteById(id)!;
}

export function updateNote(
  input: z.infer<typeof updateNoteSchema>,
  actorUserId: string,
) {
  const existing = db
    .select()
    .from(mentorNotes)
    .where(eq(mentorNotes.id, input.id))
    .get();
  if (!existing) throw new Error("یادداشت یافت نشد.");
  if (existing.authorUserId !== actorUserId) {
    throw new Error("فقط نویسنده می‌تواند یادداشت را ویرایش کند.");
  }

  db.update(mentorNotes)
    .set({
      content: input.content.trim(),
      visibility: input.visibility,
      tags: input.tags || null,
      updatedAt: nowIso(),
    })
    .where(eq(mentorNotes.id, input.id))
    .run();

  return getNoteById(input.id)!;
}

export function deleteNote(
  id: string,
  actorUserId: string,
  actorRole: RoleKey,
) {
  const existing = db
    .select()
    .from(mentorNotes)
    .where(eq(mentorNotes.id, id))
    .get();
  if (!existing) throw new Error("یادداشت یافت نشد.");
  if (existing.authorUserId !== actorUserId && actorRole !== ROLE_KEYS.ADMIN) {
    throw new Error("حذف این یادداشت مجاز نیست.");
  }
  db.delete(mentorNotes).where(eq(mentorNotes.id, id)).run();
  return existing.studentId;
}

export function getNoteById(id: string): MentorNoteListItem | undefined {
  return noteQuery().where(eq(mentorNotes.id, id)).get() as
    MentorNoteListItem | undefined;
}

export function listNotesForStudent(
  studentId: string,
  viewerUserId: string,
  viewerRole: RoleKey,
): MentorNoteListItem[] {
  const rows = noteQuery()
    .where(eq(mentorNotes.studentId, studentId))
    .orderBy(desc(mentorNotes.createdAt))
    .all() as MentorNoteListItem[];

  return rows.filter((note) => {
    try {
      assertCanViewNote(note, viewerUserId, viewerRole);
      return true;
    } catch {
      return false;
    }
  });
}

export function listNotesForStaff(
  staffUserId: string,
  staffRole: RoleKey,
  studentIds?: string[],
): MentorNoteListItem[] {
  const conditions = [];
  if (studentIds) {
    conditions.push(
      studentIds.length > 0
        ? inArray(mentorNotes.studentId, studentIds)
        : sql`1 = 0`,
    );
  }

  const rows = noteQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(mentorNotes.createdAt))
    .all() as MentorNoteListItem[];

  return rows.filter((note) => {
    try {
      assertCanViewNote(note, staffUserId, staffRole);
      return true;
    } catch {
      return false;
    }
  });
}
