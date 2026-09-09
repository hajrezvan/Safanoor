"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  createPath,
  createPathObjective,
  createPathObjectiveSchema,
  createPathSchema,
  deletePath,
  deletePathObjective,
  setActiveEnrollment,
  updatePath,
  updatePathObjective,
  updatePathObjectiveSchema,
  updatePathSchema,
} from "@/server/modules/paths/service";

export type SimpleState = { error?: string; success?: string };

export async function createPathAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.PATHS_MANAGE);
  const parsed = createPathSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    gradeId: formData.get("gradeId"),
    ordering: formData.get("ordering") || 0,
    status: formData.get("status") || "active",
  });
  if (!parsed.success) return { error: "اطلاعات مسیر معتبر نیست." };
  createPath(parsed.data);
  revalidatePath("/admin/paths");
  return { success: "مسیر ایجاد شد." };
}

export async function updatePathAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.PATHS_MANAGE);
  const parsed = updatePathSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    gradeId: formData.get("gradeId"),
    ordering: formData.get("ordering") || 0,
    status: formData.get("status") || "active",
  });
  if (!parsed.success) return { error: "اطلاعات مسیر معتبر نیست." };
  try {
    updatePath(parsed.data);
  } catch {
    return { error: "مسیر یافت نشد." };
  }
  revalidatePath("/admin/paths");
  revalidatePath(`/admin/paths/${parsed.data.id}`);
  return { success: "مسیر به‌روزرسانی شد." };
}

export async function createObjectiveAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.PATHS_MANAGE);
  const parsed = createPathObjectiveSchema.safeParse({
    pathId: formData.get("pathId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    ordering: formData.get("ordering") || 0,
  });
  if (!parsed.success) return { error: "اطلاعات هدف معتبر نیست." };
  const pathId = parsed.data.pathId;
  createPathObjective(parsed.data);
  revalidatePath(`/admin/paths/${pathId}`);
  return { success: "هدف افزوده شد." };
}

export async function updateObjectiveAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.PATHS_MANAGE);
  const parsed = updatePathObjectiveSchema.safeParse({
    id: formData.get("id"),
    pathId: formData.get("pathId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    ordering: formData.get("ordering") || 0,
  });
  if (!parsed.success) return { error: "اطلاعات هدف معتبر نیست." };
  try {
    updatePathObjective(parsed.data);
  } catch {
    return { error: "هدف یافت نشد." };
  }
  revalidatePath(`/admin/paths/${parsed.data.pathId}`);
  return { success: "هدف به‌روزرسانی شد." };
}

export async function deleteObjectiveAction(formData: FormData) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.PATHS_MANAGE);
  const id = String(formData.get("id") ?? "");
  const pathId = String(formData.get("pathId") ?? "");
  if (!id) return;
  try {
    deletePathObjective(id);
  } catch {
    return;
  }
  revalidatePath(`/admin/paths/${pathId}`);
}

export async function deletePathAction(formData: FormData) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.PATHS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    deletePath(id);
  } catch {
    return;
  }
  revalidatePath("/admin/paths");
}

export async function addObjectiveAction(formData: FormData) {
  await createObjectiveAction({}, formData);
}

export async function enrollStudentPathAction(formData: FormData) {
  await requireRole(ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  const studentId = String(formData.get("studentId") ?? "");
  const pathId = String(formData.get("pathId") ?? "");
  setActiveEnrollment(studentId, pathId);
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/staff/mentor/students/${studentId}`);
}
