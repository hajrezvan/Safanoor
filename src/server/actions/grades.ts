"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { createGrade, createGradeSchema, seedGrades } from "@/server/modules/grades/service";
import type { ActionState } from "./users";

export async function seedGradesAction() {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);
  seedGrades();
  revalidatePath("/admin/grades");
}

export async function createGradeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);

  const parsed = createGradeSchema.safeParse({
    key: formData.get("key"),
    titleFa: formData.get("titleFa"),
    ordering: formData.get("ordering"),
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات پایه معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    createGrade(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد پایه" };
  }

  revalidatePath("/admin/grades");
  return { success: "پایه ثبت شد." };
}
