"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  createGroup,
  createGroupSchema,
  deleteGroup,
  updateGroup,
  updateGroupSchema,
} from "@/server/modules/groups/service";
import type { ActionState } from "./users";

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);

  const parsed = createGroupSchema.safeParse({
    gradeId: formData.get("gradeId"),
    title: formData.get("title"),
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات گروه معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    createGroup(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد گروه" };
  }

  revalidatePath("/admin/groups");
  return { success: "گروه ایجاد شد." };
}

export async function updateGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);

  const parsed = updateGroupSchema.safeParse({
    id: formData.get("id"),
    gradeId: formData.get("gradeId"),
    title: formData.get("title"),
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات گروه معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    updateGroup(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در به‌روزرسانی گروه" };
  }

  revalidatePath("/admin/groups");
  return { success: "گروه به‌روز شد." };
}

export async function deleteGroupAction(formData: FormData) {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);
  deleteGroup(String(formData.get("id") ?? ""));
  revalidatePath("/admin/groups");
}
