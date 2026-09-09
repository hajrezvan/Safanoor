"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError, requireRole, requireUser } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, assertRole, PERMISSIONS } from "@/server/authz/policy";
import {
  completeAttempt,
  createExam,
  createExamSchema,
  ensureAttemptQuestionIds,
  isExamPassed,
  optionsFromFormData,
  reviewExamSchema,
  reviewExamSubmission,
  saveAttemptAnswer,
  startOrResumeAttempt,
  submitExamAnswer,
  submitExamSchema,
  syncAttemptExpiry,
} from "@/server/modules/exams/service";
import { getStudentByUserId } from "@/server/modules/students/service";
import type { ActionState } from "./users";

export type { ActionState };

export async function createExamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR, ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(actor, PERMISSIONS.LIBRARY_MANAGE);

  const { options, correctOptionKey } = optionsFromFormData(formData);

  const parsed = createExamSchema.safeParse({
    relatedType: formData.get("relatedType"),
    relatedId: formData.get("relatedId"),
    title: formData.get("title"),
    prompt: formData.get("prompt"),
    options,
    correctOptionKey,
    createdBy: actor.id,
  });

  if (!parsed.success) {
    return { error: "اطلاعات آزمون معتبر نیست. حداقل ۲ گزینه و گزینهٔ صحیح لازم است." };
  }

  try {
    createExam(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ثبت آزمون" };
  }

  revalidatePath("/staff/library");
  revalidatePath("/staff/classes");
  revalidatePath("/student/library");
  return { success: "آزمون ثبت شد." };
}

export async function submitExamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(actor.id);
  if (!student) throw new AuthError("پرونده دانش‌آموزی یافت نشد.");

  const parsed = submitExamSchema.safeParse({
    examId: formData.get("examId"),
    studentId: student.id,
    selectedOption: formData.get("selectedOption"),
  });

  if (!parsed.success) {
    return { error: "گزینه معتبر نیست." };
  }

  try {
    submitExamAnswer(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ارسال پاسخ" };
  }

  const bookId = String(formData.get("bookId") ?? "").trim();
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  revalidatePath("/student/library");
  if (bookId) revalidatePath(`/student/library/${bookId}`);
  if (lessonId) revalidatePath(`/student/school/lessons/${lessonId}`);
  return { success: "پاسخ ارسال شد." };
}

export async function reviewExamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();
  assertRole(actor, ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR, ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(actor, PERMISSIONS.EXAMS_REVIEW);

  const parsed = reviewExamSchema.safeParse({
    submissionId: formData.get("submissionId"),
    score: formData.get("score"),
    feedback: formData.get("feedback") || "",
    reviewedBy: actor.id,
  });

  if (!parsed.success) {
    return { error: "اطلاعات بازبینی معتبر نیست." };
  }

  try {
    reviewExamSubmission(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در بازبینی" };
  }

  revalidatePath("/staff/library");
  return { success: "بازبینی ثبت شد." };
}

function studentExamPaths(bookId: string, examId: string) {
  const base = `/student/library/${bookId}/exams/${examId}`;
  return { prep: base, take: `${base}/take`, result: `${base}/result` };
}

export async function startExamAttemptAction(formData: FormData) {
  const actor = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(actor.id);
  if (!student) throw new AuthError("پرونده دانش‌آموزی یافت نشد.");

  const examId = String(formData.get("examId") ?? "").trim();
  const bookId = String(formData.get("bookId") ?? "").trim();
  if (!examId || !bookId) throw new AuthError("اطلاعات آزمون ناقص است.");

  const attempt = startOrResumeAttempt(examId, student.id);
  const paths = studentExamPaths(bookId, examId);

  revalidatePath(paths.prep);
  revalidatePath(paths.take);
  revalidatePath(`/student/library/${bookId}`);

  if (
    (attempt.status === "completed" || attempt.status === "expired") &&
    isExamPassed(attempt.score)
  ) {
    redirect(paths.result);
  }
  redirect(paths.take);
}

export async function saveExamAnswerAction(formData: FormData) {
  const actor = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(actor.id);
  if (!student) throw new AuthError("پرونده دانش‌آموزی یافت نشد.");

  const examId = String(formData.get("examId") ?? "").trim();
  const bookId = String(formData.get("bookId") ?? "").trim();
  const questionIndex = Number(formData.get("questionIndex") ?? 0);
  const selectedOption = String(formData.get("selectedOption") ?? "").trim();
  const finish = String(formData.get("finish") ?? "") === "1";
  const goToRaw = formData.get("goToIndex");
  const goToIndex =
    goToRaw != null && String(goToRaw).trim() !== "" ? Number(goToRaw) : undefined;

  if (!examId || !bookId) {
    throw new AuthError("اطلاعات آزمون ناقص است.");
  }

  const paths = studentExamPaths(bookId, examId);
  syncAttemptExpiry(examId, student.id);
  ensureAttemptQuestionIds(examId, student.id);

  if (finish) {
    // Best-effort: persist the current answer, then always complete + redirect.
    // Never surface a raw 500 on «پایان آزمون» if scoring/navigation can still proceed.
    if (selectedOption && Number.isFinite(questionIndex) && questionIndex >= 0) {
      try {
        saveAttemptAnswer({
          examId,
          studentId: student.id,
          questionIndex,
          selectedOption,
        });
      } catch {
        // Ignore invalid last answer; attempt still completes below.
      }
    }
    completeAttempt(examId, student.id, "submit");
    revalidatePath(paths.result);
    revalidatePath(`/student/library/${bookId}`);
    redirect(paths.result);
  }

  if (!selectedOption) {
    throw new AuthError("پاسخ معتبر نیست.");
  }

  saveAttemptAnswer({
    examId,
    studentId: student.id,
    questionIndex,
    selectedOption,
    goToIndex: Number.isFinite(goToIndex) ? goToIndex : undefined,
  });

  revalidatePath(paths.take);
  redirect(paths.take);
}

export async function expireExamAttemptAction(formData: FormData) {
  const actor = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(actor.id);
  if (!student) throw new AuthError("پرونده دانش‌آموزی یافت نشد.");

  const examId = String(formData.get("examId") ?? "").trim();
  const bookId = String(formData.get("bookId") ?? "").trim();
  if (!examId || !bookId) throw new AuthError("اطلاعات آزمون ناقص است.");

  const questionIndex = Number(formData.get("questionIndex") ?? NaN);
  const selectedOption = String(formData.get("selectedOption") ?? "").trim();
  syncAttemptExpiry(examId, student.id);
  ensureAttemptQuestionIds(examId, student.id);
  if (selectedOption && Number.isFinite(questionIndex) && questionIndex >= 0) {
    try {
      saveAttemptAnswer({
        examId,
        studentId: student.id,
        questionIndex,
        selectedOption,
      });
    } catch {
      // Best-effort before expiry completion.
    }
  }

  completeAttempt(examId, student.id, "expired");
  const paths = studentExamPaths(bookId, examId);
  revalidatePath(paths.result);
  revalidatePath(`/student/library/${bookId}`);
  redirect(paths.result);
}
