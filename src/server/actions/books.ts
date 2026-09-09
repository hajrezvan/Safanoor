"use server";

import { revalidatePath } from "next/cache";
import { requireUser, AuthError } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, assertRole, PERMISSIONS } from "@/server/authz/policy";
import { saveUpload, UploadError, UPLOAD_FOLDERS } from "@/server/uploads";
import {
  canStaffAccessStudent,
  getStudentByUserId,
} from "@/server/modules/students/service";
import {
  createBook,
  createBookChapter,
  createBookChapterSchema,
  createBookSchema,
  createReadingPlan,
  createReadingPlanSchema,
  deleteBook,
  deleteBookChapter,
  deleteReadingPlan,
  getReadingPlanById,
  setReadingProgress,
  updateBook,
  updateBookSchema,
  updateReadingPlan,
  updateReadingPlanSchema,
} from "@/server/modules/books/service";
import type { ActionState } from "./users";

export type { ActionState };

async function requireBooksManager() {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  assertPermission(actor, PERMISSIONS.LIBRARY_MANAGE);
  return actor;
}

/** مدیر برای همه، مربی/کمک‌مربی فقط در محدوده تخصیص فعال خود. */
async function requireStudentAccess(studentId: string) {
  const actor = await requireUser();

  if (actor.roleKey === ROLE_KEYS.ADMIN) {
    assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);
    return actor;
  }

  assertRole(actor, ROLE_KEYS.MENTOR, ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(actor, PERMISSIONS.STUDENTS_VIEW_SCOPED);
  if (!canStaffAccessStudent(actor.id, actor.roleKey, studentId)) {
    throw new AuthError("این دانش‌آموز در محدوده شما نیست.");
  }
  return actor;
}

function fileFrom(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function revalidateStudentViews(studentId: string) {
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/staff/mentor/students/${studentId}`);
  revalidatePath(`/staff/assistant/students/${studentId}`);
  revalidatePath("/student/books");
  revalidatePath("/student/profile");
}

export async function createBookAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireBooksManager();

  let coverPath: string | null = null;
  try {
    coverPath = await saveUpload(fileFrom(formData, "cover"), UPLOAD_FOLDERS.COVERS);
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "خطا در آپلود کاور" };
  }

  const parsed = createBookSchema.safeParse({
    title: formData.get("title"),
    author: formData.get("author") || "",
    description: formData.get("description") || "",
    coverPath: coverPath ?? "",
    difficulty: formData.get("difficulty") || "",
    estimatedMinutes: formData.get("estimatedMinutes") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات کتاب معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    createBook(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت کتاب" };
  }

  revalidatePath("/admin/books");
  return { success: "کتاب ثبت شد." };
}

export async function updateBookAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireBooksManager();

  let coverPath: string | null = null;
  try {
    coverPath = await saveUpload(fileFrom(formData, "cover"), UPLOAD_FOLDERS.COVERS);
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "خطا در آپلود کاور" };
  }

  const parsed = updateBookSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    author: formData.get("author") || "",
    description: formData.get("description") || "",
    coverPath: coverPath ?? "",
    difficulty: formData.get("difficulty") || "",
    estimatedMinutes: formData.get("estimatedMinutes") || undefined,
  });

  if (!parsed.success) {
    return { error: "اطلاعات کتاب معتبر نیست." };
  }

  try {
    updateBook(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در به‌روزرسانی کتاب" };
  }

  revalidatePath("/admin/books");
  revalidatePath("/staff/library");
  revalidatePath("/student/books");
  revalidatePath("/student/library");
  return { success: "کتاب به‌روز شد." };
}

export async function deleteBookAction(formData: FormData) {
  await requireBooksManager();

  deleteBook(String(formData.get("id") ?? ""));
  revalidatePath("/admin/books");
  revalidatePath("/staff/library");
}

export async function createBookChapterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  assertPermission(actor, PERMISSIONS.LIBRARY_MANAGE);

  const parsed = createBookChapterSchema.safeParse({
    bookId: formData.get("bookId"),
    title: formData.get("title"),
    ordering: formData.get("ordering") || undefined,
  });

  if (!parsed.success) return { error: "اطلاعات فصل معتبر نیست." };

  try {
    createBookChapter(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت فصل" };
  }

  revalidatePath(`/staff/library/${parsed.data.bookId}`);
  revalidatePath("/student/library");
  return { success: "فصل ثبت شد." };
}

export async function deleteBookChapterAction(formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  assertPermission(actor, PERMISSIONS.LIBRARY_MANAGE);

  const id = String(formData.get("id") ?? "");
  const bookId = String(formData.get("bookId") ?? "");
  deleteBookChapter(id);
  revalidatePath(`/staff/library/${bookId}`);
  revalidatePath("/student/library");
}

/* ------------------------------ برنامه مطالعاتی ------------------------------ */

export async function createReadingPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createReadingPlanSchema.safeParse({
    studentId: formData.get("studentId"),
    bookId: formData.get("bookId"),
    startDate: formData.get("startDate") || new Date().toISOString().slice(0, 10),
    deadline: formData.get("deadline") || "",
    mentorNote: formData.get("mentorNote") || "",
  });

  if (!parsed.success) {
    return { error: "اطلاعات برنامه مطالعاتی معتبر نیست." };
  }

  await requireStudentAccess(parsed.data.studentId);

  try {
    createReadingPlan(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت برنامه مطالعاتی" };
  }

  revalidateStudentViews(parsed.data.studentId);
  return { success: "برنامه مطالعاتی ثبت شد." };
}

export async function updateReadingPlanAction(formData: FormData) {
  const parsed = updateReadingPlanSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    progress: formData.get("progress") || 0,
    mentorNote: formData.get("mentorNote") || "",
  });

  if (!parsed.success) throw new Error("اطلاعات برنامه مطالعاتی معتبر نیست.");

  const plan = getReadingPlanById(parsed.data.id);
  if (!plan) throw new Error("برنامه مطالعاتی یافت نشد.");

  await requireStudentAccess(plan.studentId);
  updateReadingPlan(parsed.data);
  revalidateStudentViews(plan.studentId);
}

export async function deleteReadingPlanAction(formData: FormData) {
  const plan = getReadingPlanById(String(formData.get("id") ?? ""));
  if (!plan) return;

  await requireStudentAccess(plan.studentId);
  deleteReadingPlan(plan.id);
  revalidateStudentViews(plan.studentId);
}

/** دانش‌آموز فقط پیشرفت برنامه‌های خودش را به‌روز می‌کند. */
export async function updateMyReadingProgressAction(formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.STUDENT);

  const student = getStudentByUserId(actor.id);
  if (!student) throw new AuthError("پرونده دانش‌آموزی یافت نشد.");

  const plan = getReadingPlanById(String(formData.get("id") ?? ""));
  if (!plan || plan.studentId !== student.id) {
    throw new AuthError("این برنامه مطالعاتی برای شما نیست.");
  }

  setReadingProgress(plan.id, Number(formData.get("progress") ?? 0));
  revalidatePath("/student/books");
  revalidatePath("/student/library");
  revalidatePath(`/student/library/${plan.bookId}`);
}
