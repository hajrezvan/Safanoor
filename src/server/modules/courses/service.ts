import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  courseChapters,
  coursePrerequisites,
  courses,
  lessonContents,
  lessons,
} from "@/db/schema/learning";
import { progressRecords } from "@/db/schema/activities";
import { createId, nowIso } from "@/lib/id";
import { COURSE_STATUS, LESSON_CONTENT_TYPE, PROGRESS_RELATED_TYPE, PROGRESS_STATUS } from "@/lib/enums";

const LESSON_PROGRESS_TYPE = PROGRESS_RELATED_TYPE.LESSON;

const contentTypeEnum = z.enum([
  LESSON_CONTENT_TYPE.TEXT,
  LESSON_CONTENT_TYPE.VIDEO,
  LESSON_CONTENT_TYPE.AUDIO,
  LESSON_CONTENT_TYPE.FILE,
  LESSON_CONTENT_TYPE.LINK,
  LESSON_CONTENT_TYPE.PDF,
  LESSON_CONTENT_TYPE.APARAT,
]);

export const createCourseSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  coverPath: z.string().optional().or(z.literal("")),
  ordering: z.coerce.number().int().default(0),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const updateCourseSchema = createCourseSchema.extend({
  id: z.string().min(1),
});

export const createChapterSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(2),
  ordering: z.coerce.number().int().optional(),
});

export const setPrerequisiteSchema = z.object({
  courseId: z.string().min(1),
  prerequisiteCourseId: z.string().min(1),
});

export const createLessonSchema = z.object({
  courseId: z.string().min(1),
  chapterId: z.string().optional().or(z.literal("")),
  title: z.string().min(2),
  ordering: z.coerce.number().int().default(0),
  contentType: contentTypeEnum,
  description: z.string().optional(),
});

export const upsertLessonContentSchema = z.object({
  lessonId: z.string().min(1),
  body: z.string().optional(),
  url: z.string().optional(),
  filePath: z.string().optional(),
});

export type CourseListItem = {
  id: string;
  title: string;
  description: string | null;
  coverPath: string | null;
  status: string;
  ordering: number;
  createdAt: string;
  lessonCount: number;
};

export type CourseListFilters = {
  search?: string;
  status?: string;
};

function courseBaseQuery() {
  const lessonCount = sql<number>`(
    select count(*) from ${lessons} where ${lessons.courseId} = ${courses.id}
  )`;

  return db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      coverPath: courses.coverPath,
      status: courses.status,
      ordering: courses.ordering,
      createdAt: courses.createdAt,
      lessonCount,
    })
    .from(courses);
}

function decorateCourse(row: Omit<CourseListItem, "lessonCount"> & { lessonCount: number | null }): CourseListItem {
  return { ...row, lessonCount: Number(row.lessonCount ?? 0) };
}

export function listCourses(opts?: CourseListFilters): CourseListItem[] {
  const conditions = [];
  if (opts?.status) conditions.push(eq(courses.status, opts.status));
  if (opts?.search) conditions.push(like(courses.title, `%${opts.search}%`));

  return courseBaseQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(courses.ordering), desc(courses.createdAt))
    .all()
    .map(decorateCourse);
}

export function getCourseById(id: string): CourseListItem | undefined {
  const row = courseBaseQuery().where(eq(courses.id, id)).get();
  return row ? decorateCourse(row) : undefined;
}

export function createCourse(input: z.infer<typeof createCourseSchema>) {
  const id = createId("crs");
  const now = nowIso();
  db.insert(courses)
    .values({
      id,
      title: input.title,
      description: input.description ?? null,
      coverPath: input.coverPath || "/covers/course-default.svg",
      status: input.status ?? COURSE_STATUS.PUBLISHED,
      ordering: input.ordering,
      createdAt: now,
    })
    .run();
  return getCourseById(id)!;
}

export function updateCourse(input: z.infer<typeof updateCourseSchema>) {
  const existing = db.select().from(courses).where(eq(courses.id, input.id)).get();
  if (!existing) throw new Error("دوره یافت نشد.");

  db.update(courses)
    .set({
      title: input.title,
      description: input.description ?? null,
      coverPath: input.coverPath || existing.coverPath,
      status: input.status ?? existing.status,
      ordering: input.ordering,
    })
    .where(eq(courses.id, input.id))
    .run();

  return getCourseById(input.id);
}

export function createChapter(input: z.infer<typeof createChapterSchema>) {
  const course = db.select().from(courses).where(eq(courses.id, input.courseId)).get();
  if (!course) throw new Error("دوره یافت نشد.");

  const ordering =
    input.ordering ??
    db.select().from(courseChapters).where(eq(courseChapters.courseId, input.courseId)).all()
      .length + 1;

  const id = createId("cch");
  db.insert(courseChapters)
    .values({
      id,
      courseId: input.courseId,
      title: input.title,
      ordering,
      createdAt: nowIso(),
    })
    .run();
  return db.select().from(courseChapters).where(eq(courseChapters.id, id)).get()!;
}

export function listChapters(courseId: string) {
  return db
    .select()
    .from(courseChapters)
    .where(eq(courseChapters.courseId, courseId))
    .orderBy(asc(courseChapters.ordering))
    .all();
}

export function setPrerequisite(input: z.infer<typeof setPrerequisiteSchema>) {
  if (input.courseId === input.prerequisiteCourseId) {
    throw new Error("دوره نمی‌تواند پیش‌نیاز خودش باشد.");
  }
  const course = db.select().from(courses).where(eq(courses.id, input.courseId)).get();
  const prereq = db
    .select()
    .from(courses)
    .where(eq(courses.id, input.prerequisiteCourseId))
    .get();
  if (!course || !prereq) throw new Error("دوره یافت نشد.");

  const existing = db
    .select()
    .from(coursePrerequisites)
    .where(
      and(
        eq(coursePrerequisites.courseId, input.courseId),
        eq(coursePrerequisites.prerequisiteCourseId, input.prerequisiteCourseId),
      ),
    )
    .get();
  if (existing) return existing;

  const id = createId("cpr");
  db.insert(coursePrerequisites)
    .values({
      id,
      courseId: input.courseId,
      prerequisiteCourseId: input.prerequisiteCourseId,
    })
    .run();
  return db.select().from(coursePrerequisites).where(eq(coursePrerequisites.id, id)).get()!;
}

export function listPrerequisites(courseId: string) {
  return db
    .select({
      id: coursePrerequisites.id,
      courseId: coursePrerequisites.courseId,
      prerequisiteCourseId: coursePrerequisites.prerequisiteCourseId,
      title: courses.title,
    })
    .from(coursePrerequisites)
    .innerJoin(courses, eq(coursePrerequisites.prerequisiteCourseId, courses.id))
    .where(eq(coursePrerequisites.courseId, courseId))
    .all();
}

export function createLesson(input: z.infer<typeof createLessonSchema>) {
  const lessonId = createId("les");
  db.insert(lessons)
    .values({
      id: lessonId,
      courseId: input.courseId,
      chapterId: input.chapterId || null,
      title: input.title,
      description: input.description ?? null,
      ordering: input.ordering,
      contentType: input.contentType,
    })
    .run();
  return db.select().from(lessons).where(eq(lessons.id, lessonId)).get()!;
}

export function upsertLessonContent(input: z.infer<typeof upsertLessonContentSchema>) {
  const existing = db
    .select()
    .from(lessonContents)
    .where(eq(lessonContents.lessonId, input.lessonId))
    .get();

  if (existing) {
    db.update(lessonContents)
      .set({
        body: input.body ?? existing.body,
        url: input.url ?? existing.url,
        filePath: input.filePath ?? existing.filePath,
      })
      .where(eq(lessonContents.lessonId, input.lessonId))
      .run();
    return db.select().from(lessonContents).where(eq(lessonContents.lessonId, input.lessonId)).get();
  }

  const id = createId("lcnt");
  db.insert(lessonContents)
    .values({
      id,
      lessonId: input.lessonId,
      body: input.body ?? null,
      filePath: input.filePath ?? null,
      url: input.url ?? null,
    })
    .run();
  return db.select().from(lessonContents).where(eq(lessonContents.lessonId, input.lessonId)).get();
}

export function addLesson(
  courseId: string,
  title: string,
  contentType: z.infer<typeof contentTypeEnum>,
  body?: string,
  url?: string,
  chapterId?: string,
) {
  const ordering =
    db.select().from(lessons).where(eq(lessons.courseId, courseId)).all().length + 1;
  const lesson = createLesson({
    courseId,
    chapterId: chapterId ?? "",
    title,
    ordering,
    contentType,
  });
  upsertLessonContent({ lessonId: lesson.id, body, url });
  return lesson.id;
}

export function listLessons(courseId: string, chapterId?: string) {
  const conditions = [eq(lessons.courseId, courseId)];
  if (chapterId) conditions.push(eq(lessons.chapterId, chapterId));

  return db
    .select({
      id: lessons.id,
      courseId: lessons.courseId,
      chapterId: lessons.chapterId,
      title: lessons.title,
      description: lessons.description,
      ordering: lessons.ordering,
      contentType: lessons.contentType,
      body: lessonContents.body,
      url: lessonContents.url,
      filePath: lessonContents.filePath,
    })
    .from(lessons)
    .leftJoin(lessonContents, eq(lessonContents.lessonId, lessons.id))
    .where(and(...conditions))
    .orderBy(asc(lessons.ordering))
    .all();
}

export function getLessonById(lessonId: string) {
  return db
    .select({
      id: lessons.id,
      courseId: lessons.courseId,
      chapterId: lessons.chapterId,
      title: lessons.title,
      description: lessons.description,
      ordering: lessons.ordering,
      contentType: lessons.contentType,
      body: lessonContents.body,
      url: lessonContents.url,
      filePath: lessonContents.filePath,
      courseTitle: courses.title,
    })
    .from(lessons)
    .leftJoin(lessonContents, eq(lessonContents.lessonId, lessons.id))
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
}

/** درس قبلی/بعدی در همان دوره بر اساس ترتیب فصل و درس. */
export function getAdjacentLessons(courseId: string, lessonId: string) {
  const ordered = db
    .select({
      id: lessons.id,
      title: lessons.title,
    })
    .from(lessons)
    .leftJoin(courseChapters, eq(lessons.chapterId, courseChapters.id))
    .where(eq(lessons.courseId, courseId))
    .orderBy(sql`coalesce(${courseChapters.ordering}, 999999)`, asc(lessons.ordering))
    .all();

  const index = ordered.findIndex((l) => l.id === lessonId);
  if (index < 0) {
    return { previous: null, next: null };
  }

  return {
    previous: index > 0 ? ordered[index - 1]! : null,
    next: index < ordered.length - 1 ? ordered[index + 1]! : null,
  };
}

/** پیشرفت دوره برای یک دانش‌آموز بر اساس درس‌های تکمیل‌شده. */
export function getCourseProgressForStudent(studentId: string, courseId: string) {
  const course = getCourseById(courseId);
  if (!course) return undefined;
  const courseLessons = listLessons(courseId);
  const lessonCount = courseLessons.length;
  if (lessonCount === 0) {
    return {
      courseId,
      title: course.title,
      coverPath: course.coverPath,
      lessonCount: 0,
      completedCount: 0,
      progressPercent: 0,
    };
  }

  const completedIds = new Set(
    db
      .select({ relatedId: progressRecords.relatedId })
      .from(progressRecords)
      .where(
        and(
          eq(progressRecords.studentId, studentId),
          eq(progressRecords.relatedType, LESSON_PROGRESS_TYPE),
          eq(progressRecords.status, PROGRESS_STATUS.DONE),
        ),
      )
      .all()
      .map((r) => r.relatedId),
  );

  const completedCount = courseLessons.filter((l) => completedIds.has(l.id)).length;
  const progressPercent = Math.round((completedCount / lessonCount) * 100);
  return {
    courseId,
    title: course.title,
    coverPath: course.coverPath,
    lessonCount,
    completedCount,
    progressPercent,
  };
}

export function isLessonCompletedByStudent(studentId: string, lessonId: string) {
  return Boolean(
    db
      .select({ id: progressRecords.id })
      .from(progressRecords)
      .where(
        and(
          eq(progressRecords.studentId, studentId),
          eq(progressRecords.relatedType, LESSON_PROGRESS_TYPE),
          eq(progressRecords.relatedId, lessonId),
          eq(progressRecords.status, PROGRESS_STATUS.DONE),
        ),
      )
      .get(),
  );
}

export function markLessonCompleted(studentId: string, lessonId: string, createdBy: string) {
  const lesson = getLessonById(lessonId);
  if (!lesson) throw new Error("درس یافت نشد.");
  if (isLessonCompletedByStudent(studentId, lessonId)) {
    return getCourseProgressForStudent(studentId, lesson.courseId);
  }
  const now = nowIso();
  db.insert(progressRecords)
    .values({
      id: createId("prg"),
      studentId,
      relatedType: LESSON_PROGRESS_TYPE,
      relatedId: lessonId,
      status: PROGRESS_STATUS.DONE,
      progressPercent: 100,
      reportText: null,
      evidenceUrl: null,
      evidenceFilePath: null,
      mentorFeedback: null,
      recordedAt: now,
      reviewedAt: now,
      createdBy,
      createdAt: now,
    })
    .run();
  return getCourseProgressForStudent(studentId, lesson.courseId);
}

/** پیشرفت ساده دوره برای داشبورد دانش‌آموز/نیرو */
export function getCourseProgressSummary(courseId: string) {
  const course = getCourseById(courseId);
  if (!course) return undefined;
  return {
    courseId,
    title: course.title,
    lessonCount: course.lessonCount,
    progressPercent: 0,
  };
}

export function ensureDemoLearning() {
  if (listCourses().length === 0) {
    const course = createCourse({
      title: "آشنایی با نماز",
      description: "دوره پایه برای انس با نماز و حضور قلب.",
      coverPath: "/covers/course-namaz.svg",
      ordering: 1,
    });
    addLesson(
      course.id,
      "درس اول: نیت و حضور قلب",
      LESSON_CONTENT_TYPE.TEXT,
      "در این درس درباره اهمیت نیت و آرامش در نماز صحبت می‌کنیم.",
    );
    addLesson(
      course.id,
      "درس دوم: آداب ساده نماز",
      LESSON_CONTENT_TYPE.TEXT,
      "آداب ظاهری و باطنی نماز برای نوجوان به زبان ساده.",
    );
    const seerah = createCourse({
      title: "سیره پیامبر و اهل‌بیت",
      description: "داستان‌های کوتاه از سیره پیامبر و اهل‌بیت علیهم‌السلام.",
      coverPath: "/covers/course-seerah.svg",
      ordering: 2,
    });
    addLesson(
      seerah.id,
      "مهربانی اهل‌بیت با مردم",
      LESSON_CONTENT_TYPE.TEXT,
      "نمونه‌ای کوتاه از رفتار مهربانانه اهل‌بیت و درس عملی برای امروز.",
    );
  }
}
