import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { schoolAttachments, schoolExams } from "@/db/schema";
import {
  lessonAccess,
  publishedLessons,
  enrollment,
} from "@/server/modules/school/service";
import { SchoolNav } from "@/components/school/nav";
import { SchoolComments } from "@/components/school/comments";
import { SchoolForm } from "@/components/school/form";
import { Panel } from "@/components/school/shared";
import { LessonViewTracker } from "@/components/school/lesson-view-tracker";
import { notFound } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { StudentShell } from "@/components/patterns/student-shell";
import { LessonDetailTabs } from "@/components/learning/lesson-detail-tabs";
import { LessonMedia } from "@/components/learning/lesson-media";
import { buttonVariants } from "@/components/ui/button";
import { EXAM_RELATED_TYPE, LESSON_CONTENT_TYPE, ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { submitExamAction } from "@/server/actions/exams";
import {
  getLessonById,
  isLessonCompletedByStudent,
} from "@/server/modules/courses/service";
import {
  getStudentSubmission,
  listExamsForRelated,
  toStudentExam,
} from "@/server/modules/exams/service";
import { getLessonNoteForStudent } from "@/server/modules/lesson-notes/service";
import { getStudentByUserId } from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const { lessonId } = await params;
  const student = getStudentByUserId(user.id);
  if (!student) notFound();
  let metadata;
  try {
    metadata = lessonAccess(student.id, lessonId);
  } catch {
    notFound();
  }
  const joined = enrollment(student.id, metadata.courseId);
  const enrolled =
    metadata.courseId === "school_standalone" ||
    (joined && joined.status !== "cancelled");
  const lesson = getLessonById(lessonId);
  if (!lesson) notFound();
  const done = isLessonCompletedByStudent(student.id, lessonId);
  const ordered = publishedLessons(lesson.courseId).filter(
    (l) => enrolled || l.isPreview,
  );
  const index = ordered.findIndex((l) => l.id === lessonId);
  const previous = ordered[index - 1];
  const next = ordered[index + 1];

  const exams = listExamsForRelated(EXAM_RELATED_TYPE.LESSON, lessonId).map(
    toStudentExam,
  );
  const examViews = exams.map((exam) => {
    const submission = getStudentSubmission(exam.id, student.id);
    return {
      id: exam.id,
      title: exam.title,
      prompt: exam.prompt,
      options: exam.options,
      submission: submission
        ? {
            selectedOption: submission.selectedOption,
            answerText: submission.answerText,
            status: submission.status,
            score: submission.score,
            feedback: submission.feedback,
          }
        : null,
    };
  });
  const examsCompleted =
    exams.length > 0 &&
    examViews.every((e) => e.submission?.status === "reviewed");
  const lessonNote = getLessonNoteForStudent(student.id, lessonId);

  const showFileInTab =
    lesson.contentType === LESSON_CONTENT_TYPE.FILE ||
    lesson.contentType === LESSON_CONTENT_TYPE.PDF;

  async function submitExam(formData: FormData) {
    "use server";
    formData.set("lessonId", lessonId);
    await submitExamAction({}, formData);
  }

  return (
    <StudentShell user={user} title={lesson.title}>
      <LessonViewTracker lessonId={lessonId} />
      <SchoolNav />
      <Link
        className="mb-4 block text-sm text-[var(--brand)]"
        href={`/student/school/courses/${lesson.courseId}`}
      >
        {lesson.courseTitle} ←
      </Link>
      <div className="space-y-3">
        <LessonMedia
          contentType={lesson.contentType}
          body={lesson.body}
          url={lesson.url}
          filePath={lesson.filePath}
          title={lesson.title}
          mediaOnly
        />

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-base font-bold leading-7 text-[var(--foreground)] sm:text-lg sm:leading-8">
              {lesson.title}
              <span className="ms-2 text-xs font-normal text-[var(--muted-foreground)]">
                {metadata.viewCount.toLocaleString("fa-IR")} بازدید
              </span>
            </h1>
            {done ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-green-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-green)]">
                <span className="flex size-4 items-center justify-center rounded-full bg-[var(--accent-green)] text-white">
                  <Check className="size-2.5" strokeWidth={3} aria-hidden />
                </span>
                مشاهده شد.
              </span>
            ) : enrolled ? (
              <SchoolForm
                operation="complete"
                hidden={{ lessonId }}
                submit="تکمیل درس"
              />
            ) : (
              <Link
                href={`/student/school/courses/${lesson.courseId}`}
                className="text-sm text-[var(--brand)]"
              >
                ثبت‌نام در دوره
              </Link>
            )}
          </div>
        </div>

        {next ? (
          <Link
            href={`/student/school/lessons/${next.id}`}
            className="inline-flex max-w-full items-center gap-2 rounded-xl bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-opacity hover:opacity-80"
          >
            <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{next.title}</span>
          </Link>
        ) : null}

        {metadata.audioUrl && (
          <audio
            controls
            preload="metadata"
            className="w-full"
            src={metadata.audioUrl}
          />
        )}
        <LessonDetailTabs
          lessonId={lessonId}
          body={lesson.body}
          description={lesson.description}
          filePath={showFileInTab ? (lesson.filePath ?? lesson.url) : null}
          fileLabel={
            lesson.contentType === LESSON_CONTENT_TYPE.PDF
              ? "دانلود PDF"
              : "دانلود فایل درس"
          }
          exams={examViews}
          examsCompleted={examsCompleted}
          submitExamAction={submitExam}
          initialNoteBody={lessonNote?.body ?? ""}
          initialNoteUpdatedAt={lessonNote?.updatedAt ?? null}
        />

        {db
          .select()
          .from(schoolAttachments)
          .where(eq(schoolAttachments.lessonId, lessonId))
          .all()
          .map((a) => (
            <a
              key={a.id}
              href={a.url}
              className="block rounded-xl bg-[var(--muted)] p-3 text-sm"
              target="_blank"
              rel="noreferrer"
            >
              دانلود {a.title}
            </a>
          ))}
        {enrolled && (
          <>
            <Panel title="آزمون‌های مدرسه">
              {db
                .select()
                .from(schoolExams)
                .where(
                  and(
                    eq(schoolExams.courseId, lesson.courseId),
                    eq(schoolExams.status, "published"),
                  ),
                )
                .all()
                .filter(
                  (e) =>
                    e.scope === "course" ||
                    e.scopeId === lessonId ||
                    e.scopeId === lesson.chapterId,
                )
                .map((e) => (
                  <Link
                    key={e.id}
                    className="block py-2 text-sm text-[var(--brand)]"
                    href={`/student/school/exams/${e.id}`}
                  >
                    {e.title} ←
                  </Link>
                ))}
            </Panel>
            <SchoolComments
              actor={user}
              courseId={lesson.courseId}
              lessonId={lessonId}
            />
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {previous ? (
            <Link
              href={`/student/school/lessons/${previous.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              درس قبلی
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/student/school/lessons/${next.id}`}
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              درس بعدی
            </Link>
          ) : null}
        </div>
      </div>
    </StudentShell>
  );
}
