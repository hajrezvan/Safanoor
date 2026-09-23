import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { schoolExams, schoolAttempts } from "@/db/schema";
import { requireUser } from "@/server/auth/guards";
import * as school from "@/server/modules/school/service";
import { StudentShell } from "@/components/patterns/student-shell";
import { SchoolNav } from "@/components/school/nav";
import { SchoolForm } from "@/components/school/form";
import { SchoolAttempt } from "@/components/school/attempt";
import { Panel, statusLabels } from "@/components/school/shared";
import { toFaDigits } from "@/lib/digits";
export const runtime = "nodejs";
export default async function SchoolExam({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const actor = await requireUser();
  const student = school.studentFor(actor);
  const { id } = await params;
  const query = await searchParams;
  const exam = db
    .select()
    .from(schoolExams)
    .where(eq(schoolExams.id, id))
    .get();
  if (!exam) notFound();
  let content: React.ReactNode;
  if (query.attempt) {
    let attempt;
    try {
      attempt = school.studentAttempt(actor, query.attempt);
    } catch {
      notFound();
    }
    if (attempt.examId !== id) notFound();
    content =
      attempt.status === "in_progress" ? (
        <SchoolAttempt attempt={attempt} />
      ) : (
        <Panel title="نتیجه آزمون">
          <p className="mb-4 text-lg font-bold">
            {statusLabels[attempt.status]}
            {attempt.score !== null
              ? ` · ${toFaDigits(attempt.score)}٪ · ${attempt.score >= attempt.passingPercent ? "قبول" : "نیاز به تلاش دوباره"}`
              : " · نتیجه هنوز منتشر نشده است"}
          </p>
          {attempt.bonusAwarded > 0 ? (
            <p className="mb-4 rounded-xl bg-[var(--brand-soft)] p-3 text-sm font-bold text-[var(--brand)]">
              {toFaDigits(attempt.bonusAwarded)} امتیاز قبولی دریافت کردید.
            </p>
          ) : null}
          {attempt.questions.map((q) => (
            <div
              className="border-t border-[var(--border)] py-4 leading-8"
              key={q.id}
            >
              <p className="font-bold">{q.prompt}</p>
              <p>
                پاسخ شما:{" "}
                {q.type === "multiple_choice"
                  ? (q.options.find((o) => o.key === attempt.answers[q.id])
                      ?.text ?? "بدون پاسخ")
                  : attempt.answers[q.id] || "بدون پاسخ"}
              </p>
              {attempt.grades[q.id] && (
                <p>
                  {toFaDigits(attempt.grades[q.id].points)} از{" "}
                  {toFaDigits(q.points)} — {attempt.grades[q.id].feedback}
                </p>
              )}
              {q.answer && (
                <p>
                  پاسخ مرجع:{" "}
                  {q.options.find((o) => o.key === q.answer)?.text ?? q.answer}
                </p>
              )}
            </div>
          ))}
          <Link
            href={`/student/school/exams/${id}`}
            className="text-[var(--brand)]"
          >
            بازگشت به آزمون ←
          </Link>
        </Panel>
      );
  } else {
    try {
      school.courseAccess(student.id, exam.courseId);
    } catch {
      notFound();
    }
    if (exam.status !== "published") notFound();
    let error = "";
    try {
      school.examAccess(student.id, id);
    } catch (e) {
      error = e instanceof Error ? e.message : "آزمون قفل است.";
    }
    const attempts = db
      .select()
      .from(schoolAttempts)
      .where(
        and(
          eq(schoolAttempts.studentId, student.id),
          eq(schoolAttempts.examId, id),
        ),
      )
      .orderBy(desc(schoolAttempts.startedAt))
      .all();
    content = (
      <>
        <Panel title={exam.title}>
          <div className="mb-5 space-y-2 text-sm leading-7">
            <p>
              {toFaDigits(exam.questionCount)} سؤال ·{" "}
              {toFaDigits(exam.durationMinutes)} دقیقه
            </p>
            <p>حد نصاب قبولی: {toFaDigits(exam.passingPercent)}٪</p>
            <p>امتیاز یک‌باره قبولی: {toFaDigits(exam.passBonusPoints)}</p>
            <p>
              تلاش‌های استفاده‌شده: {toFaDigits(attempts.length)} از{" "}
              {toFaDigits(exam.maxAttempts)}
            </p>
          </div>
          {error ? (
            <p className="rounded-xl bg-[var(--muted)] p-4">{error}</p>
          ) : (
            <SchoolForm
              operation="start"
              hidden={{ examId: id }}
              submit="شروع / ادامه آزمون"
              destination={`/student/school/exams/${id}?attempt=:id`}
            />
          )}
        </Panel>
        <Panel title="تلاش‌های من">
          {attempts.map((a) => (
            <Link
              key={a.id}
              href={`/student/school/exams/${id}?attempt=${a.id}`}
              className="block border-b border-[var(--border)] py-3"
            >
              {new Date(a.startedAt).toLocaleString("fa-IR")} ·{" "}
              {statusLabels[a.status]} ←
            </Link>
          ))}
          {!attempts.length && <p>هنوز تلاشی ثبت نشده است.</p>}
        </Panel>
      </>
    );
  }
  return (
    <StudentShell user={actor} title={exam.title}>
      <SchoolNav />
      {content}
    </StudentShell>
  );
}
