import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AuthUser } from "@/server/auth/session";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "safanoor-school-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
let school: typeof import("@/server/modules/school/service");
let courses: typeof import("@/server/modules/courses/service");
let db: typeof import("@/db/client").db;
const actor = (id: string, roleKey: AuthUser["roleKey"]): AuthUser => ({
  id,
  roleKey,
  roleId: roleKey,
  username: id,
  fullName: id,
});
const mentor = actor("mentor", "mentor"),
  student = actor("student", "student"),
  other = actor("other", "student");
let courseId: string, lessonId: string, examId: string;
beforeAll(async () => {
  const sqlite = new Database(process.env.DATABASE_PATH!);
  migrate(drizzle(sqlite), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  sqlite.close();
  ({ db } = await import("@/db/client"));
  school = await import("@/server/modules/school/service");
  courses = await import("@/server/modules/courses/service");
  const now = new Date().toISOString();
  for (const role of ["mentor", "student", "assistant_mentor"])
    db.insert(schema.roles)
      .values({ id: role, key: role, titleFa: role, createdAt: now })
      .run();
  for (const a of [
    mentor,
    student,
    other,
    actor("outsider", "mentor"),
    actor("assistant", "assistant_mentor"),
  ])
    db.insert(schema.users)
      .values({
        id: a.id,
        username: a.id,
        fullName: a.fullName,
        roleId: a.roleId,
        passwordHash: "unused",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  for (const a of [student, other])
    db.insert(schema.students)
      .values({
        id: `s-${a.id}`,
        userId: a.id,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  db.insert(schema.mentorAssignments)
    .values({
      id: "assignment",
      studentId: "s-student",
      staffUserId: mentor.id,
      assignmentRole: "mentor",
      startedAt: now,
      isActive: true,
    })
    .run();
  courseId = courses.createCourse({
    title: "مدرسه آزمایشی",
    ordering: 0,
    status: "published",
  }).id;
  lessonId = courses.createLesson({
    title: "درس اول",
    courseId,
    contentType: "TEXT",
    ordering: 0,
  }).id;
  db.insert(schema.schoolBanks).values({ id: "bank", title: "بانک تست" }).run();
  school.saveQuestion(mentor, {
    bankId: "bank",
    type: "multiple_choice",
    prompt: "دو به علاوه دو؟",
    answer: "B",
    points: 2,
    options: [
      { key: "A", text: "سه" },
      { key: "B", text: "چهار" },
    ],
  });
  examId = school.saveExam(mentor, {
    courseId,
    scope: "course",
    title: "آزمون تستی",
    bankId: "bank",
    status: "published",
    durationMinutes: 1,
    passingPercent: 60,
    maxAttempts: 3,
    questionCount: 1,
    passBonusPoints: 25,
    shuffleQuestions: true,
    shuffleOptions: true,
    showAnswers: false,
    releaseResults: true,
  });
});
afterAll(() => {
  db.$client.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
describe("school access and publication", () => {
  it("allows only mentors/admins to manage school", () => {
    expect(() => school.manager(mentor)).not.toThrow();
    expect(() => school.manager(student)).toThrow();
    expect(() =>
      school.manager(actor("assistant", "assistant_mentor")),
    ).toThrow();
  });
  it("requires enrollment for lessons and rejects draft courses even by direct id", () => {
    expect(() => school.lessonAccess("s-student", lessonId)).toThrow("ثبت‌نام");
    const draft = courses.createCourse({
      title: "پیش‌نویس",
      ordering: 1,
      status: "draft",
    });
    expect(() => school.enroll(student, draft.id)).toThrow();
    expect(school.catalog("s-student").some((c) => c.id === draft.id)).toBe(
      false,
    );
  });
  it("does not allow a student or an unrelated mentor to choose another student", () => {
    expect(() => school.assertStudentScope(student, "s-other")).toThrow();
    expect(() =>
      school.enroll(actor("outsider", "mentor"), courseId, "s-student"),
    ).toThrow();
    school.enroll(student, courseId, "s-other");
    expect(school.enrollment("s-other", courseId)).toBeUndefined();
    expect(school.enrollment("s-student", courseId)).toBeTruthy();
  });
  it("keeps enrollment idempotent and locks exams until completion", () => {
    const first = school.enrollment("s-student", courseId)!;
    expect(school.enroll(student, courseId)).toBe(first.id);
    expect(() => school.startAttempt(student, examId)).toThrow("تکمیل");
    school.completeLesson(student, lessonId);
    school.completeLesson(student, lessonId);
    expect(school.courseProgress("s-student", courseId)).toEqual({
      total: 1,
      completed: 1,
      percent: 100,
    });
    expect(school.myCertificates(student)).toHaveLength(0);
  });
  it("prevents private course self-enrollment but lets scoped mentor enroll", () => {
    const privateCourse = courses.createCourse({
      title: "دوره خصوصی",
      ordering: 2,
      status: "published",
    });
    db.update(schema.courses)
      .set({ isPublic: false })
      .where(eq(schema.courses.id, privateCourse.id))
      .run();
    expect(() => school.enroll(student, privateCourse.id)).toThrow();
    school.enroll(mentor, privateCourse.id, "s-student");
    expect(school.courseAccess("s-student", privateCourse.id)).toBeTruthy();
  });
  it("hides lessons in draft chapters", () => {
    const chapter = courses.createChapter({ title: "فصل مخفی", courseId });
    const lesson = courses.createLesson({
      courseId,
      chapterId: chapter.id,
      title: "درس مخفی",
      contentType: "TEXT",
      ordering: 1,
    });
    db.update(schema.courseChapters)
      .set({ status: "draft" })
      .where(eq(schema.courseChapters.id, chapter.id))
      .run();
    expect(
      school.publishedLessons(courseId).some((l) => l.id === lesson.id),
    ).toBe(false);
    expect(() => school.lessonAccess("s-student", lesson.id)).toThrow();
  });
  it("counts one lesson view per browser session and enforces lesson access", () => {
    expect(school.trackLessonView(student, lessonId, "session-12345678")).toBe(
      true,
    );
    expect(school.trackLessonView(student, lessonId, "session-12345678")).toBe(
      false,
    );
    expect(school.trackLessonView(student, lessonId, "session-87654321")).toBe(
      true,
    );
    expect(
      db
        .select()
        .from(schema.lessons)
        .where(eq(schema.lessons.id, lessonId))
        .get()?.viewCount,
    ).toBe(2);
    expect(() =>
      school.trackLessonView(other, lessonId, "session-other-123"),
    ).toThrow();
  });
});
describe("multiple choice exam lifecycle", () => {
  let attemptId: string;
  it("starts once, resumes, and never exposes the answer key", () => {
    attemptId = school.startAttempt(student, examId);
    expect(school.startAttempt(student, examId)).toBe(attemptId);
    const view = school.studentAttempt(student, attemptId);
    expect(view.questions[0]).not.toHaveProperty("answer");
    expect(view).not.toHaveProperty("studentId");
    expect(() => school.studentAttempt(other, attemptId)).toThrow();
  });
  it("rejects answers to unknown questions and forged option keys", () => {
    const view = school.studentAttempt(student, attemptId);
    expect(() =>
      school.saveAnswers(student, attemptId, { fake: "A" }),
    ).toThrow();
    expect(() =>
      school.saveAnswers(student, attemptId, { [view.questions[0].id]: "Z" }),
    ).toThrow();
    expect(() =>
      school.saveAnswers(other, attemptId, { [view.questions[0].id]: "B" }),
    ).toThrow();
  });
  it("uses an immutable question snapshot, scores automatically and issues one certificate", () => {
    const q = school.studentAttempt(student, attemptId).questions[0];
    db.update(schema.schoolQuestions)
      .set({ answer: "A" })
      .where(eq(schema.schoolQuestions.id, q.id))
      .run();
    school.saveAnswers(student, attemptId, { [q.id]: "B" });
    school.finishAttempt(student, attemptId);
    expect(school.studentAttempt(student, attemptId).score).toBe(100);
    expect(
      school.studentAttempt(student, attemptId).questions[0],
    ).not.toHaveProperty("answer");
    expect(school.enrollment("s-student", courseId)?.status).toBe("completed");
    expect(
      db
        .select()
        .from(schema.schoolExamPointAwards)
        .where(eq(schema.schoolExamPointAwards.studentId, "s-student"))
        .all(),
    ).toEqual([expect.objectContaining({ examId, points: 25, attemptId })]);
    school.refreshCompletion("s-student", courseId);
    school.finishAttempt(student, attemptId);
    expect(
      db
        .select()
        .from(schema.schoolExamPointAwards)
        .where(eq(schema.schoolExamPointAwards.studentId, "s-student"))
        .all(),
    ).toHaveLength(1);
    expect(school.myCertificates(student)).toHaveLength(1);
    const certificate = school.myCertificates(student)[0];
    expect(school.certificateByNumber(certificate.number)?.studentName).toBe(
      "student",
    );
    expect(school.myCertificates(other)).toHaveLength(0);
  });
  it("honors result release and answer visibility settings", () => {
    db.update(schema.schoolExams)
      .set({ releaseResults: false, showAnswers: true })
      .where(eq(schema.schoolExams.id, examId))
      .run();
    expect(school.studentAttempt(student, attemptId).score).toBeNull();
    expect(school.studentAttempt(student, attemptId).grades).toEqual({});
    expect(
      school.studentAttempt(student, attemptId).questions[0],
    ).not.toHaveProperty("answer");
    db.update(schema.schoolExams)
      .set({ releaseResults: true })
      .where(eq(schema.schoolExams.id, examId))
      .run();
    expect(school.studentAttempt(student, attemptId).questions[0].answer).toBe(
      "B",
    );
  });
  it("supports a randomized subset of questions", () => {
    db.insert(schema.schoolBanks)
      .values({ id: "random-bank", title: "تصادفی" })
      .run();
    for (let index = 1; index <= 3; index += 1) {
      school.saveQuestion(mentor, {
        bankId: "random-bank",
        type: "multiple_choice",
        prompt: `سؤال تصادفی ${index}`,
        answer: "A",
        points: 1,
        options: [
          { key: "A", text: "درست" },
          { key: "B", text: "نادرست" },
        ],
      });
    }
    const randomExamId = school.saveExam(mentor, {
      courseId,
      scope: "course",
      title: "آزمون تصادفی",
      bankId: "random-bank",
      status: "published",
      durationMinutes: 5,
      passingPercent: 60,
      passBonusPoints: 0,
      maxAttempts: 1,
      questionCount: 2,
      shuffleQuestions: true,
      shuffleOptions: true,
      showAnswers: false,
      releaseResults: true,
    });
    const randomAttempt = school.startAttempt(student, randomExamId);
    const questions = school.studentAttempt(student, randomAttempt).questions;
    expect(questions).toHaveLength(2);
    expect(new Set(questions.map((question) => question.id)).size).toBe(2);
  });
  it("supports exams attached to standalone playlist lessons", () => {
    db.insert(schema.courses)
      .values({
        id: "school_standalone_test",
        title: "محتوای مستقل تست",
        status: "published",
        ordering: 0,
        createdAt: new Date().toISOString(),
        isPublic: true,
        isStandaloneCollection: true,
        issueCertificate: false,
      })
      .run();
    const standaloneLesson = courses.createLesson({
      courseId: "school_standalone_test",
      title: "درس مستقل",
      contentType: "TEXT",
      ordering: 0,
    });
    school.completeLesson(student, standaloneLesson.id);
    const standaloneExam = school.saveExam(mentor, {
      courseId: "school_standalone_test",
      scope: "lesson",
      scopeId: standaloneLesson.id,
      title: "آزمون درس مستقل",
      bankId: "bank",
      status: "published",
      durationMinutes: 5,
      passingPercent: 60,
      passBonusPoints: 10,
      maxAttempts: 1,
      questionCount: 1,
      shuffleQuestions: true,
      shuffleOptions: true,
      showAnswers: false,
      releaseResults: true,
    });
    expect(() => school.startAttempt(student, standaloneExam)).not.toThrow();
  });
  it("expires server-side without accepting late answers", () => {
    const next = school.startAttempt(student, examId);
    const q = school.studentAttempt(student, next).questions[0];
    db.update(schema.schoolAttempts)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(schema.schoolAttempts.id, next))
      .run();
    school.saveAnswers(student, next, { [q.id]: "A" });
    expect(school.studentAttempt(student, next).status).toBe("graded");
    expect(school.studentAttempt(student, next).score).toBe(0);
  });
  it("enforces maximum attempts", () => {
    const last = school.startAttempt(student, examId);
    school.finishAttempt(student, last);
    expect(() => school.startAttempt(student, examId)).toThrow("تلاش");
  });
  it("rejects descriptive questions and cross-course exam scopes", () => {
    expect(() =>
      school.saveQuestion(mentor, {
        bankId: "bank",
        type: "descriptive",
        prompt: "سؤال تشریحی",
        answer: "پاسخ",
        options: [],
        points: 1,
      }),
    ).toThrow();
    const exam = db
      .select()
      .from(schema.schoolExams)
      .where(eq(schema.schoolExams.id, examId))
      .get()!;
    expect(() =>
      school.saveExam(mentor, {
        ...exam,
        id: undefined,
        scope: "lesson",
        scopeId: "missing",
      }),
    ).toThrow();
  });
});
describe("comments and scoped reports", () => {
  it("moderates student comments, hides pending comments, and toggles likes", () => {
    school.addComment(student, {
      courseId,
      body: "نظر اول",
      lessonId: "",
      parentId: "",
    });
    const own = school.commentsFor(student, courseId)[0];
    expect(own.status).toBe("pending");
    school.enroll(other, courseId);
    expect(school.commentsFor(other, courseId)).toHaveLength(0);
    expect(() => school.likeComment(other, own.id)).toThrow();
    db.update(schema.schoolComments)
      .set({ status: "approved" })
      .where(eq(schema.schoolComments.id, own.id))
      .run();
    school.likeComment(other, own.id);
    expect(school.commentsFor(student, courseId)[0].likes).toBe(1);
    school.likeComment(other, own.id);
    expect(school.commentsFor(student, courseId)[0].likes).toBe(0);
  });
  it("limits reports to assigned students", () => {
    expect(
      school
        .scopedEnrollments(mentor)
        .every((e) => e.studentId === "s-student"),
    ).toBe(true);
    expect(school.scopedEnrollments(actor("outsider", "mentor"))).toHaveLength(
      0,
    );
    expect(school.scopedAttempts(actor("outsider", "mentor"))).toHaveLength(0);
  });
  it("blocks completion after canceled enrollment", () => {
    school.setEnrollmentStatus(
      mentor,
      school.enrollment("s-student", courseId)!.id,
      "cancelled",
    );
    expect(() => school.completeLesson(student, lessonId)).toThrow("ثبت‌نام");
  });
});
