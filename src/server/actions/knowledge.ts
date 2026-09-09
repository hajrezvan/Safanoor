"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  createKnowledgeItem,
  createKnowledgeItemSchema,
  deleteKnowledgeItem,
  seedKnowledgeItems,
  updateKnowledgeItem,
  updateKnowledgeItemSchema,
} from "@/server/modules/knowledge/service";
import type { ActionState } from "./users";

export type { ActionState };

async function requireKnowledgeManager() {
  const user = await requireRole(ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.KNOWLEDGE_MANAGE);
  return user;
}

function revalidateKnowledgePaths() {
  revalidatePath("/admin/knowledge");
  revalidatePath("/staff/mentor/knowledge");
}

export async function createKnowledgeItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireKnowledgeManager();

  const parsed = createKnowledgeItemSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    questionScenario: formData.get("questionScenario"),
    recommendedApproach: formData.get("recommendedApproach"),
    cautions: formData.get("cautions") || "",
    tags: formData.get("tags") || "",
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات آیتم بانک دانش معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    createKnowledgeItem(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت آیتم" };
  }

  revalidateKnowledgePaths();
  return { success: "آیتم بانک دانش ثبت شد." };
}

export async function updateKnowledgeItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireKnowledgeManager();

  const parsed = updateKnowledgeItemSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    category: formData.get("category"),
    questionScenario: formData.get("questionScenario"),
    recommendedApproach: formData.get("recommendedApproach"),
    cautions: formData.get("cautions") || "",
    tags: formData.get("tags") || "",
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات آیتم بانک دانش معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    updateKnowledgeItem(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در به‌روزرسانی آیتم" };
  }

  revalidateKnowledgePaths();
  revalidatePath(`/admin/knowledge/${parsed.data.id}`);
  revalidatePath(`/staff/mentor/knowledge/${parsed.data.id}`);
  return { success: "آیتم بانک دانش به‌روز شد." };
}

export async function deleteKnowledgeItemAction(formData: FormData) {
  await requireKnowledgeManager();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  deleteKnowledgeItem(id);
  revalidateKnowledgePaths();
}

export async function seedKnowledgeItemsAction() {
  await requireKnowledgeManager();
  seedKnowledgeItems();
  revalidateKnowledgePaths();
}
