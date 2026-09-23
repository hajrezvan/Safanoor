"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/server/auth/guards";
import { ROLE_KEYS, LESSON_CONTENT_TYPE } from "@/lib/enums";
import { assertPermission, assertRole, PERMISSIONS } from "@/server/authz/policy";
import {
  addLesson,
  createChapter,
  createChapterSchema,
  createCourse,
  createCourseSchema,
  createLesson,
  createLessonSchema,
  setPrerequisite,
  setPrerequisiteSchema,
  updateCourse,
  updateCourseSchema,
  upsertLessonContent,
} from "@/server/modules/courses/service";
import { createBook, createBookSchema, createReadingPlan } from "@/server/modules/books/service";
import { saveUpload, UploadError, UPLOAD_FOLDERS } from "@/server/uploads";

export type SimpleState = { error?: string; success?: string; id?: string };

async function requireClassesManager() {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  assertPermission(actor, PERMISSIONS.CLASSES_MANAGE);
  return actor;
}

function fileFrom(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

async function resolveCoverFromForm(formData: FormData): Promise<
  { coverPath: string | null; error?: undefined } | { coverPath?: undefined; error: string }
> {
  try {
    const uploaded = await saveUpload(fileFrom(formData, "cover"), UPLOAD_FOLDERS.COVERS);
    if (uploaded) return { coverPath: uploaded };
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "خطا در آپلود کاور" };
  }
  const urlOrPath = String(formData.get("coverPath") ?? "").trim();
  return { coverPath: urlOrPath || null };
}

function revalidateCoursePaths(courseId?: string) {
  revalidatePath("/staff/school", "layout");
  revalidatePath("/student/school", "layout");
  revalidatePath("/admin/courses");
  revalidatePath("/staff/classes");
  revalidatePath("/student/school");
  if (courseId) {
    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePath(`/staff/classes/${courseId}`);
    revalidatePath(`/student/school/courses/${courseId}`);
  }
}

export async function createCourseAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireClassesManager();

  const cover = await resolveCoverFromForm(formData);
  if (cover.error) return { error: cover.error };

  const parsed = createCourseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    coverPath: cover.coverPath ?? "",
    ordering: formData.get("ordering") || 0,
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) return { error: "اطلاعات دوره معتبر نیست." };
  const course = createCourse(parsed.data);
  const lessonTitle = String(formData.get("firstLessonTitle") ?? "");
  if (lessonTitle) {
    addLesson(
      course.id,
      lessonTitle,
      LESSON_CONTENT_TYPE.TEXT,
      String(formData.get("firstLessonBody") ?? ""),
    );
  }
  revalidateCoursePaths(course.id);
  return { success: "دوره ایجاد شد.", id: course.id };
}

export async function updateCourseAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireClassesManager();

  const cover = await resolveCoverFromForm(formData);
  if (cover.error) return { error: cover.error };

  const parsed = updateCourseSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    coverPath: cover.coverPath ?? "",
    ordering: formData.get("ordering") || 0,
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) return { error: "اطلاعات دوره معتبر نیست." };
  try {
    updateCourse(parsed.data);
  } catch {
    return { error: "دوره یافت نشد." };
  }
  revalidateCoursePaths(parsed.data.id);
  return { success: "دوره به‌روزرسانی شد." };
}

export async function createChapterAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireClassesManager();
  const parsed = createChapterSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    ordering: formData.get("ordering") || undefined,
  });
  if (!parsed.success) return { error: "اطلاعات فصل معتبر نیست." };
  try {
    createChapter(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد فصل" };
  }
  revalidatePath(`/staff/classes/${parsed.data.courseId}`);
  return { success: "فصل ایجاد شد." };
}

export async function setPrerequisiteAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireClassesManager();
  const parsed = setPrerequisiteSchema.safeParse({
    courseId: formData.get("courseId"),
    prerequisiteCourseId: formData.get("prerequisiteCourseId"),
  });
  if (!parsed.success) return { error: "پیش‌نیاز معتبر نیست." };
  try {
    setPrerequisite(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت پیش‌نیاز" };
  }
  revalidatePath(`/staff/classes/${parsed.data.courseId}`);
  return { success: "پیش‌نیاز ثبت شد." };
}

export async function createLessonAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  await requireClassesManager();
  const parsed = createLessonSchema.safeParse({
    courseId: formData.get("courseId"),
    chapterId: formData.get("chapterId") || "",
    title: formData.get("title"),
    ordering: formData.get("ordering") || 0,
    contentType: formData.get("contentType") || LESSON_CONTENT_TYPE.TEXT,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: "اطلاعات درس معتبر نیست." };

  try {
    const lesson = createLesson(parsed.data);
    upsertLessonContent({
      lessonId: lesson.id,
      body: String(formData.get("body") ?? "") || undefined,
      url: String(formData.get("url") ?? "") || undefined,
      filePath: String(formData.get("filePath") ?? "") || undefined,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد درس" };
  }

  revalidatePath(`/staff/classes/${parsed.data.courseId}`);
  revalidatePath("/student/school");
  return { success: "درس ایجاد شد." };
}

export async function createBookAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.COURSES_MANAGE);
  const parsed = createBookSchema.safeParse({
    title: formData.get("title"),
    author: formData.get("author") || undefined,
    description: formData.get("description") || undefined,
    difficulty: formData.get("difficulty") || undefined,
    estimatedMinutes: formData.get("estimatedMinutes") || undefined,
  });
  if (!parsed.success) return { error: "اطلاعات کتاب معتبر نیست." };
  createBook(parsed.data);
  revalidatePath("/admin/books");
  revalidatePath("/staff/library");
  return { success: "کتاب ثبت شد." };
}

export async function assignReadingPlanAction(formData: FormData) {
  await requireRole(ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR, ROLE_KEYS.ASSISTANT_MENTOR);
  createReadingPlan({
    studentId: String(formData.get("studentId") ?? ""),
    bookId: String(formData.get("bookId") ?? ""),
    startDate: String(formData.get("startDate") ?? new Date().toISOString().slice(0, 10)),
    deadline: String(formData.get("deadline") ?? "") || undefined,
    mentorNote: String(formData.get("mentorNote") ?? "") || undefined,
  });
  revalidatePath("/student/books");
  revalidatePath("/student/library");
}

export async function markLessonCompleteAction(formData: FormData): Promise<void> {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) return;
  const { completeLesson } = await import("@/server/modules/school/service");
  completeLesson(user, lessonId);
  revalidatePath("/student/school");
  revalidatePath(`/student/school/lessons/${lessonId}`);
}
