"use server";

import { revalidatePath } from "next/cache";
import {
  MENTOR_ASSIST_REQUEST,
  type MentorAssistRequestType,
} from "@/ai/context/builder";
import { runMentorAssist } from "@/ai/services/mentor-assist";
import {
  acceptAiAssistOutput,
  acceptSuggestedAction,
  rejectAiSuggestion,
  suggestNextActions,
} from "@/ai/services/next-actions";
import { summarizeSessionWithAi } from "@/ai/services/session-summary";
import { ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { canStaffAccessStudent } from "@/server/modules/students/service";

export type AiActionState = {
  error?: string;
  success?: string;
  interactionId?: string;
  output?: string;
  suggestions?: Array<{ title: string; description?: string }>;
  summaryApplied?: boolean;
};

const requestTypes = new Set<string>(Object.values(MENTOR_ASSIST_REQUEST));

function revalidateAiPaths(studentId: string, sessionId?: string) {
  revalidatePath("/staff/mentor/ai");
  revalidatePath("/staff/mentor/sessions");
  revalidatePath(`/staff/mentor/students/${studentId}`);
  if (sessionId) {
    revalidatePath("/staff/assistant/sessions");
  }
}

async function requireAiUser() {
  const user = await requireRole(ROLE_KEYS.MENTOR, ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.AI_USE);
  return user;
}

function assertStudentScope(
  user: Awaited<ReturnType<typeof requireAiUser>>,
  studentId: string,
): string | null {
  if (!studentId) return "دانش‌آموز را انتخاب کنید.";
  if (user.roleKey !== ROLE_KEYS.ADMIN && !canStaffAccessStudent(user.id, user.roleKey, studentId)) {
    return "این دانش‌آموز در محدوده شما نیست.";
  }
  return null;
}

export async function mentorAssistAction(
  _prev: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await requireAiUser();
  const studentId = String(formData.get("studentId") ?? "");
  const requestType = String(formData.get("requestType") ?? "") as MentorAssistRequestType;
  const includeNotes = formData.get("includeNotes") === "on" || formData.get("includeNotes") === "true";

  const scopeError = assertStudentScope(user, studentId);
  if (scopeError) return { error: scopeError };
  if (!requestTypes.has(requestType)) {
    return { error: "نوع درخواست معتبر نیست." };
  }

  try {
    const result = await runMentorAssist({
      studentId,
      actor: user,
      requestType,
      includeNotes,
    });
    revalidateAiPaths(studentId);
    return {
      success: "پیشنهاد مربی‌یار آماده شد.",
      interactionId: result.interaction.id,
      output: result.output,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "تولید پیشنهاد ناموفق بود." };
  }
}

export async function reviewAiInteractionAction(
  _prev: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await requireAiUser();
  const interactionId = String(formData.get("interactionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!interactionId) return { error: "شناسه تعامل نامعتبر است." };
  if (decision !== "accepted" && decision !== "rejected") {
    return { error: "تصمیم معتبر نیست." };
  }

  try {
    const updated = acceptAiAssistOutput({
      interactionId,
      actor: user,
      decision,
    });
    if (updated.studentId) revalidateAiPaths(updated.studentId);
    return {
      success: decision === "accepted" ? "پیشنهاد پذیرفته شد." : "پیشنهاد رد شد.",
      interactionId: updated.id,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ثبت تصمیم ناموفق بود." };
  }
}

export async function summarizeSessionAiAction(
  _prev: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await requireAiUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const rawNotesOverride = String(formData.get("rawNotes") ?? "") || undefined;
  if (!sessionId) return { error: "جلسه مشخص نشده است." };

  try {
    const result = await summarizeSessionWithAi({
      sessionId,
      actor: user,
      rawNotesOverride,
    });
    revalidateAiPaths(result.session.studentId, sessionId);
    return {
      success: result.summaryApplied
        ? "خلاصه AI ساخته و در فیلد خلاصه ذخیره شد (یادداشت خام دست نخورده ماند)."
        : "خلاصه AI ساخته شد و کنار یادداشت خام نمایش داده می‌شود (خلاصه قبلی حفظ شد).",
      interactionId: result.interaction.id,
      output: result.output,
      summaryApplied: result.summaryApplied,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خلاصه‌سازی ناموفق بود." };
  }
}

export async function suggestNextActionsAiAction(
  _prev: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await requireAiUser();
  const studentId = String(formData.get("studentId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "") || undefined;

  const scopeError = assertStudentScope(user, studentId);
  if (scopeError) return { error: scopeError };

  try {
    const result = await suggestNextActions({
      studentId,
      actor: user,
      sessionId,
    });
    revalidateAiPaths(studentId, sessionId);
    return {
      success: "پیشنهادهای اقدام آماده شد — قبل از ایجاد، بررسی کنید.",
      interactionId: result.interaction.id,
      output: result.text,
      suggestions: result.suggestions,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "پیشنهاد اقدام ناموفق بود." };
  }
}

export async function acceptSuggestedActionAiAction(
  _prev: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await requireAiUser();
  assertPermission(user, PERMISSIONS.PLANS_MANAGE);

  const interactionId = String(formData.get("interactionId") ?? "");
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "") || undefined;
  const deadline = String(formData.get("deadline") ?? "") || undefined;

  if (!interactionId) return { error: "شناسه پیشنهاد نامعتبر است." };

  try {
    const result = acceptSuggestedAction({
      interactionId,
      actor: user,
      title,
      description,
      deadline,
    });
    const studentId = result.action?.studentId ?? result.interaction.studentId;
    if (!studentId) throw new Error("ایجاد اقدام ناموفق بود.");
    revalidateAiPaths(studentId);
    revalidatePath("/student/actions");
    return {
      success: "اقدام پس از تأیید مربی ایجاد شد.",
      interactionId: result.interaction.id,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ایجاد اقدام ناموفق بود." };
  }
}

export async function rejectSuggestedActionAiAction(
  _prev: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await requireAiUser();
  const interactionId = String(formData.get("interactionId") ?? "");
  if (!interactionId) return { error: "شناسه پیشنهاد نامعتبر است." };

  try {
    const updated = rejectAiSuggestion({ interactionId, actor: user });
    if (updated.studentId) revalidateAiPaths(updated.studentId);
    return { success: "پیشنهاد رد شد.", interactionId: updated.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "رد پیشنهاد ناموفق بود." };
  }
}
