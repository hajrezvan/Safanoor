import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { EXAM_RELATED_TYPE, EXAM_SUBMISSION_STATUS, ROLE_KEYS } from "@/lib/enums";

const dbPath = path.join(os.tmpdir(), `safanoor-exams-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

let examsService: typeof import("@/server/modules/exams/service");
let booksService: typeof import("@/server/modules/books/service");

describe("exams service", () => {
  beforeAll(async () => {
    const sqlite = new Database(dbPath);
    migrate(drizzle(sqlite, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    sqlite.close();

    const { db } = await import("@/db/client");
    const now = new Date().toISOString();

    db.insert(schema.roles)
      .values({
        id: "role_admin",
        key: ROLE_KEYS.ADMIN,
        titleFa: "مدیر",
        createdAt: now,
      })
      .run();

    db.insert(schema.users)
      .values({
        id: "usr_admin",
        username: "admin_exam",
        email: null,
        passwordHash: "x",
        fullName: "مدیر تست",
        roleId: "role_admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.grades)
      .values({
        id: "grd_1",
        key: "seventh",
        titleFa: "هفتم",
        ordering: 1,
        createdAt: now,
      })
      .run();

    db.insert(schema.students)
      .values({
        id: "std_exam",
        userId: null,
        gradeId: "grd_1",
        groupId: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    examsService = await import("@/server/modules/exams/service");
    booksService = await import("@/server/modules/books/service");
  });

  afterAll(() => {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  });

  it("creates MCQ exam, auto-scores correct answer, and hides correct key for students", () => {
    const book = booksService.createBook({
      title: `کتاب آزمون ${Date.now()}`,
      author: "تست",
    });
    expect(book).toBeTruthy();

    const chapter = booksService.createBookChapter({
      bookId: book!.id,
      title: "فصل آزمون",
      ordering: 1,
    });

    const exam = examsService.createExam({
      relatedType: EXAM_RELATED_TYPE.BOOK_CHAPTER,
      relatedId: chapter.id,
      title: "آزمون تستی",
      prompt: "پاسخ درست کدام است؟",
      options: [
        { key: "A", text: "درست" },
        { key: "B", text: "نادرست ۱" },
        { key: "C", text: "نادرست ۲" },
      ],
      correctOptionKey: "A",
      createdBy: "usr_admin",
    });

    expect(exam.options).toHaveLength(3);
    expect(exam.correctOptionKey).toBe("A");

    const studentView = examsService.toStudentExam(exam);
    expect(studentView).not.toHaveProperty("correctOptionKey");
    expect(studentView.options.map((o) => o.key)).toEqual(["A", "B", "C"]);

    const submission = examsService.submitExamAnswer({
      examId: exam.id,
      studentId: "std_exam",
      selectedOption: "A",
    });

    expect(submission.status).toBe(EXAM_SUBMISSION_STATUS.REVIEWED);
    expect(submission.score).toBe(100);
    expect(submission.selectedOption).toBe("A");
    expect(examsService.getStudentSubmission(exam.id, "std_exam")?.id).toBe(submission.id);
  });

  it("auto-scores incorrect MCQ answers as zero", () => {
    const book = booksService.createBook({
      title: `کتاب آزمون غلط ${Date.now()}`,
      author: "تست",
    });
    const chapter = booksService.createBookChapter({
      bookId: book!.id,
      title: "فصل",
      ordering: 1,
    });
    const exam = examsService.createExam({
      relatedType: EXAM_RELATED_TYPE.BOOK_CHAPTER,
      relatedId: chapter.id,
      title: "تست غلط",
      prompt: "سوال؟",
      options: [
        { key: "A", text: "۱" },
        { key: "B", text: "۲" },
      ],
      correctOptionKey: "B",
      createdBy: "usr_admin",
    });

    const submission = examsService.submitExamAnswer({
      examId: exam.id,
      studentId: "std_exam",
      selectedOption: "A",
    });

    expect(submission.status).toBe(EXAM_SUBMISSION_STATUS.REVIEWED);
    expect(submission.score).toBe(0);
    expect(submission.feedback).toContain("نادرست");
  });

  it("allows staff to override auto score via review", () => {
    const book = booksService.createBook({
      title: `کتاب بازبینی ${Date.now()}`,
      author: "تست",
    });
    const chapter = booksService.createBookChapter({
      bookId: book!.id,
      title: "فصل",
      ordering: 1,
    });
    const exam = examsService.createExam({
      relatedType: EXAM_RELATED_TYPE.BOOK_CHAPTER,
      relatedId: chapter.id,
      title: "بازبینی",
      prompt: "سوال؟",
      options: [
        { key: "A", text: "۱" },
        { key: "B", text: "۲" },
      ],
      correctOptionKey: "A",
      createdBy: "usr_admin",
    });

    // second student needed because first may already have submissions across exams — unique is per exam+student
    const submission = examsService.submitExamAnswer({
      examId: exam.id,
      studentId: "std_exam",
      selectedOption: "B",
    });

    expect(() =>
      examsService.submitExamAnswer({
        examId: exam.id,
        studentId: "std_exam",
        selectedOption: "A",
      }),
    ).toThrow(/بازبینی/);

    const reviewed = examsService.reviewExamSubmission({
      submissionId: submission.id,
      score: 50,
      feedback: "نیم‌نمره",
      reviewedBy: "usr_admin",
    });

    expect(reviewed.status).toBe(EXAM_SUBMISSION_STATUS.REVIEWED);
    expect(reviewed.score).toBe(50);
  });

  it("draws random bank questions, scores pass/fail, and allows retake after fail", () => {
    const book = booksService.createBook({
      title: `کتاب بانک ${Date.now()}`,
      author: "تست",
    });
    const chapter = booksService.createBookChapter({
      bookId: book!.id,
      title: "فصل بانک",
      ordering: 1,
    });
    const exam = examsService.createExam({
      relatedType: EXAM_RELATED_TYPE.BOOK_CHAPTER,
      relatedId: chapter.id,
      title: "آزمون بانک",
      prompt: "سوال ۱؟",
      options: [
        { key: "A", text: "درست" },
        { key: "B", text: "غلط" },
      ],
      correctOptionKey: "A",
      createdBy: "usr_admin",
    });
    examsService.insertExamQuestion(exam.id, {
      prompt: "سوال ۲؟",
      options: [
        { key: "A", text: "غلط" },
        { key: "B", text: "درست" },
      ],
      correctOptionKey: "B",
    });
    examsService.insertExamQuestion(exam.id, {
      prompt: "سوال ۳؟",
      options: [
        { key: "A", text: "درست" },
        { key: "B", text: "غلط" },
      ],
      correctOptionKey: "A",
    });
    examsService.insertExamQuestion(exam.id, {
      prompt: "سوال ۴؟",
      options: [
        { key: "A", text: "غلط" },
        { key: "B", text: "درست" },
      ],
      correctOptionKey: "B",
    });

    expect(examsService.listExamBankQuestions(exam.id).length).toBeGreaterThanOrEqual(4);

    const attempt = examsService.startOrResumeAttempt(exam.id, "std_exam");
    expect(attempt.status).toBe("in_progress");
    expect(attempt.questionIds.length).toBe(3);

    for (let i = 0; i < attempt.questionIds.length; i += 1) {
      examsService.saveAttemptAnswer({
        examId: exam.id,
        studentId: "std_exam",
        questionIndex: i,
        selectedOption: "A",
        goToIndex: i + 1 < attempt.questionIds.length ? i + 1 : undefined,
      });
    }
    const finished = examsService.completeAttempt(exam.id, "std_exam", "submit");
    expect(finished.score).not.toBeNull();

    if (!examsService.isExamPassed(finished.score)) {
      const retake = examsService.startOrResumeAttempt(exam.id, "std_exam");
      expect(retake.status).toBe("in_progress");
      expect(retake.seenQuestionIds.length).toBeGreaterThan(0);
    } else {
      const locked = examsService.startOrResumeAttempt(exam.id, "std_exam");
      expect(locked.status).toBe(finished.status);
      expect(examsService.isExamPassed(locked.score)).toBe(true);
    }

    const progress = examsService.getBookExamProgress([chapter.id], "std_exam");
    expect(progress.total).toBe(1);
    expect(progress.percent).toBe(examsService.isExamPassed(finished.score) ? 100 : 0);
  });
});
