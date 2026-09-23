import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { students } from "./students";

export const courses = sqliteTable("courses", {
  isStandaloneCollection: integer("is_standalone_collection", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  issueCertificate: integer("issue_certificate", { mode: "boolean" })
    .notNull()
    .default(true),
  parentCourseId: text("parent_course_id"),
  isGroup: integer("is_group", { mode: "boolean" }).notNull().default(false),
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  coverPath: text("cover_path"),
  status: text("status").notNull(),
  ordering: integer("ordering").notNull(),
  createdAt: text("created_at").notNull(),
});

export const coursePrerequisites = sqliteTable(
  "course_prerequisites",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    prerequisiteCourseId: text("prerequisite_course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("course_prerequisites_course_id_idx").on(table.courseId),
    uniqueIndex("course_prerequisites_unique").on(
      table.courseId,
      table.prerequisiteCourseId,
    ),
  ],
);

export const courseChapters = sqliteTable(
  "course_chapters",
  {
    status: text("status").notNull().default("published"),
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ordering: integer("ordering").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("course_chapters_course_id_idx").on(table.courseId)],
);

export const lessons = sqliteTable(
  "lessons",
  {
    status: text("status").notNull().default("published"),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    audioUrl: text("audio_url"),
    isPreview: integer("is_preview", { mode: "boolean" })
      .notNull()
      .default(false),
    viewCount: integer("view_count").notNull().default(0),
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => courseChapters.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    ordering: integer("ordering").notNull(),
    contentType: text("content_type").notNull(),
  },
  (table) => [
    index("lessons_course_id_idx").on(table.courseId),
    index("lessons_chapter_id_idx").on(table.chapterId),
  ],
);

export const lessonContents = sqliteTable(
  "lesson_contents",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .unique()
      .references(() => lessons.id, { onDelete: "cascade" }),
    body: text("body"),
    filePath: text("file_path"),
    url: text("url"),
  },
  (table) => [index("lesson_contents_lesson_id_idx").on(table.lessonId)],
);

export const books = sqliteTable("books", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  description: text("description"),
  coverPath: text("cover_path"),
  difficulty: text("difficulty"),
  estimatedMinutes: integer("estimated_minutes"),
  createdAt: text("created_at").notNull(),
});

export const bookChapters = sqliteTable(
  "book_chapters",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ordering: integer("ordering").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("book_chapters_book_id_idx").on(table.bookId)],
);

export const readingPlans = sqliteTable(
  "reading_plans",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    deadline: text("deadline"),
    status: text("status").notNull(),
    progress: integer("progress").notNull().default(0),
    mentorNote: text("mentor_note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("reading_plans_student_id_idx").on(table.studentId),
    index("reading_plans_book_id_idx").on(table.bookId),
    uniqueIndex("reading_plans_student_book_unique").on(
      table.studentId,
      table.bookId,
    ),
  ],
);

/** جزوهٔ شخصی دانش‌آموز برای هر درس */
export const lessonNotes = sqliteTable(
  "lesson_notes",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("lesson_notes_student_id_idx").on(table.studentId),
    index("lesson_notes_lesson_id_idx").on(table.lessonId),
    uniqueIndex("lesson_notes_student_lesson_unique").on(
      table.studentId,
      table.lessonId,
    ),
  ],
);

export type Course = typeof courses.$inferSelect;
export type CoursePrerequisite = typeof coursePrerequisites.$inferSelect;
export type CourseChapter = typeof courseChapters.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type LessonContent = typeof lessonContents.$inferSelect;
export type Book = typeof books.$inferSelect;
export type BookChapter = typeof bookChapters.$inferSelect;
export type ReadingPlan = typeof readingPlans.$inferSelect;
export type LessonNote = typeof lessonNotes.$inferSelect;
