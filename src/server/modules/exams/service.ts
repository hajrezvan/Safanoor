import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  examAttempts,
  examQuestions,
  examSubmissions,
  exams,
  students,
  users,
} from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  EXAM_ALLOW_BACK_DEFAULT,
  EXAM_ATTEMPT_STATUS,
  EXAM_PASS_SCORE,
  EXAM_QUESTIONS_PER_ATTEMPT,
  EXAM_RELATED_TYPE,
  EXAM_SECONDS_PER_QUESTION,
  EXAM_SUBMISSION_STATUS,
} from "@/lib/enums";

const relatedTypeEnum = z.enum([
  EXAM_RELATED_TYPE.BOOK_CHAPTER,
  EXAM_RELATED_TYPE.LESSON,
]);

const submissionStatusEnum = z.enum([
  EXAM_SUBMISSION_STATUS.DRAFT,
  EXAM_SUBMISSION_STATUS.SUBMITTED,
  EXAM_SUBMISSION_STATUS.REVIEWED,
]);

export const examOptionSchema = z.object({
  key: z.string().min(1).max(8),
  text: z.string().min(1),
});

export type ExamOption = z.infer<typeof examOptionSchema>;

export const createExamSchema = z
  .object({
    relatedType: relatedTypeEnum,
    relatedId: z.string().min(1),
    title: z.string().min(2),
    prompt: z.string().min(1),
    options: z.array(examOptionSchema).min(2).max(6),
    correctOptionKey: z.string().min(1),
    createdBy: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    const keys = data.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: "custom",
        message: "کلید گزینه‌ها تکراری است.",
        path: ["options"],
      });
    }
    if (!keys.includes(data.correctOptionKey)) {
      ctx.addIssue({
        code: "custom",
        message: "گزینهٔ صحیح باید یکی از گزینه‌ها باشد.",
        path: ["correctOptionKey"],
      });
    }
  });

export const submitExamSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  selectedOption: z.string().min(1, "یک گزینه را انتخاب کنید."),
});

export const reviewExamSchema = z.object({
  submissionId: z.string().min(1),
  score: z.coerce.number().int().min(0).max(100),
  feedback: z.string().optional().or(z.literal("")),
  reviewedBy: z.string().min(1),
});

export type ExamListItem = {
  id: string;
  relatedType: string;
  relatedId: string;
  title: string;
  prompt: string;
  options: ExamOption[];
  /** فقط برای کارکنان / نمره‌دهی — در UI دانش‌آموز نباید لو برود */
  correctOptionKey: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

/** نسخهٔ امن برای دانش‌آموز بدون کلید پاسخ صحیح */
export type StudentExamItem = Omit<ExamListItem, "correctOptionKey">;

export type ExamSubmissionItem = {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string | null;
  answerText: string;
  selectedOption: string | null;
  status: string;
  score: number | null;
  feedback: string | null;
  reviewedBy: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function parseExamOptions(raw: string | null | undefined): ExamOption[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = z.array(examOptionSchema).safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function mapExamRow(row: typeof exams.$inferSelect): ExamListItem {
  return {
    id: row.id,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    title: row.title,
    prompt: row.prompt,
    options: parseExamOptions(row.optionsJson),
    correctOptionKey: row.correctOptionKey,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toStudentExam(exam: ExamListItem): StudentExamItem {
  const { correctOptionKey, ...rest } = exam;
  void correctOptionKey;
  return rest;
}

export function createExam(
  input: z.infer<typeof createExamSchema>,
): ExamListItem {
  const now = nowIso();
  const id = createId("exm");
  db.insert(exams)
    .values({
      id,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      title: input.title,
      prompt: input.prompt,
      optionsJson: JSON.stringify(input.options),
      correctOptionKey: input.correctOptionKey,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  insertExamQuestion(id, {
    prompt: input.prompt,
    options: input.options,
    correctOptionKey: input.correctOptionKey,
    ordering: 0,
  });
  return getExamById(id)!;
}

export type ExamBankQuestion = {
  id: string;
  examId: string;
  prompt: string;
  options: ExamOption[];
  correctOptionKey: string;
  ordering: number;
};

function mapQuestionRow(
  row: typeof examQuestions.$inferSelect,
): ExamBankQuestion {
  return {
    id: row.id,
    examId: row.examId,
    prompt: row.prompt,
    options: parseExamOptions(row.optionsJson),
    correctOptionKey: row.correctOptionKey,
    ordering: row.ordering,
  };
}

export function insertExamQuestion(
  examId: string,
  input: {
    prompt: string;
    options: ExamOption[];
    correctOptionKey: string;
    ordering?: number;
  },
): ExamBankQuestion {
  const parsed = mcqContentSchema.safeParse({
    prompt: input.prompt,
    options: input.options,
    correctOptionKey: input.correctOptionKey,
  });
  if (!parsed.success) {
    throw new Error("اطلاعات سوال تستی معتبر نیست.");
  }

  const exam = db.select().from(exams).where(eq(exams.id, examId)).get();
  if (!exam) throw new Error("آزمون یافت نشد.");

  const now = nowIso();
  const existingCount = db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .all().length;
  const ordering = input.ordering ?? existingCount;
  const id = createId("eq");
  db.insert(examQuestions)
    .values({
      id,
      examId,
      prompt: parsed.data.prompt,
      optionsJson: JSON.stringify(parsed.data.options),
      correctOptionKey: parsed.data.correctOptionKey,
      ordering,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // keep denormalized summary on exam from first question
  if (existingCount === 0) {
    db.update(exams)
      .set({
        prompt: parsed.data.prompt,
        optionsJson: JSON.stringify(parsed.data.options),
        correctOptionKey: parsed.data.correctOptionKey,
        updatedAt: now,
      })
      .where(eq(exams.id, examId))
      .run();
  }

  return listExamBankQuestions(examId).find((q) => q.id === id)!;
}

/** بانک سوالات آزمون؛ در نبود ردیف بانک، از فیلدهای legacy روی exams برمی‌گردد. */
export function listExamBankQuestions(examId: string): ExamBankQuestion[] {
  const rows = db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.ordering), asc(examQuestions.createdAt))
    .all()
    .map(mapQuestionRow)
    .filter((q) => q.options.length >= 2);

  if (rows.length > 0) return rows;

  const exam = getExamById(examId);
  if (!exam || exam.options.length < 2 || !exam.correctOptionKey) return [];
  return [
    {
      id: `legacy:${exam.id}`,
      examId: exam.id,
      prompt: exam.prompt,
      options: exam.options,
      correctOptionKey: exam.correctOptionKey,
      ordering: 0,
    },
  ];
}

export function ensureExamBankQuestion(
  examId: string,
  input: { prompt: string; options: ExamOption[]; correctOptionKey: string },
): ExamBankQuestion {
  const existing = listExamBankQuestions(examId).find(
    (q) => q.prompt === input.prompt,
  );
  if (existing && !existing.id.startsWith("legacy:")) return existing;
  return insertExamQuestion(examId, input);
}

const mcqContentSchema = z
  .object({
    prompt: z.string().min(1),
    options: z.array(examOptionSchema).min(2).max(6),
    correctOptionKey: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    const keys = data.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: "custom",
        message: "کلید گزینه‌ها تکراری است.",
        path: ["options"],
      });
    }
    if (!keys.includes(data.correctOptionKey)) {
      ctx.addIssue({
        code: "custom",
        message: "گزینهٔ صحیح باید یکی از گزینه‌ها باشد.",
        path: ["correctOptionKey"],
      });
    }
  });

/** به‌روزرسانی محتوای تستی یک آزمون موجود (مثلاً در seed). */
export function updateExamMcq(
  id: string,
  input: {
    title?: string;
    prompt: string;
    options: ExamOption[];
    correctOptionKey: string;
  },
): ExamListItem {
  const existing = db.select().from(exams).where(eq(exams.id, id)).get();
  if (!existing) throw new Error("آزمون یافت نشد.");

  const parsed = mcqContentSchema.safeParse({
    prompt: input.prompt,
    options: input.options,
    correctOptionKey: input.correctOptionKey,
  });
  if (!parsed.success) {
    throw new Error("اطلاعات آزمون تستی معتبر نیست.");
  }

  const now = nowIso();
  db.update(exams)
    .set({
      title: input.title ?? existing.title,
      prompt: parsed.data.prompt,
      optionsJson: JSON.stringify(parsed.data.options),
      correctOptionKey: parsed.data.correctOptionKey,
      updatedAt: now,
    })
    .where(eq(exams.id, id))
    .run();

  const firstBank = db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, id))
    .orderBy(asc(examQuestions.ordering), asc(examQuestions.createdAt))
    .get();
  if (firstBank) {
    db.update(examQuestions)
      .set({
        prompt: parsed.data.prompt,
        optionsJson: JSON.stringify(parsed.data.options),
        correctOptionKey: parsed.data.correctOptionKey,
        updatedAt: now,
      })
      .where(eq(examQuestions.id, firstBank.id))
      .run();
  } else {
    insertExamQuestion(id, {
      prompt: parsed.data.prompt,
      options: parsed.data.options,
      correctOptionKey: parsed.data.correctOptionKey,
      ordering: 0,
    });
  }

  return getExamById(id)!;
}

export function getExamById(id: string): ExamListItem | undefined {
  const row = db.select().from(exams).where(eq(exams.id, id)).get();
  return row ? mapExamRow(row) : undefined;
}

export function listExamsForRelated(
  relatedType: string,
  relatedId: string,
): ExamListItem[] {
  return db
    .select()
    .from(exams)
    .where(
      and(eq(exams.relatedType, relatedType), eq(exams.relatedId, relatedId)),
    )
    .orderBy(desc(exams.createdAt))
    .all()
    .map(mapExamRow);
}

export function listExamsForBookChapters(chapterIds: string[]): ExamListItem[] {
  if (chapterIds.length === 0) return [];
  return db
    .select()
    .from(exams)
    .where(eq(exams.relatedType, EXAM_RELATED_TYPE.BOOK_CHAPTER))
    .orderBy(desc(exams.createdAt))
    .all()
    .map(mapExamRow)
    .filter((e) => chapterIds.includes(e.relatedId));
}

function submissionQuery() {
  return db
    .select({
      id: examSubmissions.id,
      examId: examSubmissions.examId,
      examTitle: exams.title,
      studentId: examSubmissions.studentId,
      studentName: users.fullName,
      answerText: examSubmissions.answerText,
      selectedOption: examSubmissions.selectedOption,
      status: examSubmissions.status,
      score: examSubmissions.score,
      feedback: examSubmissions.feedback,
      reviewedBy: examSubmissions.reviewedBy,
      submittedAt: examSubmissions.submittedAt,
      reviewedAt: examSubmissions.reviewedAt,
      createdAt: examSubmissions.createdAt,
      updatedAt: examSubmissions.updatedAt,
    })
    .from(examSubmissions)
    .innerJoin(exams, eq(examSubmissions.examId, exams.id))
    .innerJoin(students, eq(examSubmissions.studentId, students.id))
    .leftJoin(users, eq(students.userId, users.id));
}

export function getSubmissionById(id: string): ExamSubmissionItem | undefined {
  return submissionQuery().where(eq(examSubmissions.id, id)).get() as
    ExamSubmissionItem | undefined;
}

export function listSubmissionsForExam(examId: string): ExamSubmissionItem[] {
  return submissionQuery()
    .where(eq(examSubmissions.examId, examId))
    .orderBy(desc(examSubmissions.createdAt))
    .all() as ExamSubmissionItem[];
}

export function listSubmissionsForStudent(
  studentId: string,
): ExamSubmissionItem[] {
  return submissionQuery()
    .where(eq(examSubmissions.studentId, studentId))
    .orderBy(desc(examSubmissions.createdAt))
    .all() as ExamSubmissionItem[];
}

export function getStudentSubmission(examId: string, studentId: string) {
  return submissionQuery()
    .where(
      and(
        eq(examSubmissions.examId, examId),
        eq(examSubmissions.studentId, studentId),
      ),
    )
    .get() as ExamSubmissionItem | undefined;
}

function optionLabel(exam: ExamListItem, key: string) {
  const opt = exam.options.find((o) => o.key === key);
  return opt ? `${opt.key}. ${opt.text}` : key;
}

export function submitExamAnswer(
  input: z.infer<typeof submitExamSchema>,
): ExamSubmissionItem {
  const exam = getExamById(input.examId);
  if (!exam) throw new Error("آزمون یافت نشد.");
  if (exam.options.length === 0) {
    throw new Error("این آزمون گزینه‌ای ندارد.");
  }
  if (!exam.options.some((o) => o.key === input.selectedOption)) {
    throw new Error("گزینهٔ انتخاب‌شده معتبر نیست.");
  }

  const student = db
    .select()
    .from(students)
    .where(eq(students.id, input.studentId))
    .get();
  if (!student) throw new Error("دانش‌آموز یافت نشد.");

  const now = nowIso();
  const answerText = optionLabel(exam, input.selectedOption);
  const isCorrect =
    exam.correctOptionKey != null &&
    input.selectedOption === exam.correctOptionKey;
  const autoScore = exam.correctOptionKey ? (isCorrect ? 100 : 0) : null;
  const status =
    autoScore != null
      ? EXAM_SUBMISSION_STATUS.REVIEWED
      : EXAM_SUBMISSION_STATUS.SUBMITTED;

  const existing = db
    .select()
    .from(examSubmissions)
    .where(
      and(
        eq(examSubmissions.examId, input.examId),
        eq(examSubmissions.studentId, input.studentId),
      ),
    )
    .get();

  if (existing) {
    if (
      existing.status === EXAM_SUBMISSION_STATUS.REVIEWED &&
      existing.score != null
    ) {
      throw new Error("پاسخ بازبینی‌شده قابل ویرایش نیست.");
    }
    db.update(examSubmissions)
      .set({
        answerText,
        selectedOption: input.selectedOption,
        status,
        score: autoScore,
        feedback:
          autoScore != null ? (isCorrect ? "پاسخ صحیح" : "پاسخ نادرست") : null,
        reviewedBy: null,
        reviewedAt: autoScore != null ? now : null,
        submittedAt: now,
        updatedAt: now,
      })
      .where(eq(examSubmissions.id, existing.id))
      .run();
    return getSubmissionById(existing.id)!;
  }

  const id = createId("exs");
  db.insert(examSubmissions)
    .values({
      id,
      examId: input.examId,
      studentId: input.studentId,
      answerText,
      selectedOption: input.selectedOption,
      status,
      score: autoScore,
      feedback:
        autoScore != null ? (isCorrect ? "پاسخ صحیح" : "پاسخ نادرست") : null,
      reviewedBy: null,
      submittedAt: now,
      reviewedAt: autoScore != null ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getSubmissionById(id)!;
}

export function reviewExamSubmission(
  input: z.infer<typeof reviewExamSchema>,
): ExamSubmissionItem {
  const existing = db
    .select()
    .from(examSubmissions)
    .where(eq(examSubmissions.id, input.submissionId))
    .get();
  if (!existing) throw new Error("پاسخ یافت نشد.");

  const now = nowIso();
  db.update(examSubmissions)
    .set({
      status: EXAM_SUBMISSION_STATUS.REVIEWED,
      score: input.score,
      feedback: input.feedback || null,
      reviewedBy: input.reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(examSubmissions.id, input.submissionId))
    .run();

  return getSubmissionById(input.submissionId)!;
}

export function deleteExam(id: string) {
  db.delete(exams).where(eq(exams.id, id)).run();
}

/** گزینه‌ها را از فیلدهای فرم staff می‌سازد (optionA…optionD + correctOptionKey). */
export function optionsFromFormData(formData: FormData): {
  options: ExamOption[];
  correctOptionKey: string;
} {
  const keys = ["A", "B", "C", "D"] as const;
  const options: ExamOption[] = [];
  for (const key of keys) {
    const text = String(formData.get(`option${key}`) ?? "").trim();
    if (text) options.push({ key, text });
  }
  const correctOptionKey = String(
    formData.get("correctOptionKey") ?? "",
  ).trim();
  return { options, correctOptionKey };
}

/** برای assert type در تست‌ها */
export { submissionStatusEnum };

/* -------------------------------------------------------------------------- */
/* Timed exam attempts (question bank + pass / retake)                        */
/* -------------------------------------------------------------------------- */

export type ExamQuestionForStudent = {
  index: number;
  questionId: string;
  prompt: string;
  options: ExamOption[];
};

export type ExamAttemptItem = {
  id: string;
  examId: string;
  studentId: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  questionCount: number;
  secondsPerQuestion: number;
  allowBack: boolean;
  currentIndex: number;
  answers: Record<string, string>;
  questionIds: string[];
  seenQuestionIds: string[];
  score: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExamPrepInfo = {
  examId: string;
  title: string;
  bankSize: number;
  questionCount: number;
  durationSeconds: number;
  durationMinutes: number;
  allowBack: boolean;
  secondsPerQuestion: number;
  passScore: number;
};

export type BookExamProgress = {
  passed: number;
  total: number;
  percent: number;
};

function parseAnswersJson(
  raw: string | null | undefined,
): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function parseIdListJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Prefer questions not seen recently; fill from seen pool if needed. */
export function drawQuestionIds(
  bank: ExamBankQuestion[],
  seenIds: string[],
  count: number,
): string[] {
  const take = Math.min(Math.max(0, count), bank.length);
  if (take === 0) return [];
  const seenSet = new Set(seenIds);
  const unseen = shuffleInPlace(bank.filter((q) => !seenSet.has(q.id)));
  const seen = shuffleInPlace(bank.filter((q) => seenSet.has(q.id)));
  return [...unseen, ...seen].slice(0, take).map((q) => q.id);
}

export function isExamPassed(score: number | null | undefined): boolean {
  return score != null && score >= EXAM_PASS_SCORE;
}

export function isAttemptFinished(
  attempt: ExamAttemptItem | undefined | null,
): boolean {
  if (!attempt) return false;
  return (
    attempt.status === EXAM_ATTEMPT_STATUS.COMPLETED ||
    attempt.status === EXAM_ATTEMPT_STATUS.EXPIRED
  );
}

function mapAttemptRow(row: typeof examAttempts.$inferSelect): ExamAttemptItem {
  return {
    id: row.id,
    examId: row.examId,
    studentId: row.studentId,
    status: row.status,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    questionCount: row.questionCount,
    secondsPerQuestion: row.secondsPerQuestion,
    allowBack: Boolean(row.allowBack),
    currentIndex: row.currentIndex,
    answers: parseAnswersJson(row.answersJson),
    questionIds: parseIdListJson(row.questionIdsJson),
    seenQuestionIds: parseIdListJson(row.seenQuestionIdsJson),
    score: row.score,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function questionsForAttempt(
  examId: string,
  questionIds: string[],
): ExamQuestionForStudent[] {
  const bank = listExamBankQuestions(examId);
  const byId = new Map(bank.map((q) => [q.id, q]));
  // Keep array indices aligned with attempt.questionIds / answers keys.
  // Drop only missing bank rows, then re-index contiguously.
  const resolved: ExamQuestionForStudent[] = [];
  for (const id of questionIds) {
    const q = byId.get(id);
    if (!q) continue;
    resolved.push({
      index: resolved.length,
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
    });
  }
  return resolved;
}

/**
 * Legacy / migrated in-progress attempts may have empty questionIds while the
 * UI still showed bank questions. Persist a draw (stable bank order when empty)
 * so save/finish can resolve questionIndex.
 */
export function ensureAttemptQuestionIds(
  examId: string,
  studentId: string,
): ExamAttemptItem | undefined {
  const attempt = getAttempt(examId, studentId);
  if (!attempt) return undefined;
  if (attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS) return attempt;

  const resolved = questionsForAttempt(examId, attempt.questionIds);
  if (resolved.length > 0) {
    if (resolved.length === attempt.questionIds.length) return attempt;
    // Compact to resolvable ids so indices stay contiguous with the take UI.
    const compactIds = resolved.map((q) => q.questionId);
    const remappedAnswers: Record<string, string> = {};
    for (let oldIdx = 0; oldIdx < attempt.questionIds.length; oldIdx += 1) {
      const id = attempt.questionIds[oldIdx]!;
      const newIdx = compactIds.indexOf(id);
      const ans = attempt.answers[String(oldIdx)];
      if (newIdx >= 0 && ans) remappedAnswers[String(newIdx)] = ans;
    }
    const nextIndex = Math.min(
      Math.max(0, attempt.currentIndex),
      compactIds.length - 1,
    );
    db.update(examAttempts)
      .set({
        questionIdsJson: JSON.stringify(compactIds),
        questionCount: compactIds.length,
        currentIndex: nextIndex,
        answersJson: JSON.stringify(remappedAnswers),
        updatedAt: nowIso(),
      })
      .where(eq(examAttempts.id, attempt.id))
      .run();
    return getAttempt(examId, studentId)!;
  }

  const prep = getExamPrepInfo(examId);
  if (!prep) return attempt;
  const bank = listExamBankQuestions(examId);
  // Stable order matches older getExamQuestionsForStudent take UI.
  const questionIds = bank.slice(0, prep.questionCount).map((q) => q.id);
  if (questionIds.length === 0) return attempt;

  const nextIndex = Math.min(
    Math.max(0, attempt.currentIndex),
    questionIds.length - 1,
  );
  db.update(examAttempts)
    .set({
      questionIdsJson: JSON.stringify(questionIds),
      questionCount: questionIds.length,
      currentIndex: nextIndex,
      updatedAt: nowIso(),
    })
    .where(eq(examAttempts.id, attempt.id))
    .run();

  return getAttempt(examId, studentId)!;
}

/** @deprecated Prefer questionsForAttempt with attempt.questionIds */
export function getExamQuestionsForStudent(
  exam: ExamListItem,
): ExamQuestionForStudent[] {
  const bank = listExamBankQuestions(exam.id);
  const ids = bank
    .slice(0, Math.min(EXAM_QUESTIONS_PER_ATTEMPT, bank.length))
    .map((q) => q.id);
  return questionsForAttempt(exam.id, ids);
}

export function getExamPrepInfo(examId: string): ExamPrepInfo | null {
  const exam = getExamById(examId);
  if (!exam) return null;
  const bank = listExamBankQuestions(examId);
  if (bank.length === 0) return null;
  const questionCount = Math.min(EXAM_QUESTIONS_PER_ATTEMPT, bank.length);
  const secondsPerQuestion = EXAM_SECONDS_PER_QUESTION;
  const durationSeconds = questionCount * secondsPerQuestion;
  return {
    examId: exam.id,
    title: exam.title,
    bankSize: bank.length,
    questionCount,
    durationSeconds,
    durationMinutes: Math.ceil(durationSeconds / 60),
    allowBack: EXAM_ALLOW_BACK_DEFAULT,
    secondsPerQuestion,
    passScore: EXAM_PASS_SCORE,
  };
}

export function getAttempt(
  examId: string,
  studentId: string,
): ExamAttemptItem | undefined {
  const row = db
    .select()
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.examId, examId),
        eq(examAttempts.studentId, studentId),
      ),
    )
    .get();
  return row ? mapAttemptRow(row) : undefined;
}

export function remainingMs(
  attempt: ExamAttemptItem,
  now = Date.now(),
): number {
  return Math.max(0, new Date(attempt.expiresAt).getTime() - now);
}

function scoreAttemptAnswers(
  examId: string,
  questionIds: string[],
  answers: Record<string, string>,
): number {
  if (questionIds.length === 0) return 0;
  const bank = listExamBankQuestions(examId);
  const byId = new Map(bank.map((q) => [q.id, q]));
  let correct = 0;
  for (let i = 0; i < questionIds.length; i += 1) {
    const q = byId.get(questionIds[i]!);
    const selected = answers[String(i)];
    if (q && selected && selected === q.correctOptionKey) correct += 1;
  }
  return Math.round((correct / questionIds.length) * 100);
}

function syncSubmissionFromAttempt(
  exam: ExamListItem,
  studentId: string,
  answers: Record<string, string>,
  score: number,
  questionIds: string[],
) {
  const answered = questionIds
    .map((_, i) => answers[String(i)])
    .filter((v): v is string => Boolean(v));
  const selected = answered[0] ?? null;
  const answerText =
    answered.length > 0
      ? `پاسخ به ${answered.length} از ${questionIds.length} سوال`
      : "بدون پاسخ";
  const now = nowIso();
  const existing = db
    .select()
    .from(examSubmissions)
    .where(
      and(
        eq(examSubmissions.examId, exam.id),
        eq(examSubmissions.studentId, studentId),
      ),
    )
    .get();

  if (existing) {
    db.update(examSubmissions)
      .set({
        answerText,
        selectedOption: selected,
        status: EXAM_SUBMISSION_STATUS.REVIEWED,
        score,
        feedback: isExamPassed(score) ? "قبول" : "مردود — امکان شرکت مجدد",
        reviewedBy: null,
        submittedAt: now,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(examSubmissions.id, existing.id))
      .run();
    return;
  }

  db.insert(examSubmissions)
    .values({
      id: createId("exs"),
      examId: exam.id,
      studentId,
      answerText,
      selectedOption: selected,
      status: EXAM_SUBMISSION_STATUS.REVIEWED,
      score,
      feedback: isExamPassed(score) ? "قبول" : "مردود — امکان شرکت مجدد",
      reviewedBy: null,
      submittedAt: now,
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function completeAttempt(
  examId: string,
  studentId: string,
  reason: "submit" | "expired" = "submit",
): ExamAttemptItem {
  const exam = getExamById(examId);
  if (!exam) throw new Error("آزمون یافت نشد.");
  const row = db
    .select()
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.examId, examId),
        eq(examAttempts.studentId, studentId),
      ),
    )
    .get();
  if (!row) throw new Error("تلاشی برای این آزمون یافت نشد.");

  if (
    row.status === EXAM_ATTEMPT_STATUS.COMPLETED ||
    row.status === EXAM_ATTEMPT_STATUS.EXPIRED
  ) {
    return mapAttemptRow(row);
  }

  const answers = parseAnswersJson(row.answersJson);
  const questionIds = parseIdListJson(row.questionIdsJson);
  const score = scoreAttemptAnswers(examId, questionIds, answers);
  const now = nowIso();
  const status =
    reason === "expired"
      ? EXAM_ATTEMPT_STATUS.EXPIRED
      : EXAM_ATTEMPT_STATUS.COMPLETED;
  const seen = Array.from(
    new Set([...parseIdListJson(row.seenQuestionIdsJson), ...questionIds]),
  );

  db.update(examAttempts)
    .set({
      status,
      score,
      seenQuestionIdsJson: JSON.stringify(seen),
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(examAttempts.id, row.id))
    .run();

  syncSubmissionFromAttempt(exam, studentId, answers, score, questionIds);
  return getAttempt(examId, studentId)!;
}

/** If in progress and time is up, auto-complete as expired. */
export function syncAttemptExpiry(
  examId: string,
  studentId: string,
): ExamAttemptItem | undefined {
  const attempt = getAttempt(examId, studentId);
  if (!attempt) return undefined;
  if (attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS) return attempt;
  if (remainingMs(attempt) > 0) return attempt;
  return completeAttempt(examId, studentId, "expired");
}

function beginAttemptRow(input: {
  examId: string;
  studentId: string;
  existingId?: string;
  seenQuestionIds: string[];
  prep: ExamPrepInfo;
}): ExamAttemptItem {
  const bank = listExamBankQuestions(input.examId);
  const questionIds = drawQuestionIds(
    bank,
    input.seenQuestionIds,
    input.prep.questionCount,
  );
  if (questionIds.length === 0)
    throw new Error("بانک سوالات این آزمون خالی است.");

  const now = Date.now();
  const startedAt = new Date(now).toISOString();
  const durationSeconds = questionIds.length * input.prep.secondsPerQuestion;
  const expiresAt = new Date(now + durationSeconds * 1000).toISOString();
  const nowIsoStr = nowIso();

  if (input.existingId) {
    db.update(examAttempts)
      .set({
        status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
        startedAt,
        expiresAt,
        questionCount: questionIds.length,
        secondsPerQuestion: input.prep.secondsPerQuestion,
        allowBack: input.prep.allowBack,
        currentIndex: 0,
        answersJson: "{}",
        questionIdsJson: JSON.stringify(questionIds),
        seenQuestionIdsJson: JSON.stringify(input.seenQuestionIds),
        score: null,
        completedAt: null,
        updatedAt: nowIsoStr,
      })
      .where(eq(examAttempts.id, input.existingId))
      .run();
    return getAttempt(input.examId, input.studentId)!;
  }

  const id = createId("exa");
  db.insert(examAttempts)
    .values({
      id,
      examId: input.examId,
      studentId: input.studentId,
      status: EXAM_ATTEMPT_STATUS.IN_PROGRESS,
      startedAt,
      expiresAt,
      questionCount: questionIds.length,
      secondsPerQuestion: input.prep.secondsPerQuestion,
      allowBack: input.prep.allowBack,
      currentIndex: 0,
      answersJson: "{}",
      questionIdsJson: JSON.stringify(questionIds),
      seenQuestionIdsJson: JSON.stringify(input.seenQuestionIds),
      score: null,
      completedAt: null,
      createdAt: nowIsoStr,
      updatedAt: nowIsoStr,
    })
    .run();

  return getAttempt(input.examId, input.studentId)!;
}

/**
 * Start a new timed attempt, or resume an in-progress one with time left.
 * Passed attempts cannot be restarted. Failed / expired attempts may retake
 * with a fresh random draw (preferring unused bank questions).
 */
export function startOrResumeAttempt(
  examId: string,
  studentId: string,
): ExamAttemptItem {
  const prep = getExamPrepInfo(examId);
  if (!prep) throw new Error("آزمون یافت نشد.");

  const student = db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
    .get();
  if (!student) throw new Error("دانش‌آموز یافت نشد.");

  const existing = syncAttemptExpiry(examId, studentId);
  if (existing) {
    if (
      existing.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
      remainingMs(existing) > 0
    ) {
      if (existing.questionIds.length > 0) return existing;
      // legacy in-progress attempt without drawn bank → redraw
      return beginAttemptRow({
        examId,
        studentId,
        existingId: existing.id,
        seenQuestionIds: existing.seenQuestionIds,
        prep,
      });
    }
    if (isAttemptFinished(existing) && isExamPassed(existing.score)) {
      return existing;
    }
    // failed or expired without pass → retake
    if (isAttemptFinished(existing) && !isExamPassed(existing.score)) {
      const seen = Array.from(
        new Set([...existing.seenQuestionIds, ...existing.questionIds]),
      );
      return beginAttemptRow({
        examId,
        studentId,
        existingId: existing.id,
        seenQuestionIds: seen,
        prep,
      });
    }
  }

  return beginAttemptRow({
    examId,
    studentId,
    existingId: existing?.id,
    seenQuestionIds: existing?.seenQuestionIds ?? [],
    prep,
  });
}

export function saveAttemptAnswer(input: {
  examId: string;
  studentId: string;
  questionIndex: number;
  selectedOption: string;
  goToIndex?: number;
}): ExamAttemptItem {
  let attempt = syncAttemptExpiry(input.examId, input.studentId);
  if (!attempt) throw new Error("تلاشی برای این آزمون یافت نشد.");
  if (attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS) {
    throw new Error("آزمون به پایان رسیده است.");
  }
  if (remainingMs(attempt) <= 0) {
    return completeAttempt(input.examId, input.studentId, "expired");
  }

  attempt = ensureAttemptQuestionIds(input.examId, input.studentId) ?? attempt;
  const questions = questionsForAttempt(input.examId, attempt.questionIds);
  if (
    !Number.isFinite(input.questionIndex) ||
    input.questionIndex < 0 ||
    input.questionIndex >= questions.length
  ) {
    throw new Error("شماره سوال نامعتبر است.");
  }
  const q = questions[input.questionIndex];
  if (!q) throw new Error("شماره سوال نامعتبر است.");
  if (!q.options.some((o) => o.key === input.selectedOption)) {
    throw new Error("گزینهٔ انتخاب‌شده معتبر نیست.");
  }

  const answers = {
    ...attempt.answers,
    [String(input.questionIndex)]: input.selectedOption,
  };
  let nextIndex = attempt.currentIndex;
  if (typeof input.goToIndex === "number") {
    if (!attempt.allowBack && input.goToIndex < attempt.currentIndex) {
      throw new Error("بازگشت به سوال قبل در این آزمون مجاز نیست.");
    }
    if (input.goToIndex < 0 || input.goToIndex >= questions.length) {
      throw new Error("شماره سوال نامعتبر است.");
    }
    nextIndex = input.goToIndex;
  }

  const now = nowIso();
  db.update(examAttempts)
    .set({
      answersJson: JSON.stringify(answers),
      currentIndex: nextIndex,
      updatedAt: now,
    })
    .where(eq(examAttempts.id, attempt.id))
    .run();

  return getAttempt(input.examId, input.studentId)!;
}

/** پیشرفت مطالعه کتاب = آزمون‌های قبول‌شده / کل آزمون‌های فصل‌های کتاب */
export function getBookExamProgress(
  chapterIds: string[],
  studentId: string,
): BookExamProgress {
  const bookExams = listExamsForBookChapters(chapterIds).filter(
    (e) => listExamBankQuestions(e.id).length > 0,
  );
  const total = bookExams.length;
  if (total === 0) return { passed: 0, total: 0, percent: 0 };

  let passed = 0;
  for (const exam of bookExams) {
    const attempt =
      syncAttemptExpiry(exam.id, studentId) ?? getAttempt(exam.id, studentId);
    if (isAttemptFinished(attempt) && isExamPassed(attempt?.score)) passed += 1;
  }
  return {
    passed,
    total,
    percent: Math.round((passed / total) * 100),
  };
}
