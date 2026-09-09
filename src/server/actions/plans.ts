"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser, AuthError } from "@/server/auth/guards";
import { ROLE_KEYS, type ActionStatus } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  canStaffAccessStudent,
  getStudentById,
} from "@/server/modules/students/service";
import {
  createAction,
  createActionSchema,
  createGoal,
  createGoalSchema,
  createPlan,
  createPlanSchema,
  getActionById,
  isActionAssignee,
  transitionActionStatus,
  updateActionResult,
} from "@/server/modules/plans/service";

export type SimpleState = { error?: string; success?: string };

function assertCanManageStudentPlans(
  user: Awaited<ReturnType<typeof requireUser>>,
  studentId: string,
) {
  if (user.roleKey === ROLE_KEYS.ADMIN) return;
  assertPermission(user, PERMISSIONS.PLANS_MANAGE);
  if (!canStaffAccessStudent(user.id, user.roleKey, studentId)) {
    throw new AuthError("این دانش‌آموز در محدوده شما نیست.");
  }
}

export async function createGoalAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(ROLE_KEYS.MENTOR, ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.PLANS_MANAGE);
  const parsed = createGoalSchema.safeParse({
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId"),
    priority: formData.get("priority") || "medium",
    startDate: formData.get("startDate"),
    targetDate: formData.get("targetDate") || undefined,
    mentorNote: formData.get("mentorNote") || undefined,
    createdBy: user.id,
  });
  if (!parsed.success) return { error: "اطلاعات هدف معتبر نیست." };
  assertCanManageStudentPlans(user, parsed.data.studentId);
  createGoal(parsed.data);
  revalidatePath(`/staff/mentor/students/${parsed.data.studentId}`);
  return { success: "هدف ثبت شد." };
}

export async function createPlanAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(ROLE_KEYS.MENTOR, ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.PLANS_MANAGE);
  const parsed = createPlanSchema.safeParse({
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    createdBy: user.id,
  });
  if (!parsed.success) return { error: "اطلاعات برنامه معتبر نیست." };
  assertCanManageStudentPlans(user, parsed.data.studentId);
  createPlan(parsed.data);
  revalidatePath(`/staff/mentor/students/${parsed.data.studentId}`);
  return { success: "برنامه ایجاد شد." };
}

export async function createActionAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.PLANS_MANAGE);
  const parsed = createActionSchema.safeParse({
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    type: formData.get("type") || "task",
    planId: formData.get("planId") || undefined,
    goalId: formData.get("goalId") || undefined,
    assigneeUserId: formData.get("assigneeUserId"),
    startDate: formData.get("startDate"),
    deadline: formData.get("deadline") || undefined,
    priority: formData.get("priority") || "medium",
    createdBy: user.id,
  });
  if (!parsed.success) return { error: "اطلاعات اقدام معتبر نیست." };
  assertCanManageStudentPlans(user, parsed.data.studentId);
  createAction(parsed.data);
  revalidatePath(`/staff/mentor/students/${parsed.data.studentId}`);
  revalidatePath("/student/actions");
  return { success: "اقدام ایجاد شد." };
}

export async function transitionActionAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ActionStatus;
  const action = getActionById(id);
  if (!action) return { error: "اقدام یافت نشد." };

  try {
    if (user.roleKey === ROLE_KEYS.STUDENT) {
      if (!isActionAssignee(id, user.id)) {
        throw new AuthError("فقط مسئول اقدام می‌تواند وضعیت را تغییر دهد.");
      }
    } else {
      assertPermission(user, PERMISSIONS.PLANS_MANAGE);
      assertCanManageStudentPlans(user, action.studentId);
    }
    transitionActionStatus(id, status, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "تغییر وضعیت مجاز نیست.";
    return { error: message };
  }
  if (user.roleKey === ROLE_KEYS.STUDENT) revalidatePath("/student/actions");
  revalidatePath("/student/plan");
  revalidatePath("/staff/assistant/follow-ups");
  return {};
}

export async function submitActionResultAction(formData: FormData) {
  const user = await requireRole(
    ROLE_KEYS.STUDENT,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.ADMIN,
  );
  const id = String(formData.get("id") ?? "");
  const result = String(formData.get("result") ?? "");
  const status = String(formData.get("status") ?? "") as ActionStatus | "";
  const action = getActionById(id);
  if (!action) throw new AuthError("اقدام یافت نشد.");

  if (user.roleKey === ROLE_KEYS.STUDENT) {
    if (!isActionAssignee(id, user.id)) {
      throw new AuthError("فقط مسئول اقدام می‌تواند نتیجه را ثبت کند.");
    }
  } else {
    assertPermission(user, PERMISSIONS.PLANS_MANAGE);
    assertCanManageStudentPlans(user, action.studentId);
  }

  updateActionResult(id, result, status || undefined, user.id);
  revalidatePath("/student/actions");
  const student = getStudentById(action.studentId);
  if (student) {
    revalidatePath(`/staff/mentor/students/${student.id}`);
    revalidatePath(`/staff/assistant/students/${student.id}`);
  }
}
