import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { grades, groups } from "./academic";
import { students } from "./students";

export const announcements = sqliteTable(
  "announcements",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id),
    audience: text("audience").notNull(),
    gradeId: text("grade_id").references(() => grades.id, { onDelete: "set null" }),
    groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("announcements_status_idx").on(table.status),
    index("announcements_audience_idx").on(table.audience),
  ],
);

export const exams = sqliteTable(
  "exams",
  {
    id: text("id").primaryKey(),
    relatedType: text("related_type").notNull(),
    relatedId: text("related_id").notNull(),
    title: text("title").notNull(),
    /** خلاصهٔ نمایشی / سازگاری با داده‌های قدیمی — بانک اصلی در exam_questions است */
    prompt: text("prompt").notNull(),
    /** JSON: `[{key:'A', text:'...'}, ...]` — گزینه‌های تستی (legacy / خلاصه) */
    optionsJson: text("options_json"),
    /** کلید گزینهٔ صحیح؛ فقط برای نمره‌دهی خودکار / کارکنان */
    correctOptionKey: text("correct_option_key"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("exams_related_idx").on(table.relatedType, table.relatedId),
  ],
);

/** بانک سوالات چندگزینه‌ای متعلق به یک آزمون (quiz) */
export const examQuestions = sqliteTable(
  "exam_questions",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    /** JSON: `[{key:'A', text:'...'}, ...]` */
    optionsJson: text("options_json").notNull(),
    correctOptionKey: text("correct_option_key").notNull(),
    ordering: integer("ordering").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("exam_questions_exam_id_idx").on(table.examId),
  ],
);

export const examSubmissions = sqliteTable(
  "exam_submissions",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** متن نمایشی پاسخ (کلید یا برچسب گزینه) */
    answerText: text("answer_text").notNull(),
    /** کلید گزینهٔ انتخاب‌شده (A/B/C/D) */
    selectedOption: text("selected_option"),
    status: text("status").notNull(),
    score: integer("score"),
    feedback: text("feedback"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    submittedAt: text("submitted_at"),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("exam_submissions_exam_id_idx").on(table.examId),
    index("exam_submissions_student_id_idx").on(table.studentId),
    uniqueIndex("exam_submissions_exam_student_unique").on(table.examId, table.studentId),
  ],
);

/** تلاش زمان‌دار دانش‌آموز برای یک آزمون (ادامه / انقضای خودکار) */
export const examAttempts = sqliteTable(
  "exam_attempts",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startedAt: text("started_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    questionCount: integer("question_count").notNull(),
    secondsPerQuestion: integer("seconds_per_question").notNull(),
    allowBack: integer("allow_back", { mode: "boolean" }).notNull().default(false),
    currentIndex: integer("current_index").notNull().default(0),
    /** JSON: `{ "0": "A", "1": "B" }` — کلید = اندیس سوال در این تلاش */
    answersJson: text("answers_json").notNull().default("{}"),
    /** JSON: `["eq_…", …]` — سوالات انتخاب‌شده برای این تلاش به ترتیب نمایش */
    questionIdsJson: text("question_ids_json").notNull().default("[]"),
    /** JSON: `["eq_…", …]` — سوالات دیده‌شده در تلاش‌های قبلی (برای اولویت‌بندی تصادفی) */
    seenQuestionIdsJson: text("seen_question_ids_json").notNull().default("[]"),
    score: integer("score"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("exam_attempts_exam_id_idx").on(table.examId),
    index("exam_attempts_student_id_idx").on(table.studentId),
    uniqueIndex("exam_attempts_exam_student_unique").on(table.examId, table.studentId),
  ],
);

export type Announcement = typeof announcements.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type ExamSubmission = typeof examSubmissions.$inferSelect;
export type ExamAttempt = typeof examAttempts.$inferSelect;
