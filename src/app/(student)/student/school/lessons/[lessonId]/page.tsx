import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { StudentShell } from "@/components/patterns/student-shell";
import { LessonDetailTabs } from "@/components/learning/lesson-detail-tabs";
import { LessonMedia } from "@/components/learning/lesson-media";
import { Button, buttonVariants } from "@/components/ui/button";
import { EXAM_RELATED_TYPE, LESSON_CONTENT_TYPE, ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { markLessonCompleteAction } from "@/server/actions/courses";
import { submitExamAction } from "@/server/actions/exams";
import {
  getAdjacentLessons,
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
  const lesson = getLessonById(lessonId);
  if (!lesson) notFound();
  const done = isLessonCompletedByStudent(student.id, lessonId);
  const { previous, next } = getAdjacentLessons(lesson.courseId, lessonId);

  const exams = listExamsForRelated(EXAM_RELATED_TYPE.LESSON, lessonId).map(toStudentExam);
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
            </h1>
            {done ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-green-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-green)]">
                <span className="flex size-4 items-center justify-center rounded-full bg-[var(--accent-green)] text-white">
                  <Check className="size-2.5" strokeWidth={3} aria-hidden />
                </span>
                مشاهده شد.
              </span>
            ) : (
              <form action={markLessonCompleteAction} className="shrink-0">
                <input type="hidden" name="lessonId" value={lessonId} />
                <Button type="submit" size="sm" variant="outline">
                  تکمیل درس
                </Button>
              </form>
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

        <LessonDetailTabs
          lessonId={lessonId}
          body={lesson.body}
          description={lesson.description}
          filePath={showFileInTab ? lesson.filePath ?? lesson.url : null}
          fileLabel={
            lesson.contentType === LESSON_CONTENT_TYPE.PDF ? "دانلود PDF" : "دانلود فایل درس"
          }
          exams={examViews}
          examsCompleted={examsCompleted}
          submitExamAction={submitExam}
          initialNoteBody={lessonNote?.body ?? ""}
          initialNoteUpdatedAt={lessonNote?.updatedAt ?? null}
        />

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
