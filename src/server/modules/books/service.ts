import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { bookChapters, books, readingPlans, students, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { BOOK_DIFFICULTY, READING_PLAN_STATUS } from "@/lib/enums";

const difficultyEnum = z.enum([
  BOOK_DIFFICULTY.BEGINNER,
  BOOK_DIFFICULTY.INTERMEDIATE,
  BOOK_DIFFICULTY.ADVANCED,
]);

const readingStatusEnum = z.enum([
  READING_PLAN_STATUS.NOT_STARTED,
  READING_PLAN_STATUS.IN_PROGRESS,
  READING_PLAN_STATUS.COMPLETED,
  READING_PLAN_STATUS.OVERDUE,
]);

export const createBookSchema = z.object({
  title: z.string().min(2, "عنوان کتاب حداقل ۲ کاراکتر باشد."),
  author: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  coverPath: z.string().optional().or(z.literal("")),
  difficulty: difficultyEnum.optional().or(z.literal("")),
  estimatedMinutes: z.coerce.number().int().min(0).max(100000).optional(),
});

export const updateBookSchema = createBookSchema.extend({
  id: z.string().min(1),
});

export const createBookChapterSchema = z.object({
  bookId: z.string().min(1),
  title: z.string().min(2),
  ordering: z.coerce.number().int().optional(),
});

export const updateBookChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2),
  ordering: z.coerce.number().int().optional(),
});

export const createReadingPlanSchema = z.object({
  studentId: z.string().min(1),
  bookId: z.string().min(1, "انتخاب کتاب الزامی است."),
  startDate: z.string().min(1, "تاریخ شروع الزامی است."),
  deadline: z.string().optional().or(z.literal("")),
  status: readingStatusEnum.optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  mentorNote: z.string().optional().or(z.literal("")),
});

export const updateReadingPlanSchema = z.object({
  id: z.string().min(1),
  status: readingStatusEnum,
  progress: z.coerce.number().int().min(0).max(100),
  mentorNote: z.string().optional().or(z.literal("")),
});

export type BookListItem = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  coverPath: string | null;
  difficulty: string | null;
  estimatedMinutes: number | null;
  planCount: number;
  createdAt: string;
};

export type ReadingPlanItem = {
  id: string;
  studentId: string;
  studentName: string | null;
  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
  bookDescription: string | null;
  coverPath: string | null;
  difficulty: string | null;
  estimatedMinutes: number | null;
  startDate: string;
  deadline: string | null;
  status: string;
  progress: number;
  mentorNote: string | null;
  createdAt: string;
};

function baseBookQuery() {
  return db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      description: books.description,
      coverPath: books.coverPath,
      difficulty: books.difficulty,
      estimatedMinutes: books.estimatedMinutes,
      planCount: sql<number>`(select count(*) from ${readingPlans} where ${readingPlans.bookId} = ${books.id})`,
      createdAt: books.createdAt,
    })
    .from(books);
}

export function listBooks(
  filters: { search?: string; difficulty?: string } = {},
): BookListItem[] {
  const conditions = [];
  if (filters.difficulty) conditions.push(eq(books.difficulty, filters.difficulty));
  if (filters.search) conditions.push(like(books.title, `%${filters.search}%`));

  return baseBookQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(books.title))
    .all()
    .map((row) => ({ ...row, planCount: Number(row.planCount ?? 0) })) as BookListItem[];
}

export function getBookById(id: string): BookListItem | undefined {
  const row = baseBookQuery().where(eq(books.id, id)).get();
  return row ? ({ ...row, planCount: Number(row.planCount ?? 0) } as BookListItem) : undefined;
}

export function createBook(input: z.infer<typeof createBookSchema>) {
  const id = createId("bok");
  db.insert(books)
    .values({
      id,
      title: input.title,
      author: input.author || null,
      description: input.description || null,
      coverPath: input.coverPath || null,
      difficulty: input.difficulty || null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      createdAt: nowIso(),
    })
    .run();

  return getBookById(id);
}

export function updateBook(input: z.infer<typeof updateBookSchema>) {
  const existing = db.select().from(books).where(eq(books.id, input.id)).get();
  if (!existing) throw new Error("کتاب یافت نشد.");

  db.update(books)
    .set({
      title: input.title,
      author: input.author || null,
      description: input.description || null,
      coverPath: input.coverPath || existing.coverPath,
      difficulty: input.difficulty || null,
      estimatedMinutes: input.estimatedMinutes ?? null,
    })
    .where(eq(books.id, input.id))
    .run();

  return getBookById(input.id);
}

export function deleteBook(id: string) {
  const inUse = db.select().from(readingPlans).where(eq(readingPlans.bookId, id)).get();
  if (inUse) throw new Error("این کتاب در برنامه مطالعاتی استفاده شده و حذف نمی‌شود.");
  db.delete(books).where(eq(books.id, id)).run();
}

/* ------------------------------ فصل‌های کتاب ------------------------------ */

export function createBookChapter(input: z.infer<typeof createBookChapterSchema>) {
  const book = db.select().from(books).where(eq(books.id, input.bookId)).get();
  if (!book) throw new Error("کتاب یافت نشد.");

  const ordering =
    input.ordering ??
    db.select().from(bookChapters).where(eq(bookChapters.bookId, input.bookId)).all().length + 1;

  const id = createId("bch");
  db.insert(bookChapters)
    .values({
      id,
      bookId: input.bookId,
      title: input.title,
      ordering,
      createdAt: nowIso(),
    })
    .run();
  return db.select().from(bookChapters).where(eq(bookChapters.id, id)).get()!;
}

export function updateBookChapter(input: z.infer<typeof updateBookChapterSchema>) {
  const existing = db.select().from(bookChapters).where(eq(bookChapters.id, input.id)).get();
  if (!existing) throw new Error("فصل یافت نشد.");

  db.update(bookChapters)
    .set({
      title: input.title,
      ordering: input.ordering ?? existing.ordering,
    })
    .where(eq(bookChapters.id, input.id))
    .run();
  return db.select().from(bookChapters).where(eq(bookChapters.id, input.id)).get()!;
}

export function deleteBookChapter(id: string) {
  db.delete(bookChapters).where(eq(bookChapters.id, id)).run();
}

export function listBookChapters(bookId: string) {
  return db
    .select()
    .from(bookChapters)
    .where(eq(bookChapters.bookId, bookId))
    .orderBy(asc(bookChapters.ordering))
    .all();
}

export function getBookChapterById(id: string) {
  return db.select().from(bookChapters).where(eq(bookChapters.id, id)).get();
}

/* ------------------------------ برنامه مطالعاتی ------------------------------ */

function readingPlanQuery() {
  return db
    .select({
      id: readingPlans.id,
      studentId: readingPlans.studentId,
      studentName: users.fullName,
      bookId: readingPlans.bookId,
      bookTitle: books.title,
      bookAuthor: books.author,
      bookDescription: books.description,
      coverPath: books.coverPath,
      difficulty: books.difficulty,
      estimatedMinutes: books.estimatedMinutes,
      startDate: readingPlans.startDate,
      deadline: readingPlans.deadline,
      status: readingPlans.status,
      progress: readingPlans.progress,
      mentorNote: readingPlans.mentorNote,
      createdAt: readingPlans.createdAt,
    })
    .from(readingPlans)
    .innerJoin(books, eq(readingPlans.bookId, books.id))
    .innerJoin(students, eq(readingPlans.studentId, students.id))
    .leftJoin(users, eq(students.userId, users.id));
}

/**
 * وضعیت عقب‌افتاده محاسبه‌ای است تا بدون job زمان‌بندی‌شده هم درست نمایش داده شود؛
 * مقدار ذخیره‌شده در DB فقط با اقدام مربی تغییر می‌کند.
 */
function withDerivedStatus(plan: ReadingPlanItem): ReadingPlanItem {
  if (
    plan.status !== READING_PLAN_STATUS.COMPLETED &&
    plan.deadline &&
    new Date(plan.deadline).getTime() < Date.now()
  ) {
    return { ...plan, status: READING_PLAN_STATUS.OVERDUE };
  }
  return plan;
}

export function listReadingPlansForStudent(studentId: string): ReadingPlanItem[] {
  return (
    readingPlanQuery()
      .where(eq(readingPlans.studentId, studentId))
      .orderBy(desc(readingPlans.createdAt))
      .all() as ReadingPlanItem[]
  ).map(withDerivedStatus);
}

export function listReadersForBook(bookId: string): ReadingPlanItem[] {
  return (
    readingPlanQuery()
      .where(eq(readingPlans.bookId, bookId))
      .orderBy(desc(readingPlans.createdAt))
      .all() as ReadingPlanItem[]
  ).map(withDerivedStatus);
}

export function bookDashboardStats(bookId: string) {
  const readers = listReadersForBook(bookId);
  const chapters = listBookChapters(bookId);
  const completed = readers.filter((r) => r.status === READING_PLAN_STATUS.COMPLETED).length;
  const inProgress = readers.filter((r) => r.status === READING_PLAN_STATUS.IN_PROGRESS).length;
  const overdue = readers.filter((r) => r.status === READING_PLAN_STATUS.OVERDUE).length;
  const avgProgress =
    readers.length === 0
      ? 0
      : Math.round(readers.reduce((sum, r) => sum + r.progress, 0) / readers.length);

  return {
    readerCount: readers.length,
    chapterCount: chapters.length,
    completed,
    inProgress,
    overdue,
    avgProgress,
  };
}

export function getReadingPlanById(id: string): ReadingPlanItem | undefined {
  const plan = readingPlanQuery().where(eq(readingPlans.id, id)).get() as
    | ReadingPlanItem
    | undefined;
  return plan ? withDerivedStatus(plan) : undefined;
}

export function createReadingPlan(input: z.infer<typeof createReadingPlanSchema>) {
  const student = db.select().from(students).where(eq(students.id, input.studentId)).get();
  if (!student) throw new Error("دانش‌آموز یافت نشد.");

  const book = db.select().from(books).where(eq(books.id, input.bookId)).get();
  if (!book) throw new Error("کتاب یافت نشد.");

  const duplicate = db
    .select()
    .from(readingPlans)
    .where(
      and(eq(readingPlans.studentId, input.studentId), eq(readingPlans.bookId, input.bookId)),
    )
    .get();
  if (duplicate) throw new Error("این کتاب قبلاً در برنامه مطالعاتی دانش‌آموز ثبت شده است.");

  const id = createId("rdp");
  db.insert(readingPlans)
    .values({
      id,
      studentId: input.studentId,
      bookId: input.bookId,
      startDate: input.startDate,
      deadline: input.deadline || null,
      status: input.status ?? READING_PLAN_STATUS.NOT_STARTED,
      progress: input.progress ?? 0,
      mentorNote: input.mentorNote || null,
      createdAt: nowIso(),
    })
    .run();

  return getReadingPlanById(id);
}

export function updateReadingPlan(input: z.infer<typeof updateReadingPlanSchema>) {
  const existing = db.select().from(readingPlans).where(eq(readingPlans.id, input.id)).get();
  if (!existing) throw new Error("برنامه مطالعاتی یافت نشد.");

  const progress = input.status === READING_PLAN_STATUS.COMPLETED ? 100 : input.progress;

  db.update(readingPlans)
    .set({
      status: input.status,
      progress,
      mentorNote: input.mentorNote || existing.mentorNote,
    })
    .where(eq(readingPlans.id, input.id))
    .run();

  return getReadingPlanById(input.id);
}

/** به‌روزرسانی پیشرفت توسط خود دانش‌آموز؛ وضعیت از روی درصد استنتاج می‌شود. */
export function setReadingProgress(id: string, progress: number) {
  const existing = db.select().from(readingPlans).where(eq(readingPlans.id, id)).get();
  if (!existing) throw new Error("برنامه مطالعاتی یافت نشد.");

  const clamped = Math.min(100, Math.max(0, Math.round(progress)));
  const status =
    clamped >= 100
      ? READING_PLAN_STATUS.COMPLETED
      : clamped > 0
        ? READING_PLAN_STATUS.IN_PROGRESS
        : READING_PLAN_STATUS.NOT_STARTED;

  db.update(readingPlans)
    .set({ status, progress: clamped })
    .where(eq(readingPlans.id, id))
    .run();

  return getReadingPlanById(id);
}

export function deleteReadingPlan(id: string) {
  db.delete(readingPlans).where(eq(readingPlans.id, id)).run();
}
