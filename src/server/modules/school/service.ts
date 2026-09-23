import { randomInt, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import type { AuthUser } from "@/server/auth/session";
import {
  assertPermission,
  assertRole,
  PERMISSIONS,
} from "@/server/authz/policy";
import {
  canStaffAccessStudent,
  getStudentByUserId,
  listStudentsForStaff,
} from "@/server/modules/students/service";
import {
  isLessonCompletedByStudent,
  listPrerequisites,
  markLessonCompleted,
} from "@/server/modules/courses/service";

export const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (v) => !v || /^\/(?!\/)/.test(v) || /^https?:\/\/[^\s]+$/i.test(v),
    "آدرس باید داخلی یا HTTP/HTTPS باشد.",
  );
const title = z.string().trim().min(2).max(255);
const id = z.string().min(1);
export function manager(actor: AuthUser) {
  assertRole(actor, "admin", "mentor");
  assertPermission(actor, PERMISSIONS.CLASSES_MANAGE);
}
export function studentFor(actor: AuthUser) {
  assertRole(actor, "student");
  const student = getStudentByUserId(actor.id);
  if (!student || student.status !== "active")
    throw new Error("پرونده متربی فعال نیست.");
  return student;
}
export function assertStudentScope(actor: AuthUser, studentId: string) {
  if (actor.roleKey === "student") {
    if (studentFor(actor).id !== studentId)
      throw new Error("دسترسی مجاز نیست.");
  } else {
    manager(actor);
    if (!canStaffAccessStudent(actor.id, actor.roleKey, studentId))
      throw new Error("متربی در حوزه شما نیست.");
  }
}
export function enrollment(studentId: string, courseId: string) {
  return db
    .select()
    .from(s.schoolEnrollments)
    .where(
      and(
        eq(s.schoolEnrollments.studentId, studentId),
        eq(s.schoolEnrollments.courseId, courseId),
      ),
    )
    .get();
}
export function publishedLessons(courseId: string) {
  const chapters = db
    .select()
    .from(s.courseChapters)
    .where(eq(s.courseChapters.courseId, courseId))
    .all();
  return db
    .select()
    .from(s.lessons)
    .where(
      and(eq(s.lessons.courseId, courseId), eq(s.lessons.status, "published")),
    )
    .all()
    .filter(
      (l) =>
        !l.chapterId ||
        chapters.some((c) => c.id === l.chapterId && c.status === "published"),
    )
    .sort(
      (a, b) =>
        (chapters.find((c) => c.id === a.chapterId)?.ordering ?? 9999) -
          (chapters.find((c) => c.id === b.chapterId)?.ordering ?? 9999) ||
        a.ordering - b.ordering,
    );
}
export function courseAccess(
  studentId: string,
  courseId: string,
  requireEnrollment = false,
) {
  const course = db
    .select()
    .from(s.courses)
    .where(eq(s.courses.id, courseId))
    .get();
  const joined = enrollment(studentId, courseId);
  if (
    !course ||
    course.status !== "published" ||
    (!course.isPublic && (!joined || joined.status === "cancelled"))
  )
    throw new Error("دوره در دسترس نیست.");
  if (
    requireEnrollment &&
    !course.isStandaloneCollection &&
    (!joined || joined.status === "cancelled")
  )
    throw new Error("ابتدا در دوره ثبت‌نام کنید.");
  return course;
}
export function lessonAccess(studentId: string, lessonId: string) {
  const lesson = db
    .select()
    .from(s.lessons)
    .where(eq(s.lessons.id, lessonId))
    .get();
  if (
    !lesson ||
    !publishedLessons(lesson.courseId).some((l) => l.id === lessonId)
  )
    throw new Error("درس در دسترس نیست.");
  courseAccess(studentId, lesson.courseId, !lesson.isPreview);
  return lesson;
}
export function courseProgress(studentId: string, courseId: string) {
  const lessons = publishedLessons(courseId);
  const completed = lessons.filter((l) =>
    isLessonCompletedByStudent(studentId, l.id),
  ).length;
  return {
    total: lessons.length,
    completed,
    percent: lessons.length
      ? Math.round((completed * 100) / lessons.length)
      : 0,
  };
}
export function enroll(
  actor: AuthUser,
  courseId: string,
  selectedStudentId?: string,
) {
  const studentId =
    actor.roleKey === "student"
      ? studentFor(actor).id
      : id.parse(selectedStudentId);
  assertStudentScope(actor, studentId);
  const course =
    actor.roleKey === "student"
      ? courseAccess(studentId, courseId)
      : db.select().from(s.courses).where(eq(s.courses.id, courseId)).get();
  if (
    !course ||
    course.status !== "published" ||
    course.isGroup ||
    course.isStandaloneCollection
  )
    throw new Error("دوره برای ثبت‌نام فعال نیست.");
  for (const p of listPrerequisites(courseId)) {
    if (enrollment(studentId, p.prerequisiteCourseId)?.status !== "completed")
      throw new Error(`ابتدا دوره ${p.title} را تکمیل کنید.`);
  }
  const previous = enrollment(studentId, courseId);
  if (previous) {
    if (previous.status === "cancelled")
      db.update(s.schoolEnrollments)
        .set({ status: "active" })
        .where(eq(s.schoolEnrollments.id, previous.id))
        .run();
    return previous.id;
  }
  const enrollmentId = createId("sen");
  db.insert(s.schoolEnrollments)
    .values({ id: enrollmentId, courseId, studentId, createdAt: nowIso() })
    .run();
  return enrollmentId;
}
export function refreshCompletion(studentId: string, courseId: string) {
  const joined = enrollment(studentId, courseId);
  if (!joined || joined.status === "cancelled") return;
  const course = db
    .select()
    .from(s.courses)
    .where(eq(s.courses.id, courseId))
    .get()!;
  const progress = courseProgress(studentId, courseId);
  const exams = db
    .select()
    .from(s.schoolExams)
    .where(
      and(
        eq(s.schoolExams.courseId, courseId),
        eq(s.schoolExams.status, "published"),
      ),
    )
    .all();
  const attempts = db
    .select()
    .from(s.schoolAttempts)
    .where(eq(s.schoolAttempts.studentId, studentId))
    .all();
  const completed =
    course.status === "published" &&
    progress.total > 0 &&
    progress.completed === progress.total &&
    exams.every((e) =>
      attempts.some(
        (a) =>
          a.examId === e.id &&
          a.status === "graded" &&
          (a.score ?? 0) >= e.passingPercent,
      ),
    );
  db.update(s.schoolEnrollments)
    .set({ status: completed ? "completed" : "active" })
    .where(eq(s.schoolEnrollments.id, joined.id))
    .run();
  if (completed && course.issueCertificate) {
    const student = db
      .select()
      .from(s.students)
      .where(eq(s.students.id, studentId))
      .get()!;
    const user = student.userId
      ? db.select().from(s.users).where(eq(s.users.id, student.userId)).get()
      : null;
    db.insert(s.schoolCertificates)
      .values({
        id: createId("cert"),
        enrollmentId: joined.id,
        number: randomUUID(),
        studentName: user?.fullName ?? "متربی",
        courseTitle: course.title,
        issuedAt: nowIso(),
      })
      .onConflictDoNothing()
      .run();
  }
}
export function completeLesson(actor: AuthUser, lessonId: string) {
  const student = studentFor(actor);
  const lesson = lessonAccess(student.id, lessonId);
  courseAccess(student.id, lesson.courseId, true);
  markLessonCompleted(student.id, lessonId, actor.id);
  refreshCompletion(student.id, lesson.courseId);
}
export function catalog(studentId: string) {
  return db
    .select()
    .from(s.courses)
    .where(eq(s.courses.status, "published"))
    .orderBy(asc(s.courses.ordering))
    .all()
    .filter((c) => !c.isStandaloneCollection)
    .filter(
      (c) =>
        c.isPublic ||
        (enrollment(studentId, c.id) &&
          enrollment(studentId, c.id)?.status !== "cancelled"),
    )
    .map((c) => ({
      ...c,
      enrollment: enrollment(studentId, c.id),
      progress: courseProgress(studentId, c.id),
    }));
}
export function myEnrollments(actor: AuthUser) {
  const studentId = studentFor(actor).id;
  return catalog(studentId).filter(
    (c) => c.enrollment && c.enrollment.status !== "cancelled",
  );
}
export function scopedEnrollments(actor: AuthUser) {
  manager(actor);
  const students = listStudentsForStaff(actor.id, actor.roleKey);
  const ids = students.map((s) => s.id);
  if (!ids.length) return [];
  return db
    .select()
    .from(s.schoolEnrollments)
    .where(inArray(s.schoolEnrollments.studentId, ids))
    .all()
    .map((e) => ({
      ...e,
      studentName:
        students.find((s) => s.id === e.studentId)?.fullName ?? "متربی",
      course: db
        .select()
        .from(s.courses)
        .where(eq(s.courses.id, e.courseId))
        .get(),
      progress: courseProgress(e.studentId, e.courseId),
    }));
}
export function setEnrollmentStatus(
  actor: AuthUser,
  enrollmentId: string,
  status: string,
) {
  manager(actor);
  const row = db
    .select()
    .from(s.schoolEnrollments)
    .where(eq(s.schoolEnrollments.id, enrollmentId))
    .get();
  if (!row) throw new Error("ثبت‌نام یافت نشد.");
  assertStudentScope(actor, row.studentId);
  db.update(s.schoolEnrollments)
    .set({ status: z.enum(["active", "cancelled"]).parse(status) })
    .where(eq(s.schoolEnrollments.id, row.id))
    .run();
  if (status === "active") refreshCompletion(row.studentId, row.courseId);
}
export const examSchema = z.object({
  id: z.string().optional(),
  courseId: id,
  scope: z.enum(["course", "lesson", "section"]),
  scopeId: z.string().default(""),
  title,
  bankId: id,
  status: z.enum(["draft", "published", "closed"]),
  durationMinutes: z.coerce.number().int().min(1).max(300),
  passingPercent: z.coerce.number().int().min(0).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(100),
  questionCount: z.coerce.number().int().min(1).max(100),
  passBonusPoints: z.coerce.number().int().min(0).max(100000).default(10),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  showAnswers: z.boolean(),
  releaseResults: z.boolean(),
});
export function saveExam(actor: AuthUser, input: unknown) {
  manager(actor);
  const data = examSchema.parse(input);
  if (!db.select().from(s.courses).where(eq(s.courses.id, data.courseId)).get())
    throw new Error("دوره یافت نشد.");
  if (
    data.scope === "lesson" &&
    !db
      .select()
      .from(s.lessons)
      .where(
        and(
          eq(s.lessons.id, data.scopeId),
          eq(s.lessons.courseId, data.courseId),
        ),
      )
      .get()
  )
    throw new Error("درس متعلق به دوره نیست.");
  if (
    data.scope === "section" &&
    !db
      .select()
      .from(s.courseChapters)
      .where(
        and(
          eq(s.courseChapters.id, data.scopeId),
          eq(s.courseChapters.courseId, data.courseId),
        ),
      )
      .get()
  )
    throw new Error("فصل متعلق به دوره نیست.");
  const questions = db
    .select()
    .from(s.schoolQuestions)
    .where(eq(s.schoolQuestions.bankId, data.bankId))
    .all();
  if (data.status === "published" && questions.length < data.questionCount)
    throw new Error("تعداد سؤال‌های بانک کافی نیست.");
  const examId = data.id || createId("sex");
  db.insert(s.schoolExams)
    .values({
      ...data,
      id: examId,
      scopeId: data.scope === "course" ? null : data.scopeId,
    })
    .onConflictDoUpdate({
      target: s.schoolExams.id,
      set: {
        ...data,
        id: examId,
        scopeId: data.scope === "course" ? null : data.scopeId,
      },
    })
    .run();
  return examId;
}
export function saveQuestion(actor: AuthUser, input: unknown) {
  manager(actor);
  const data = z
    .object({
      id: z.string().optional(),
      bankId: id,
      prompt: title,
      type: z.literal("multiple_choice"),
      options: z
        .array(z.object({ key: id, text: z.string().trim().min(1) }))
        .max(8),
      answer: z.string().trim().min(1).max(10000),
      points: z.coerce.number().int().min(1).max(100),
    })
    .parse(input);
  if (
    data.type === "multiple_choice" &&
    (data.options.length < 2 ||
      new Set(data.options.map((o) => o.key)).size !== data.options.length ||
      !data.options.some((o) => o.key === data.answer))
  )
    throw new Error("گزینه‌ها و پاسخ صحیح معتبر نیستند.");
  const questionId = data.id || createId("sq");
  db.insert(s.schoolQuestions)
    .values({ ...data, id: questionId })
    .onConflictDoUpdate({
      target: s.schoolQuestions.id,
      set: { ...data, id: questionId },
    })
    .run();
  return questionId;
}
function shuffled<T>(values: T[]) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function examAccess(studentId: string, examId: string) {
  const exam = db
    .select()
    .from(s.schoolExams)
    .where(eq(s.schoolExams.id, examId))
    .get();
  if (!exam || exam.status !== "published")
    throw new Error("آزمون در دسترس نیست.");
  courseAccess(studentId, exam.courseId, true);
  const lessons = publishedLessons(exam.courseId).filter((l) =>
    exam.scope === "lesson"
      ? l.id === exam.scopeId
      : exam.scope === "section"
        ? l.chapterId === exam.scopeId
        : true,
  );
  if (
    !lessons.length ||
    lessons.some((l) => !isLessonCompletedByStudent(studentId, l.id))
  )
    throw new Error("ابتدا درس‌های مرتبط با آزمون را تکمیل کنید.");
  return exam;
}
export function startAttempt(actor: AuthUser, examId: string) {
  const student = studentFor(actor);
  const expired = db
    .select()
    .from(s.schoolAttempts)
    .where(
      and(
        eq(s.schoolAttempts.studentId, student.id),
        eq(s.schoolAttempts.examId, examId),
        eq(s.schoolAttempts.status, "in_progress"),
      ),
    )
    .get();
  if (expired && Date.parse(expired.expiresAt) <= Date.now())
    finishAttempt(actor, expired.id);
  return db.transaction(() => {
    const exam = examAccess(student.id, examId);
    const previous = db
      .select()
      .from(s.schoolAttempts)
      .where(
        and(
          eq(s.schoolAttempts.studentId, student.id),
          eq(s.schoolAttempts.examId, exam.id),
        ),
      )
      .orderBy(desc(s.schoolAttempts.startedAt))
      .all();
    const active = previous.find((a) => a.status === "in_progress");
    if (active && Date.parse(active.expiresAt) > Date.now()) return active.id;
    if (active) finishAttempt(actor, active.id);
    if (previous.length >= exam.maxAttempts)
      throw new Error("تعداد تلاش‌های مجاز تمام شده است.");
    let questions = db
      .select()
      .from(s.schoolQuestions)
      .where(eq(s.schoolQuestions.bankId, exam.bankId))
      .all();
    if (questions.length < exam.questionCount)
      throw new Error("بانک سؤال کافی نیست.");
    if (exam.shuffleQuestions) questions = shuffled(questions);
    const snapshot = questions.slice(0, exam.questionCount).map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: exam.shuffleOptions ? shuffled(q.options) : q.options,
      answer: q.answer,
      points: q.points,
    }));
    const attemptId = createId("sat");
    db.insert(s.schoolAttempts)
      .values({
        id: attemptId,
        examId,
        studentId: student.id,
        status: "in_progress",
        questions: snapshot,
        answers: {},
        grades: {},
        startedAt: nowIso(),
        expiresAt: new Date(
          Date.now() + exam.durationMinutes * 60000,
        ).toISOString(),
      })
      .run();
    return attemptId;
  });
}
function ownedAttempt(actor: AuthUser, attemptId: string) {
  const attempt = db
    .select()
    .from(s.schoolAttempts)
    .where(eq(s.schoolAttempts.id, attemptId))
    .get();
  if (!attempt) throw new Error("تلاش یافت نشد.");
  assertStudentScope(actor, attempt.studentId);
  return attempt;
}
export function saveAnswers(
  actor: AuthUser,
  attemptId: string,
  input: unknown,
) {
  const student = studentFor(actor);
  const answers = z.record(z.string(), z.string().max(10000)).parse(input);
  const attempt = ownedAttempt(actor, attemptId);
  if (attempt.studentId !== student.id || attempt.status !== "in_progress")
    throw new Error("آزمون پایان یافته است.");
  if (Date.parse(attempt.expiresAt) <= Date.now()) {
    finishAttempt(actor, attempt.id);
    return;
  }
  for (const [key, value] of Object.entries(answers)) {
    const question = attempt.questions.find((q) => q.id === key);
    if (
      !question ||
      (question.type === "multiple_choice" &&
        value &&
        !question.options.some((o) => o.key === value))
    )
      throw new Error("پاسخ معتبر نیست.");
  }
  db.update(s.schoolAttempts)
    .set({ answers: { ...attempt.answers, ...answers } })
    .where(eq(s.schoolAttempts.id, attempt.id))
    .run();
}
export function finishAttempt(actor: AuthUser, attemptId: string) {
  studentFor(actor);
  const attempt = ownedAttempt(actor, attemptId);
  if (attempt.status !== "in_progress") return;
  const grades: Record<string, s.SchoolGrade> = {};
  for (const q of attempt.questions)
    if (q.type === "multiple_choice")
      grades[q.id] = {
        points: attempt.answers[q.id] === q.answer ? q.points : 0,
        feedback: "تصحیح خودکار",
      };
  const score = scoreFor(attempt.questions, grades);
  db.update(s.schoolAttempts)
    .set({ grades, score, status: "graded", submittedAt: nowIso() })
    .where(eq(s.schoolAttempts.id, attemptId))
    .run();
  const exam = db
    .select()
    .from(s.schoolExams)
    .where(eq(s.schoolExams.id, attempt.examId))
    .get()!;
  if (score >= exam.passingPercent && exam.passBonusPoints > 0) {
    db.insert(s.schoolExamPointAwards)
      .values({
        id: createId("spa"),
        examId: exam.id,
        studentId: attempt.studentId,
        attemptId: attempt.id,
        points: exam.passBonusPoints,
        awardedAt: nowIso(),
      })
      .onConflictDoNothing()
      .run();
  }
  refreshCompletion(attempt.studentId, exam.courseId);
}

export function trackLessonView(
  actor: AuthUser,
  lessonId: string,
  sessionKey: string,
) {
  const student = studentFor(actor);
  lessonAccess(student.id, lessonId);
  const normalizedSessionKey = z
    .string()
    .trim()
    .min(8)
    .max(160)
    .parse(sessionKey);
  const result = db
    .insert(s.schoolLessonViews)
    .values({
      id: createId("slv"),
      lessonId,
      viewerUserId: actor.id,
      sessionKey: normalizedSessionKey,
      createdAt: nowIso(),
    })
    .onConflictDoNothing()
    .run();
  if (result.changes > 0) {
    db.update(s.lessons)
      .set({ viewCount: sql`${s.lessons.viewCount} + 1` })
      .where(eq(s.lessons.id, lessonId))
      .run();
  }
  return result.changes > 0;
}
function scoreFor(
  questions: s.SchoolSnapshot[],
  grades: Record<string, s.SchoolGrade>,
) {
  return Math.round(
    (100 * questions.reduce((n, q) => n + (grades[q.id]?.points ?? 0), 0)) /
      questions.reduce((n, q) => n + q.points, 0),
  );
}
export function studentAttempt(actor: AuthUser, attemptId: string) {
  studentFor(actor);
  let a = ownedAttempt(actor, attemptId);
  if (a.status === "in_progress" && Date.parse(a.expiresAt) <= Date.now()) {
    finishAttempt(actor, attemptId);
    a = ownedAttempt(actor, attemptId);
  }
  const exam = db
    .select()
    .from(s.schoolExams)
    .where(eq(s.schoolExams.id, a.examId))
    .get()!;
  const bonusAward = db
    .select()
    .from(s.schoolExamPointAwards)
    .where(
      and(
        eq(s.schoolExamPointAwards.examId, exam.id),
        eq(s.schoolExamPointAwards.studentId, a.studentId),
      ),
    )
    .get();
  const released = a.status === "graded" && exam.releaseResults;
  return {
    id: a.id,
    examId: a.examId,
    title: exam.title,
    status: a.status,
    answers: a.answers,
    expiresAt: a.expiresAt,
    score: released ? a.score : null,
    passingPercent: exam.passingPercent,
    passBonusPoints: exam.passBonusPoints,
    bonusAwarded: released ? (bonusAward?.points ?? 0) : 0,
    grades: released ? a.grades : {},
    questions: a.questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
      ...(released && exam.showAnswers ? { answer: q.answer } : {}),
    })),
  };
}
export function scopedAttempts(actor: AuthUser) {
  manager(actor);
  const students = listStudentsForStaff(actor.id, actor.roleKey);
  if (!students.length) return [];
  return db
    .select()
    .from(s.schoolAttempts)
    .where(
      inArray(
        s.schoolAttempts.studentId,
        students.map((s) => s.id),
      ),
    )
    .orderBy(desc(s.schoolAttempts.startedAt))
    .all()
    .map((a) => ({
      ...a,
      studentName: students.find((s) => s.id === a.studentId)?.fullName,
      examTitle: db
        .select()
        .from(s.schoolExams)
        .where(eq(s.schoolExams.id, a.examId))
        .get()?.title,
    }));
}
export function addComment(actor: AuthUser, input: unknown) {
  const data = z
    .object({
      courseId: id,
      lessonId: z.string().optional(),
      parentId: z.string().optional(),
      body: z.string().trim().min(1).max(5000),
    })
    .parse(input);
  if (actor.roleKey === "student") {
    const student = studentFor(actor);
    courseAccess(student.id, data.courseId, true);
    if (data.lessonId) lessonAccess(student.id, data.lessonId);
  } else manager(actor);
  if (
    data.lessonId &&
    db.select().from(s.lessons).where(eq(s.lessons.id, data.lessonId)).get()
      ?.courseId !== data.courseId
  )
    throw new Error("درس نامعتبر است.");
  if (data.parentId) {
    const parent = db
      .select()
      .from(s.schoolComments)
      .where(eq(s.schoolComments.id, data.parentId))
      .get();
    if (
      !parent ||
      parent.courseId !== data.courseId ||
      parent.lessonId !== (data.lessonId || null) ||
      (actor.roleKey === "student" && parent.status !== "approved")
    )
      throw new Error("نظر مرجع معتبر نیست.");
  }
  db.insert(s.schoolComments)
    .values({
      ...data,
      id: createId("sco"),
      lessonId: data.lessonId || null,
      parentId: data.parentId || null,
      authorId: actor.id,
      status: actor.roleKey === "student" ? "pending" : "approved",
      createdAt: nowIso(),
    })
    .run();
}
export function commentsFor(
  actor: AuthUser,
  courseId: string,
  lessonId?: string,
) {
  if (actor.roleKey === "student")
    courseAccess(studentFor(actor).id, courseId, true);
  else manager(actor);
  return db
    .select({ comment: s.schoolComments, author: s.users.fullName })
    .from(s.schoolComments)
    .innerJoin(s.users, eq(s.users.id, s.schoolComments.authorId))
    .where(
      and(
        eq(s.schoolComments.courseId, courseId),
        actor.roleKey === "student"
          ? or(
              eq(s.schoolComments.status, "approved"),
              eq(s.schoolComments.authorId, actor.id),
            )
          : undefined,
      ),
    )
    .orderBy(asc(s.schoolComments.createdAt))
    .all()
    .filter((r) => r.comment.lessonId === (lessonId || null))
    .map((r) => ({
      ...r.comment,
      author: r.author,
      likes: db
        .select()
        .from(s.schoolCommentLikes)
        .where(eq(s.schoolCommentLikes.commentId, r.comment.id))
        .all().length,
    }));
}
export function likeComment(actor: AuthUser, commentId: string) {
  const comment = db
    .select()
    .from(s.schoolComments)
    .where(eq(s.schoolComments.id, commentId))
    .get();
  if (!comment || comment.status !== "approved")
    throw new Error("نظر در دسترس نیست.");
  if (actor.roleKey === "student")
    courseAccess(studentFor(actor).id, comment.courseId, true);
  else manager(actor);
  const old = db
    .select()
    .from(s.schoolCommentLikes)
    .where(
      and(
        eq(s.schoolCommentLikes.commentId, commentId),
        eq(s.schoolCommentLikes.userId, actor.id),
      ),
    )
    .get();
  if (old)
    db.delete(s.schoolCommentLikes)
      .where(eq(s.schoolCommentLikes.id, old.id))
      .run();
  else
    db.insert(s.schoolCommentLikes)
      .values({ id: createId("like"), commentId, userId: actor.id })
      .run();
}
export function certificateByNumber(number: string) {
  return db
    .select()
    .from(s.schoolCertificates)
    .where(
      and(
        eq(s.schoolCertificates.number, number),
        eq(s.schoolCertificates.revoked, false),
      ),
    )
    .get();
}
export function myCertificates(actor: AuthUser) {
  const student = studentFor(actor);
  return db
    .select({ certificate: s.schoolCertificates })
    .from(s.schoolCertificates)
    .innerJoin(
      s.schoolEnrollments,
      eq(s.schoolEnrollments.id, s.schoolCertificates.enrollmentId),
    )
    .where(
      and(
        eq(s.schoolEnrollments.studentId, student.id),
        eq(s.schoolCertificates.revoked, false),
      ),
    )
    .all()
    .map((r) => r.certificate);
}

/** Ranking is confined to the student's own group, matching Safanoor's mentoring scope. */
export function groupLeaderboard(actor: AuthUser) {
  const student = studentFor(actor);
  const peers = student.groupId
    ? db
        .select({ id: s.students.id, name: s.users.fullName })
        .from(s.students)
        .innerJoin(s.users, eq(s.students.userId, s.users.id))
        .where(
          and(
            eq(s.students.groupId, student.groupId),
            eq(s.students.status, "active"),
          ),
        )
        .all()
    : [{ id: student.id, name: actor.fullName }];
  return peers
    .map((peer) => {
      const awards = db
        .select()
        .from(s.schoolExamPointAwards)
        .where(eq(s.schoolExamPointAwards.studentId, peer.id))
        .all();
      return {
        ...peer,
        points: awards.reduce((sum, award) => sum + award.points, 0),
        isMe: peer.id === student.id,
      };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "fa"))
    .slice(0, 10);
}
