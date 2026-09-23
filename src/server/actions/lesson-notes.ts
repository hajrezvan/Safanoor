"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import {
  upsertLessonNote,
  upsertLessonNoteSchema,
} from "@/server/modules/lesson-notes/service";
import { getStudentByUserId } from "@/server/modules/students/service";
import type { ActionState } from "./users";

export type { ActionState };

export async function saveLessonNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(actor.id);
  if (!student) throw new AuthError("پرونده دانش‌آموزی یافت نشد.");

  const lessonId = String(formData.get("lessonId") ?? "");
  const parsed = upsertLessonNoteSchema.safeParse({
    studentId: student.id,
    lessonId,
    body: String(formData.get("body") ?? ""),
  });

  if (!parsed.success) {
    return { error: "متن جزوه معتبر نیست." };
  }

  try {
    const { lessonAccess } = await import("@/server/modules/school/service");
    lessonAccess(student.id, lessonId);
    upsertLessonNote(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ذخیره جزوه" };
  }

  revalidatePath(`/student/school/lessons/${lessonId}`);
  return { success: "جزوه ذخیره شد." };
}
