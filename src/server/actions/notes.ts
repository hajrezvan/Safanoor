"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { canStaffAccessStudent } from "@/server/modules/students/service";
import {
  createNote,
  createNoteSchema,
  deleteNote,
  updateNote,
  updateNoteSchema,
} from "@/server/modules/notes/service";

export type SimpleState = { error?: string; success?: string };

function revalidateNotePaths(studentId: string) {
  revalidatePath(`/staff/assistant/students/${studentId}`);
  revalidatePath(`/staff/mentor/students/${studentId}`);
  revalidatePath("/student/profile");
}

export async function createNoteAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.NOTES_MANAGE);

  const parsed = createNoteSchema.safeParse({
    authorUserId: user.id,
    studentId: formData.get("studentId"),
    content: formData.get("content"),
    visibility: formData.get("visibility") || undefined,
    tags: formData.get("tags") || undefined,
  });

  if (!parsed.success) return { error: "اطلاعات یادداشت معتبر نیست." };

  if (
    user.roleKey !== ROLE_KEYS.ADMIN &&
    !canStaffAccessStudent(user.id, user.roleKey, parsed.data.studentId)
  ) {
    return { error: "این دانش‌آموز در محدوده شما نیست." };
  }

  if (
    user.roleKey === ROLE_KEYS.ASSISTANT_MENTOR &&
    parsed.data.visibility === "MENTOR_ONLY"
  ) {
    return { error: "کمک‌مربی نمی‌تواند یادداشت فقط‌مربی ثبت کند." };
  }

  try {
    createNote(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ثبت یادداشت ناموفق بود." };
  }

  revalidateNotePaths(parsed.data.studentId);
  return { success: "یادداشت ثبت شد." };
}

export async function updateNoteAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.NOTES_MANAGE);

  const parsed = updateNoteSchema.safeParse({
    id: formData.get("id"),
    content: formData.get("content"),
    visibility: formData.get("visibility"),
    tags: formData.get("tags") || undefined,
  });

  if (!parsed.success) return { error: "اطلاعات یادداشت معتبر نیست." };

  try {
    const note = updateNote(parsed.data, user.id);
    revalidateNotePaths(note.studentId);
    return { success: "یادداشت به‌روزرسانی شد." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ویرایش یادداشت ناموفق بود." };
  }
}

export async function deleteNoteAction(formData: FormData) {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.NOTES_MANAGE);
  const id = String(formData.get("id") ?? "");
  try {
    const studentId = deleteNote(id, user.id, user.roleKey);
    revalidateNotePaths(studentId);
  } catch {
    /* ignore */
  }
}
