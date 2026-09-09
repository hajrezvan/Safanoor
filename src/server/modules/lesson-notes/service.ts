import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { lessonNotes, lessons } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

export const upsertLessonNoteSchema = z.object({
  studentId: z.string().min(1),
  lessonId: z.string().min(1),
  body: z.string().max(50000),
});

export type LessonNoteView = {
  id: string;
  studentId: string;
  lessonId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export function getLessonNoteForStudent(
  studentId: string,
  lessonId: string,
): LessonNoteView | null {
  const row = db
    .select()
    .from(lessonNotes)
    .where(and(eq(lessonNotes.studentId, studentId), eq(lessonNotes.lessonId, lessonId)))
    .get();
  return row ?? null;
}

export function upsertLessonNote(input: z.infer<typeof upsertLessonNoteSchema>): LessonNoteView {
  const data = upsertLessonNoteSchema.parse(input);
  const lesson = db.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, data.lessonId)).get();
  if (!lesson) throw new Error("درس یافت نشد.");

  const now = nowIso();
  const existing = getLessonNoteForStudent(data.studentId, data.lessonId);

  if (existing) {
    db.update(lessonNotes)
      .set({ body: data.body, updatedAt: now })
      .where(eq(lessonNotes.id, existing.id))
      .run();
    return { ...existing, body: data.body, updatedAt: now };
  }

  const id = createId("lnote");
  const row: LessonNoteView = {
    id,
    studentId: data.studentId,
    lessonId: data.lessonId,
    body: data.body,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(lessonNotes).values(row).run();
  return row;
}
