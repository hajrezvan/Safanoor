import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { toFaDigits } from "@/lib/digits";
import { EXAM_ATTEMPT_STATUS, EXAM_PASS_SCORE, ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { startExamAttemptAction } from "@/server/actions/exams";
import { listReadingPlansForStudent } from "@/server/modules/books/service";
import {
  getAttempt,
  getExamById,
  isExamPassed,
  syncAttemptExpiry,
} from "@/server/modules/exams/service";
import { getStudentByUserId } from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function ExamResultPage({
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

  const attempt = syncAttemptExpiry(examId, student.id) ?? getAttempt(examId, student.id);
  if (!attempt) {
    redirect(`/student/library/${bookId}/exams/${examId}`);
  }
  if (attempt.status === EXAM_ATTEMPT_STATUS.IN_PROGRESS) {
    redirect(`/student/library/${bookId}/exams/${examId}/take`);
  }

  const score = attempt.score ?? 0;
  const passed = isExamPassed(score);
  const endedByExpiry = attempt.status === EXAM_ATTEMPT_STATUS.EXPIRED;

  return (
    <StudentShell user={user} title="نتیجه آزمون">
      <PageHeader
        title={exam.title}
        description={`کتاب ${plan.bookTitle}`}
        actions={
          <Link
            href={`/student/library/${bookId}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "bg-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]",
            )}
          >
            بازگشت به کتاب
          </Link>
        }
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm text-[var(--muted-foreground)]">نمره نهایی</p>
        <p className="mt-2 text-4xl font-bold text-[var(--brand)] tabular-nums">
          {toFaDigits(score)}٪
        </p>
        <p
          className={`mt-3 text-sm font-bold ${
            passed ? "text-[var(--accent-green)]" : "text-[var(--danger)]"
          }`}
        >
          {passed ? "قبول" : "مردود"}
        </p>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          حد نصاب قبولی: {toFaDigits(EXAM_PASS_SCORE)}٪
        </p>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          {endedByExpiry
            ? "زمان آزمون به پایان رسید و پاسخ‌ها ثبت شد."
            : "آزمون با موفقیت به پایان رسید."}
        </p>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          گزینهٔ صحیح نمایش داده نمی‌شود.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {!passed ? (
            <form action={startExamAttemptAction}>
              <input type="hidden" name="examId" value={examId} />
              <input type="hidden" name="bookId" value={bookId} />
              <Button type="submit">شرکت مجدد</Button>
            </form>
          ) : null}
          <Link
            href={`/student/library/${bookId}`}
            className={cn(buttonVariants({ variant: passed ? "default" : "outline" }))}
          >
            بازگشت به کتاب
          </Link>
        </div>
      </div>
    </StudentShell>
  );
}
