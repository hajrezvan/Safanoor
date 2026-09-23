import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { courses, lessons } from "./learning";
import { students } from "./students";
import { users } from "./auth";

export const schoolEnrollments = sqliteTable(
  "school_enrollments",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("school_enrollment_unique").on(t.courseId, t.studentId)],
);
export const schoolPlaylists = sqliteTable("school_playlists", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  coverPath: text("cover_path").notNull().default(""),
  status: text("status").notNull().default("draft"),
  ordering: integer("ordering").notNull().default(0),
});
export const schoolPlaylistLessons = sqliteTable(
  "school_playlist_lessons",
  {
    id: text("id").primaryKey(),
    playlistId: text("playlist_id")
      .notNull()
      .references(() => schoolPlaylists.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    ordering: integer("ordering").notNull().default(0),
  },
  (t) => [
    uniqueIndex("school_playlist_lesson_unique").on(t.playlistId, t.lessonId),
  ],
);
export const schoolComments = sqliteTable(
  "school_comments",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").references(() => lessons.id, {
      onDelete: "cascade",
    }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("school_comment_course_idx").on(t.courseId)],
);
export const schoolCommentLikes = sqliteTable(
  "school_comment_likes",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id")
      .notNull()
      .references(() => schoolComments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("school_like_unique").on(t.commentId, t.userId)],
);
export const schoolBanks = sqliteTable("school_banks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
});
export type SchoolOption = { key: string; text: string };
export const schoolQuestions = sqliteTable("school_questions", {
  id: text("id").primaryKey(),
  bankId: text("bank_id")
    .notNull()
    .references(() => schoolBanks.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  prompt: text("prompt").notNull(),
  options: text("options", { mode: "json" }).$type<SchoolOption[]>().notNull(),
  answer: text("answer").notNull(),
  points: integer("points").notNull().default(1),
});
export const schoolExams = sqliteTable("school_exams", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  scope: text("scope").notNull().default("course"),
  scopeId: text("scope_id"),
  title: text("title").notNull(),
  bankId: text("bank_id")
    .notNull()
    .references(() => schoolBanks.id),
  status: text("status").notNull().default("draft"),
  durationMinutes: integer("duration_minutes").notNull().default(20),
  passingPercent: integer("passing_percent").notNull().default(60),
  maxAttempts: integer("max_attempts").notNull().default(3),
  questionCount: integer("question_count").notNull().default(10),
  passBonusPoints: integer("pass_bonus_points").notNull().default(10),
  shuffleQuestions: integer("shuffle_questions", { mode: "boolean" })
    .notNull()
    .default(true),
  shuffleOptions: integer("shuffle_options", { mode: "boolean" })
    .notNull()
    .default(true),
  showAnswers: integer("show_answers", { mode: "boolean" })
    .notNull()
    .default(false),
  releaseResults: integer("release_results", { mode: "boolean" })
    .notNull()
    .default(true),
});
export const schoolExamPointAwards = sqliteTable(
  "school_exam_point_awards",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => schoolExams.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    attemptId: text("attempt_id").notNull(),
    points: integer("points").notNull(),
    awardedAt: text("awarded_at").notNull(),
  },
  (t) => [
    uniqueIndex("school_exam_point_award_unique").on(t.examId, t.studentId),
    index("school_exam_point_award_student_idx").on(t.studentId),
  ],
);
export type SchoolSnapshot = {
  id: string;
  type: string;
  prompt: string;
  options: SchoolOption[];
  answer: string;
  points: number;
};
export type SchoolGrade = { points: number; feedback: string };
export const schoolAttempts = sqliteTable(
  "school_attempts",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => schoolExams.id),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    status: text("status").notNull(),
    questions: text("questions", { mode: "json" })
      .$type<SchoolSnapshot[]>()
      .notNull(),
    answers: text("answers", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull(),
    grades: text("grades", { mode: "json" })
      .$type<Record<string, SchoolGrade>>()
      .notNull(),
    score: integer("score"),
    startedAt: text("started_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    submittedAt: text("submitted_at"),
    reviewedBy: text("reviewed_by").references(() => users.id),
  },
  (t) => [index("school_attempt_student_idx").on(t.studentId, t.examId)],
);
export const schoolCertificates = sqliteTable("school_certificates", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id")
    .notNull()
    .unique()
    .references(() => schoolEnrollments.id),
  number: text("number").notNull().unique(),
  studentName: text("student_name").notNull(),
  courseTitle: text("course_title").notNull(),
  issuedAt: text("issued_at").notNull(),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
});
export const schoolBanners = sqliteTable("school_banners", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  image: text("image").notNull(),
  href: text("href").notNull(),
  ordering: integer("ordering").notNull().default(0),
});
export const schoolPresenters = sqliteTable("school_presenters", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
});
export const schoolAttachments = sqliteTable("school_attachments", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
});
export const schoolLessonViews = sqliteTable(
  "school_lesson_views",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    viewerUserId: text("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sessionKey: text("session_key").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("school_lesson_view_session_unique").on(
      t.lessonId,
      t.sessionKey,
    ),
    index("school_lesson_view_lesson_idx").on(t.lessonId, t.createdAt),
  ],
);
