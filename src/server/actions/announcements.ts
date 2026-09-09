"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  createAnnouncement,
  createAnnouncementSchema,
  deleteAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
  updateAnnouncementSchema,
} from "@/server/modules/announcements/service";
import type { ActionState } from "./users";

export type { ActionState };

async function requireAnnouncementManager() {
  const actor = await requireUser();
  if (actor.roleKey !== ROLE_KEYS.ADMIN && actor.roleKey !== ROLE_KEYS.MENTOR) {
    throw new Error("دسترسی مجاز نیست.");
  }
  assertPermission(actor, PERMISSIONS.ANNOUNCEMENTS_MANAGE);
  return actor;
}

export async function createAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAnnouncementManager();

  const parsed = createAnnouncementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    authorUserId: actor.id,
    audience: formData.get("audience") || undefined,
    gradeId: formData.get("gradeId") || "",
    groupId: formData.get("groupId") || "",
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return { error: "اطلاعات اطلاعیه معتبر نیست." };
  }

  try {
    createAnnouncement(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت اطلاعیه" };
  }

  revalidatePath("/staff/announcements");
  revalidatePath("/student");
  return { success: "اطلاعیه ثبت شد." };
}

export async function updateAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAnnouncementManager();

  const parsed = updateAnnouncementSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body"),
    audience: formData.get("audience"),
    gradeId: formData.get("gradeId") || "",
    groupId: formData.get("groupId") || "",
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "اطلاعات اطلاعیه معتبر نیست." };
  }

  try {
    updateAnnouncement(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در به‌روزرسانی" };
  }

  revalidatePath("/staff/announcements");
  revalidatePath("/student");
  return { success: "اطلاعیه به‌روز شد." };
}

export async function publishAnnouncementAction(formData: FormData) {
  await requireAnnouncementManager();
  publishAnnouncement(String(formData.get("id") ?? ""));
  revalidatePath("/staff/announcements");
  revalidatePath("/student");
}

export async function deleteAnnouncementAction(formData: FormData) {
  await requireAnnouncementManager();
  deleteAnnouncement(String(formData.get("id") ?? ""));
  revalidatePath("/staff/announcements");
  revalidatePath("/student");
}
