"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  changePasswordSchema,
  changeUserPassword,
  createUser,
  createUserSchema,
  setUserActive,
  updateUser,
  updateUserSchema,
} from "@/server/modules/users/service";

export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.USERS_MANAGE);

  const parsed = createUserSchema.safeParse({
    username: formData.get("username"),
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    password: formData.get("password"),
    roleKey: formData.get("roleKey"),
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات کاربر معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    await createUser(parsed.data, actor.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد کاربر" };
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.USERS_MANAGE);

  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    roleKey: formData.get("roleKey"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات کاربر معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    updateUser(parsed.data, actor.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در به‌روزرسانی" };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.id}`);
  return { success: "کاربر با موفقیت به‌روز شد." };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.USERS_MANAGE);

  const parsed = changePasswordSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: "رمز عبور معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await changeUserPassword(parsed.data);
  return { success: "رمز عبور تغییر کرد." };
}

export async function toggleUserActiveAction(formData: FormData) {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.USERS_MANAGE);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  setUserActive(id, isActive);
  revalidatePath("/admin/users");
}
