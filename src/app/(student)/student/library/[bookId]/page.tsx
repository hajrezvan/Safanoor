import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { buttonVariants } from "@/components/ui/button";
import { toFaDigits } from "@/lib/digits";
import { EXAM_ATTEMPT_STATUS, READING_PLAN_STATUS_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import {
  listBookChapters,
  listReadingPlansForStudent,
} from "@/server/modules/books/service";
import {
  getAttempt,
  getBookExamProgress,
  isAttemptFinished,
  isExamPassed,
  listExamsForBookChapters,
  remainingMs,
  syncAttemptExpiry,
  toStudentExam,
} from "@/server/modules/exams/service";
import { getStudentByUserId } from "@/server/modules/students/service";

export const runtime = "nodejs";

function coverSrc(coverPath: string | null | undefined) {
  if (!coverPath?.trim()) return null;
  if (coverPath.startsWith("http") || coverPath.startsWith("/")) return coverPath;
  return `/uploads/${coverPath}`;
}

function examCtaLabel(opts: {
  finished: boolean;
  passed: boolean;
  inProgress: boolean;
}): string {
  if (opts.inProgress) return "ادامه آزمون";
  if (opts.finished && opts.passed) return "مشاهده نتیجه";
  if (opts.finished && !opts.passed) return "شرکت مجدد";
  return "شرکت در آزمون";
}

export default async function StudentLibraryBookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const { bookId } = await params;
  const student = getStudentByUserId(user.id);
  if (!student) notFound();

  const plan = listReadingPlansForStudent(student.id).find((p) => p.bookId === bookId);
  if (!plan) notFound();

  const chapters = listBookChapters(bookId);
  const exams = listExamsForBookChapters(chapters.map((c) => c.id)).map(toStudentExam);
  const src = coverSrc(plan.coverPath);
  const bookDescription = plan.bookDescription?.trim() || null;
  const mentorNote = plan.mentorNote?.trim() || null;
  const statusLabel = READING_PLAN_STATUS_TITLES_FA[plan.status] ?? plan.status;
  const examProgress = getBookExamProgress(
    chapters.map((c) => c.id),
    student.id,
  );
  const progress = examProgress.percent;

  return (
    <StudentShell user={user} title={plan.bookTitle}>
      <PageHeader
        title={plan.bookTitle}
        description={
          plan.bookAuthor ? `${plan.bookAuthor} · ${statusLabel}` : statusLabel
        }
        actions={
          <Link
            href="/student/library"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]",
            )}
          >
            بازگشت
          </Link>
        }
      />

      <div className="mb-8 flex flex-col items-center text-center">
        <div className="w-44 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] shadow-[var(--shadow-sm)] sm:w-52">
          <div className="relative aspect-[3/4] w-full">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-[var(--brand)]">
                <BookOpen className="size-16 opacity-80" aria-hidden />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 w-full max-w-lg space-y-2">
          <h2 className="text-lg font-bold leading-8">{plan.bookTitle}</h2>
          {plan.bookAuthor ? (
            <p className="text-sm text-[var(--muted-foreground)]">{plan.bookAuthor}</p>
          ) : null}
          {bookDescription ? (
            <p className="text-sm leading-7 text-[var(--muted-foreground)]">{bookDescription}</p>
          ) : null}
          {mentorNote ? (
            <p className="rounded-xl bg-[var(--brand-soft)]/60 px-3 py-2 text-sm leading-7 text-[var(--foreground)]">
              {mentorNote}
            </p>
          ) : null}
          <div className="pt-1 text-start">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
              <span>پیشرفت مطالعه</span>
              <span className="font-medium text-[var(--brand)] tabular-nums">
                {toFaDigits(progress)}٪
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={`پیشرفت مطالعه ${toFaDigits(progress)} درصد`}
            >
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {examProgress.total > 0 ? (
              <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                {toFaDigits(examProgress.passed)} از {toFaDigits(examProgress.total)} آزمون قبول‌شده
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-base font-bold">سرفصل‌ها و آزمون‌ها</h2>
      {chapters.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">فصلی برای این کتاب ثبت نشده است.</p>
      ) : (
        <div className="space-y-4">
          {chapters.map((ch) => {
            const chapterExams = exams.filter((e) => e.relatedId === ch.id);
            return (
              <section
                key={ch.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)]/40 p-4"
              >
                <h3 className="text-sm font-bold">
                  {toFaDigits(ch.ordering)}. {ch.title}
                </h3>

                {chapterExams.length === 0 ? (
                  <p className="mt-3 text-xs text-[var(--muted-foreground)]">آزمونی برای این فصل نیست.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {chapterExams.map((exam) => {
                      const attempt =
                        syncAttemptExpiry(exam.id, student.id) ??
                        getAttempt(exam.id, student.id);
                      const finished = isAttemptFinished(attempt);
                      const passed = isExamPassed(attempt?.score);
                      const inProgress =
                        attempt?.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS &&
                        remainingMs(attempt) > 0;
                      const href =
                        finished && passed
                          ? `/student/library/${bookId}/exams/${exam.id}/result`
                          : inProgress
                            ? `/student/library/${bookId}/exams/${exam.id}/take`
                            : `/student/library/${bookId}/exams/${exam.id}`;
                      return (
                        <div
                          key={exam.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                        >
                          <div className="min-w-0 text-start">
                            <p className="text-sm font-medium">{exam.title}</p>
                            {finished && attempt?.score != null ? (
                              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                {passed ? "قبول" : "مردود"} · نمره {toFaDigits(attempt.score)}٪
                              </p>
                            ) : inProgress ? (
                              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                آزمون در حال انجام — می‌توانید ادامه دهید
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                آزمون زمان‌دار از بانک سوالات
                              </p>
                            )}
                          </div>
                          <Link
                            href={href}
                            className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
                          >
                            {examCtaLabel({ finished, passed, inProgress })}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}
