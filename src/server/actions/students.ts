"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireUser, AuthError } from "@/server/auth/guards";
import { ROLE_KEYS, STUDENT_STATUS } from "@/lib/enums";
import {
  assertPermission,
  assertRole,
  PERMISSIONS,
  userHasPermission,
} from "@/server/authz/policy";
import { createUser, createUserSchema } from "@/server/modules/users/service";
import {
  assignStaffSchema,
  canStaffAccessStudent,
  createStudent,
  createStudentSchema,
  getStudentByUserId,
  growthProfileSchema,
  setStaffAssignment,
  setStudentStatus,
  studentSelfProfileSchema,
  updateStudent,
  updateStudentSchema,
  updateStudentSelfProfile,
  upsertGrowthProfile,
} from "@/server/modules/students/service";
import type { ActionState } from "./users";

export type { ActionState };

export async function createStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);

  let userId = String(formData.get("userId") ?? "");

  // حالت «کاربر جدید»: ابتدا حساب دانش‌آموز ساخته می‌شود، سپس پرونده.
  if (formData.get("mode") === "new") {
    const parsedUser = createUserSchema.safeParse({
      username: formData.get("username"),
      fullName: formData.get("fullName"),
      email: formData.get("email") || "",
      password: formData.get("password"),
      roleKey: ROLE_KEYS.STUDENT,
    });

    if (!parsedUser.success) {
      return {
        error: "اطلاعات حساب کاربری معتبر نیست.",
        fieldErrors: parsedUser.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    try {
      const created = await createUser(parsedUser.data, actor.id);
      userId = created?.id ?? "";
    } catch (e) {
      return { error: e instanceof Error ? e.message : "خطا در ایجاد حساب دانش‌آموز" };
    }
  }

  const parsed = createStudentSchema.safeParse({
    userId,
    gradeId: formData.get("gradeId"),
    groupId: formData.get("groupId") || "",
    status: formData.get("status") || undefined,
    mentorUserId: formData.get("mentorUserId") || "",
    assistantUserId: formData.get("assistantUserId") || "",
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات دانش‌آموز معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    createStudent(parsed.data, actor.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد پرونده دانش‌آموز" };
  }

  revalidatePath("/admin/students");
  redirect("/admin/students");
}

export async function updateStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);

  const parsed = updateStudentSchema.safeParse({
    id: formData.get("id"),
    gradeId: formData.get("gradeId"),
    groupId: formData.get("groupId") || "",
    status: formData.get("status"),
    mentorUserId: formData.get("mentorUserId") || "",
    assistantUserId: formData.get("assistantUserId") || "",
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات دانش‌آموز معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    updateStudent(parsed.data, actor.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در به‌روزرسانی دانش‌آموز" };
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${parsed.data.id}`);
  return { success: "اطلاعات دانش‌آموز به‌روز شد." };
}

export async function assignStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);

  const parsed = assignStaffSchema.safeParse({
    studentId: formData.get("studentId"),
    staffUserId: formData.get("staffUserId") || "",
    assignmentRole: formData.get("assignmentRole"),
  });

  if (!parsed.success) {
    return { error: "اطلاعات تخصیص معتبر نیست." };
  }

  try {
    setStaffAssignment(parsed.data, actor.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در تخصیص" };
  }

  revalidatePath(`/admin/students/${parsed.data.studentId}`);
  return { success: "تخصیص ثبت شد." };
}

/**
 * ویرایش پرونده رشد: مدیر برای همه، مربی/کمک‌مربی فقط در محدوده تخصیص فعال خود.
 */
export async function updateGrowthProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();

  const parsed = growthProfileSchema.safeParse({
    studentId: formData.get("studentId"),
    interests: formData.get("interests") || "",
    skills: formData.get("skills") || "",
    academicStatus: formData.get("academicStatus") || "",
    overallNote: formData.get("overallNote") || "",
    birthDate: formData.get("birthDate") || "",
    nationalId: formData.get("nationalId") || "",
    address: formData.get("address") || "",
    phone: formData.get("phone") || "",
    avatarPath: formData.get("avatarPath") || "",
    siblingsJson: formData.get("siblingsJson") || "",
    fatherName: formData.get("fatherName") || "",
    fatherJob: formData.get("fatherJob") || "",
    fatherBirthDate: formData.get("fatherBirthDate") || "",
    motherJob: formData.get("motherJob") || "",
    fatherAlive: formData.get("fatherAlive") || "",
    motherAlive: formData.get("motherAlive") || "",
    parentsLiveTogether: formData.get("parentsLiveTogether") || "",
  });

  if (!parsed.success) {
    return { error: "اطلاعات پرونده رشد معتبر نیست." };
  }

  // ساخت JSON خواهر/برادر از ردیف‌های فرم
  const siblings: Array<{
    relation: "brother" | "sister";
    relative: "older" | "younger";
    ageDiffYears: number;
  }> = [];
  for (let i = 0; i < 6; i++) {
    const relation = String(formData.get(`siblingRelation_${i}`) ?? "");
    const relative = String(formData.get(`siblingRelative_${i}`) ?? "");
    const ageRaw = String(formData.get(`siblingAgeDiff_${i}`) ?? "");
    if (!relation || !relative || !ageRaw) continue;
    const ageDiffYears = Number(ageRaw);
    if (
      (relation === "brother" || relation === "sister") &&
      (relative === "older" || relative === "younger") &&
      Number.isFinite(ageDiffYears)
    ) {
      siblings.push({ relation, relative, ageDiffYears });
    }
  }
  parsed.data.siblingsJson = JSON.stringify(siblings);

  if (actor.roleKey === ROLE_KEYS.ADMIN) {
    assertPermission(actor, PERMISSIONS.STUDENTS_MANAGE);
  } else {
    assertPermission(actor, PERMISSIONS.STUDENTS_VIEW_SCOPED);
    if (!canStaffAccessStudent(actor.id, actor.roleKey, parsed.data.studentId)) {
      throw new AuthError("این دانش‌آموز در محدوده شما نیست.");
    }
  }

  try {
    upsertGrowthProfile(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ذخیره پرونده رشد" };
  }

  revalidatePath(`/admin/students/${parsed.data.studentId}`);
  revalidatePath(`/staff/mentor/students/${parsed.data.studentId}`);
  revalidatePath(`/staff/assistant/students/${parsed.data.studentId}`);
  revalidatePath(`/staff/forces/${parsed.data.studentId}`);
  revalidatePath("/student/profile");
  revalidatePath("/student");
  return { success: "پرونده رشد ذخیره شد." };
}

/**
 * دانش‌آموز فقط اطلاعات فردی خودش را تکمیل می‌کند.
 * فیلدهای والدین حتی اگر در FormData باشند نادیده گرفته می‌شوند.
 */
export async function updateStudentSelfProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.STUDENT);
  const mine = getStudentByUserId(actor.id);
  if (!mine) {
    return { error: "پرونده دانش‌آموزی برای حساب شما یافت نشد." };
  }

  const studentId = String(formData.get("studentId") ?? "");
  if (studentId !== mine.id) {
    throw new AuthError("فقط می‌توانید پرونده خودتان را ویرایش کنید.");
  }

  // فقط کلیدهای موجود در FormData به‌روز می‌شوند تا فرم‌های جزئی
  // (مثلاً فقط خواهر/برادر) بقیه فیلدها را پاک نکنند.
  // والدها / overallNote / academicStatus حتی اگر در FormData باشند خوانده نمی‌شوند.
  const payload: Record<string, unknown> = { studentId: mine.id };
  const personalKeys = [
    "birthDate",
    "nationalId",
    "address",
    "phone",
    "avatarPath",
    "interests",
    "skills",
  ] as const;
  for (const key of personalKeys) {
    if (formData.has(key)) {
      payload[key] = formData.get(key) || "";
    }
  }

  const hasSiblingInputs = Array.from({ length: 6 }, (_, i) =>
    formData.has(`siblingRelation_${i}`),
  ).some(Boolean);
  if (hasSiblingInputs) {
    const siblings: Array<{
      relation: "brother" | "sister";
      relative: "older" | "younger";
      ageDiffYears: number;
    }> = [];
    for (let i = 0; i < 6; i++) {
      const relation = String(formData.get(`siblingRelation_${i}`) ?? "");
      const relative = String(formData.get(`siblingRelative_${i}`) ?? "");
      const ageRaw = String(formData.get(`siblingAgeDiff_${i}`) ?? "");
      if (!relation || !relative || !ageRaw) continue;
      const ageDiffYears = Number(ageRaw);
      if (
        (relation === "brother" || relation === "sister") &&
        (relative === "older" || relative === "younger") &&
        Number.isFinite(ageDiffYears)
      ) {
        siblings.push({ relation, relative, ageDiffYears });
      }
    }
    payload.siblingsJson = JSON.stringify(siblings);
  }

  const parsed = studentSelfProfileSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: "اطلاعات شخصی معتبر نیست." };
  }

  try {
    updateStudentSelfProfile(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ذخیره اطلاعات شخصی" };
  }

  revalidatePath("/student/profile");
  revalidatePath(`/staff/mentor/students/${mine.id}`);
  revalidatePath(`/staff/assistant/students/${mine.id}`);
  revalidatePath(`/staff/forces/${mine.id}`);
  revalidatePath(`/admin/students/${mine.id}`);
  return { success: "اطلاعات شخصی ذخیره شد." };
}

/** ایجاد نیرو (دانش‌آموز) از پنل staff با FORCES_MANAGE یا STUDENTS_MANAGE */
export async function createForceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);

  const canManage =
    userHasPermission(actor, PERMISSIONS.STUDENTS_MANAGE) ||
    userHasPermission(actor, PERMISSIONS.FORCES_MANAGE);
  if (!canManage) {
    throw new AuthError("دسترسی مجاز نیست.");
  }

  let userId = String(formData.get("userId") ?? "");

  if (formData.get("mode") === "new") {
    const parsedUser = createUserSchema.safeParse({
      username: formData.get("username"),
      fullName: formData.get("fullName"),
      email: formData.get("email") || "",
      password: formData.get("password"),
      roleKey: ROLE_KEYS.STUDENT,
    });

    if (!parsedUser.success) {
      return {
        error: "اطلاعات حساب کاربری معتبر نیست.",
        fieldErrors: parsedUser.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    try {
      const created = await createUser(parsedUser.data, actor.id);
      userId = created?.id ?? "";
    } catch (e) {
      return { error: e instanceof Error ? e.message : "خطا در ایجاد حساب" };
    }
  }

  const parsed = createStudentSchema.safeParse({
    userId,
    gradeId: formData.get("gradeId"),
    groupId: formData.get("groupId") || "",
    status: formData.get("status") || undefined,
    mentorUserId: formData.get("mentorUserId") || "",
    assistantUserId: formData.get("assistantUserId") || "",
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات نیرو معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    createStudent(parsed.data, actor.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد نیرو" };
  }

  revalidatePath("/staff/forces");
  revalidatePath("/admin/students");
  redirect("/staff/forces");
}

/** غیرفعال‌سازی نیرو */
export async function deleteForceAction(formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);

  const canManage =
    userHasPermission(actor, PERMISSIONS.STUDENTS_MANAGE) ||
    userHasPermission(actor, PERMISSIONS.FORCES_MANAGE);
  if (!canManage) {
    throw new AuthError("دسترسی مجاز نیست.");
  }

  const id = String(formData.get("id") ?? "");
  setStudentStatus(id, STUDENT_STATUS.INACTIVE);
  revalidatePath("/staff/forces");
  revalidatePath(`/staff/forces/${id}`);
}
