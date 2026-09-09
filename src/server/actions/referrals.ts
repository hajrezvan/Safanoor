"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS, type ReferralStatus } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { canStaffAccessStudent } from "@/server/modules/students/service";
import {
  createReferral,
  createReferralSchema,
  updateReferralStatus,
  updateReferralStatusSchema,
} from "@/server/modules/referrals/service";

export type SimpleState = { error?: string; success?: string };

function revalidateReferralPaths(studentId: string) {
  revalidatePath("/staff/assistant/referrals");
  revalidatePath("/staff/mentor/referrals");
  revalidatePath("/staff/assistant/follow-ups");
  revalidatePath("/staff/assistant");
  revalidatePath("/staff/mentor");
  revalidatePath(`/staff/assistant/students/${studentId}`);
  revalidatePath(`/staff/mentor/students/${studentId}`);
}

export async function createReferralAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.REFERRALS_MANAGE);

  const parsed = createReferralSchema.safeParse({
    studentId: formData.get("studentId"),
    createdBy: user.id,
    assignedTo: formData.get("assignedTo") || undefined,
    subject: formData.get("subject"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || undefined,
  });

  if (!parsed.success) return { error: "اطلاعات ارجاع معتبر نیست." };

  if (
    user.roleKey !== ROLE_KEYS.ADMIN &&
    !canStaffAccessStudent(user.id, user.roleKey, parsed.data.studentId)
  ) {
    return { error: "این دانش‌آموز در محدوده شما نیست." };
  }

  try {
    createReferral(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ثبت ارجاع ناموفق بود." };
  }

  revalidateReferralPaths(parsed.data.studentId);
  return { success: "ارجاع ثبت شد." };
}

export async function updateReferralStatusAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.REFERRALS_MANAGE);

  const parsed = updateReferralStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status") as ReferralStatus,
    response: formData.get("response") || undefined,
    assignedTo: formData.get("assignedTo") || undefined,
  });

  if (!parsed.success) return { error: "وضعیت ارجاع معتبر نیست." };

  try {
    const referral = updateReferralStatus(parsed.data, user.id, user.roleKey);
    revalidateReferralPaths(referral.studentId);
    return { success: "وضعیت ارجاع به‌روزرسانی شد." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "به‌روزرسانی ارجاع ناموفق بود." };
  }
}
