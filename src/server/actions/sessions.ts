"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { canStaffAccessStudent } from "@/server/modules/students/service";
import {
  createActionFromSession,
  createSession,
  createSessionSchema,
  deleteSession,
  updateSession,
  updateSessionSchema,
} from "@/server/modules/sessions/service";

export type SimpleState = { error?: string; success?: string };

function revalidateSessionPaths(studentId: string) {
  revalidatePath("/staff/assistant/sessions");
  revalidatePath("/staff/mentor/sessions");
  revalidatePath("/staff/assistant/follow-ups");
  revalidatePath("/staff/assistant");
  revalidatePath(`/staff/assistant/students/${studentId}`);
  revalidatePath(`/staff/mentor/students/${studentId}`);
}

export async function createSessionAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.SESSIONS_MANAGE);

  const parsed = createSessionSchema.safeParse({
    studentId: formData.get("studentId"),
    staffUserId: user.id,
    date: formData.get("date"),
    type: formData.get("type"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    topics: formData.get("topics") || undefined,
    rawNotes: formData.get("rawNotes") || undefined,
    summary: formData.get("summary") || undefined,
    observations: formData.get("observations") || undefined,
    followUpDate: formData.get("followUpDate") || undefined,
    referralRequired: formData.get("referralRequired") === "on" || formData.get("referralRequired") === "true",
    confidentiality: formData.get("confidentiality") || undefined,
  });

  if (!parsed.success) return { error: "اطلاعات جلسه معتبر نیست." };

  if (
    user.roleKey !== ROLE_KEYS.ADMIN &&
    !canStaffAccessStudent(user.id, user.roleKey, parsed.data.studentId)
  ) {
    return { error: "این دانش‌آموز در محدوده شما نیست." };
  }

  try {
    createSession(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ثبت جلسه ناموفق بود." };
  }

  revalidateSessionPaths(parsed.data.studentId);
  return { success: "جلسه ثبت شد." };
}

export async function updateSessionAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.SESSIONS_MANAGE);

  const parsed = updateSessionSchema.safeParse({
    id: formData.get("id"),
    studentId: formData.get("studentId"),
    date: formData.get("date"),
    type: formData.get("type"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    topics: formData.get("topics") || undefined,
    rawNotes: formData.get("rawNotes") || undefined,
    summary: formData.get("summary") || undefined,
    observations: formData.get("observations") || undefined,
    followUpDate: formData.get("followUpDate") || undefined,
    referralRequired: formData.get("referralRequired") === "on" || formData.get("referralRequired") === "true",
    confidentiality: formData.get("confidentiality") || undefined,
  });

  if (!parsed.success) return { error: "اطلاعات جلسه معتبر نیست." };

  if (
    user.roleKey !== ROLE_KEYS.ADMIN &&
    !canStaffAccessStudent(user.id, user.roleKey, parsed.data.studentId)
  ) {
    return { error: "این دانش‌آموز در محدوده شما نیست." };
  }

  try {
    updateSession(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ویرایش جلسه ناموفق بود." };
  }

  revalidateSessionPaths(parsed.data.studentId);
  return { success: "جلسه به‌روزرسانی شد." };
}

export async function deleteSessionAction(formData: FormData) {
  const user = await requireRole(ROLE_KEYS.MENTOR, ROLE_KEYS.ADMIN, ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(user, PERMISSIONS.SESSIONS_MANAGE);
  const id = String(formData.get("id") ?? "");
  try {
    const studentId = deleteSession(id);
    revalidateSessionPaths(studentId);
  } catch {
    /* ignore */
  }
}

export async function createActionFromSessionAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.SESSIONS_MANAGE);
  assertPermission(user, PERMISSIONS.PLANS_MANAGE);

  const sessionId = String(formData.get("sessionId") ?? "");
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "") || undefined;
  const deadline = String(formData.get("deadline") ?? "") || undefined;

  if (!sessionId || title.trim().length < 3) {
    return { error: "عنوان اقدام حداقل ۳ نویسه است." };
  }

  try {
    const action = createActionFromSession({
      sessionId,
      actorUserId: user.id,
      title,
      description,
      deadline,
    });
    if (!action) return { error: "ایجاد اقدام ناموفق بود." };
    revalidateSessionPaths(action.studentId);
    revalidatePath("/student/actions");
    return { success: "اقدام پیگیری جلسه ایجاد شد." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ایجاد اقدام ناموفق بود." };
  }
}
