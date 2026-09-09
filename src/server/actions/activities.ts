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
  assignActivitySchema,
  assignActivityToStudent,
  createActivity,
  createActivitySchema,
  deleteActivity,
  getAssignmentById,
  mentorFeedbackSchema,
  provideMentorFeedback,
  submitActivityProgress,
  submitProgressSchema,
  unassignActivity,
  updateActivity,
  updateActivitySchema,
} from "@/server/modules/activities/service";
import type { ActionState } from "./users";

export type { ActionState };

async function requireActivitiesManager() {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.ACTIVITIES_MANAGE);
  return actor;
}

/** مدیر برای همه؛ مربی/کمک‌مربی فقط در محدوده تخصیص فعال. */
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

function revalidateActivityViews(studentId?: string) {
  revalidatePath("/admin/activities");
  revalidatePath("/student/activities");
  revalidatePath("/student/profile");
  if (studentId) {
    revalidatePath(`/admin/students/${studentId}`);
    revalidatePath(`/staff/mentor/students/${studentId}`);
    revalidatePath(`/staff/assistant/students/${studentId}`);
  }
}

export async function createActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireActivitiesManager();

  const parsed = createActivitySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    type: formData.get("type"),
    gradeId: formData.get("gradeId") || "",
    instructions: formData.get("instructions") || "",
    expectedOutput: formData.get("expectedOutput") || "",
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات فعالیت معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    createActivity(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت فعالیت" };
  }

  revalidatePath("/admin/activities");
  return { success: "فعالیت ثبت شد." };
}

export async function updateActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireActivitiesManager();

  const parsed = updateActivitySchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || "",
    type: formData.get("type"),
    gradeId: formData.get("gradeId") || "",
    instructions: formData.get("instructions") || "",
    expectedOutput: formData.get("expectedOutput") || "",
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return { error: "اطلاعات فعالیت معتبر نیست." };
  }

  try {
    updateActivity(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در به‌روزرسانی فعالیت" };
  }

  revalidatePath("/admin/activities");
  revalidatePath("/student/activities");
  return { success: "فعالیت به‌روز شد." };
}

export async function deleteActivityAction(formData: FormData) {
  await requireActivitiesManager();
  deleteActivity(String(formData.get("id") ?? ""));
  revalidatePath("/admin/activities");
}

export async function assignActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = assignActivitySchema.safeParse({
    activityId: formData.get("activityId"),
    studentId: formData.get("studentId"),
    dueDate: formData.get("dueDate") || "",
  });

  if (!parsed.success) {
    return { error: "اطلاعات محول‌سازی معتبر نیست." };
  }

  await requireStudentAccess(parsed.data.studentId);

  try {
    assignActivityToStudent(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در محول‌سازی فعالیت" };
  }

  revalidateActivityViews(parsed.data.studentId);
  return { success: "فعالیت به دانش‌آموز محول شد." };
}

export async function unassignActivityAction(formData: FormData) {
  const assignment = getAssignmentById(String(formData.get("id") ?? ""));
  if (!assignment) throw new Error("محول‌سازی یافت نشد.");

  await requireStudentAccess(assignment.studentId);
  unassignActivity(assignment.id);
  revalidateActivityViews(assignment.studentId);
}

export async function submitActivityProgressAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.STUDENT);

  const student = getStudentByUserId(actor.id);
  if (!student) return { error: "پرونده دانش‌آموزی یافت نشد." };

  let evidenceFilePath: string | null = null;
  try {
    evidenceFilePath = await saveUpload(
      fileFrom(formData, "evidenceFile"),
      UPLOAD_FOLDERS.EVIDENCE,
    );
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "خطا در آپلود شواهد" };
  }

  const parsed = submitProgressSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    reportText: formData.get("reportText"),
    evidenceUrl: formData.get("evidenceUrl") || "",
    evidenceFilePath: evidenceFilePath ?? "",
    markDone: formData.get("markDone") !== "0",
  });

  if (!parsed.success) {
    return {
      error: "گزارش پیشرفت معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const assignment = getAssignmentById(parsed.data.assignmentId);
  if (!assignment || assignment.studentId !== student.id) {
    return { error: "این فعالیت به شما محول نشده است." };
  }

  try {
    submitActivityProgress(parsed.data, actor.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت پیشرفت" };
  }

  revalidateActivityViews(student.id);
  return { success: "پیشرفت ثبت شد." };
}

export async function provideMentorFeedbackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = mentorFeedbackSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    feedback: formData.get("feedback"),
  });

  if (!parsed.success) {
    return { error: "بازخورد معتبر نیست." };
  }

  const assignment = getAssignmentById(parsed.data.assignmentId);
  if (!assignment) return { error: "محول‌سازی یافت نشد." };

  const actor = await requireStudentAccess(assignment.studentId);

  try {
    provideMentorFeedback(parsed.data, actor.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت بازخورد" };
  }

  revalidateActivityViews(assignment.studentId);
  return { success: "بازخورد ثبت شد." };
}
