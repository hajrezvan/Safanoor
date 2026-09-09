import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { toFaDigits } from "@/lib/digits";
import { EXAM_ATTEMPT_STATUS, ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { startExamAttemptAction } from "@/server/actions/exams";
import {
  getExamById,
  getExamPrepInfo,
  isExamPassed,
  remainingMs,
  syncAttemptExpiry,
  toStudentExam,
} from "@/server/modules/exams/service";
import { listReadingPlansForStudent } from "@/server/modules/books/service";
import { getStudentByUserId } from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function ExamPrepPage({
  params,
}: {
  params: Promise<{ bookId: string; examId: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const { bookId, examId } = await params;
  const student = getStudentByUserId(user.id);
  if (!student) notFound();

  const plan = listReadingPlansForStudent(student.id).find((p) => p.bookId === bookId);
  if (!plan) notFound();

  const exam = getExamById(examId);
  if (!exam) notFound();
  const prep = getExamPrepInfo(examId);
  if (!prep) notFound();

  void toStudentExam(exam);

  const attempt = syncAttemptExpiry(examId, student.id);
  const inProgress =
    attempt?.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS && remainingMs(attempt) > 0;
  const finished =
    attempt?.status === EXAM_ATTEMPT_STATUS.COMPLETED ||
    attempt?.status === EXAM_ATTEMPT_STATUS.EXPIRED;
  const passed = isExamPassed(attempt?.score);

  if (inProgress) {
    redirect(`/student/library/${bookId}/exams/${examId}/take`);
  }
  if (finished && passed) {
    redirect(`/student/library/${bookId}/exams/${examId}/result`);
  }

  const isRetake = finished && !passed;

  return (
    <StudentShell user={user} title="آمادگی آزمون">
      <PageHeader
        title={prep.title}
        description={`کتاب ${plan.bookTitle}`}
        actions={
          <Link
            href={`/student/library/${bookId}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "bg-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]",
            )}
          >
            بازگشت
          </Link>
        }
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-base font-bold">مشخصات آزمون</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--muted)] px-4 py-3">
            <dt className="text-[var(--muted-foreground)]">تعداد سوالات این نوبت</dt>
            <dd className="font-bold">{toFaDigits(prep.questionCount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--muted)] px-4 py-3">
            <dt className="text-[var(--muted-foreground)]">اندازه بانک سوالات</dt>
            <dd className="font-bold">{toFaDigits(prep.bankSize)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--muted)] px-4 py-3">
            <dt className="text-[var(--muted-foreground)]">مدت زمان</dt>
            <dd className="font-bold">
              {toFaDigits(prep.durationMinutes)} دقیقه
              <span className="ms-1 text-xs font-normal text-[var(--muted-foreground)]">
                ({toFaDigits(prep.secondsPerQuestion)} ثانیه برای هر سوال)
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--muted)] px-4 py-3">
            <dt className="text-[var(--muted-foreground)]">نمره قبولی</dt>
            <dd className="font-bold">{toFaDigits(prep.passScore)}٪</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--muted)] px-4 py-3">
            <dt className="text-[var(--muted-foreground)]">بازگشت به سوال قبل</dt>
            <dd className="font-bold">{prep.allowBack ? "مجاز" : "غیرمجاز"}</dd>
          </div>
        </dl>

        <p className="mt-4 text-xs leading-6 text-[var(--muted-foreground)]">
          سوالات از بانک به‌صورت تصادفی انتخاب می‌شوند
          {isRetake ? "؛ در تلاش مجدد، سوالات دیده‌نشده اولویت دارند" : ""}. با شروع آزمون،
          زمان‌سنج فعال می‌شود. اگر از صفحه خارج شوید و هنوز زمان داشته باشید، می‌توانید ادامه
          دهید. با اتمام زمان، آزمون به‌صورت خودکار بسته می‌شود. در صورت مردودی می‌توانید دوباره
          شرکت کنید.
        </p>

        {isRetake && attempt?.score != null ? (
          <p className="mt-3 rounded-xl bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            نمره قبلی: {toFaDigits(attempt.score)}٪ (کمتر از حد نصاب{" "}
            {toFaDigits(prep.passScore)}٪)
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <form action={startExamAttemptAction}>
            <input type="hidden" name="examId" value={examId} />
            <input type="hidden" name="bookId" value={bookId} />
            <Button type="submit">{isRetake ? "شرکت مجدد" : "شروع آزمون"}</Button>
          </form>
          {isRetake ? (
            <Link
              href={`/student/library/${bookId}/exams/${examId}/result`}
              className={cn(buttonVariants({ variant: "outline", size: "default" }))}
            >
              مشاهده نتیجه قبلی
            </Link>
          ) : null}
        </div>
      </div>
    </StudentShell>
  );
}
