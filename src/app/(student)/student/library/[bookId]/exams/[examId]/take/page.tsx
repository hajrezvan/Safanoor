import { notFound, redirect } from "next/navigation";
import { StudentShell } from "@/components/patterns/student-shell";
import { TimedExamTaker } from "@/components/exams/timed-exam-taker";
import { EXAM_ATTEMPT_STATUS, ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { listReadingPlansForStudent } from "@/server/modules/books/service";
import {
  ensureAttemptQuestionIds,
  getExamById,
  questionsForAttempt,
  remainingMs,
  syncAttemptExpiry,
} from "@/server/modules/exams/service";
import { getStudentByUserId } from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function ExamTakePage({
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

  let attempt = syncAttemptExpiry(examId, student.id);
  if (!attempt) {
    redirect(`/student/library/${bookId}/exams/${examId}`);
  }
  if (
    attempt.status === EXAM_ATTEMPT_STATUS.COMPLETED ||
    attempt.status === EXAM_ATTEMPT_STATUS.EXPIRED ||
    remainingMs(attempt) <= 0
  ) {
    redirect(`/student/library/${bookId}/exams/${examId}/result`);
  }

  attempt = ensureAttemptQuestionIds(examId, student.id) ?? attempt;
  const questions = questionsForAttempt(examId, attempt.questionIds);
  if (questions.length === 0) notFound();
  const idx = Math.min(Math.max(0, attempt.currentIndex), questions.length - 1);
  const question = questions[idx];
  if (!question) notFound();

  return (
    <StudentShell user={user} title="در حال آزمون">
      <TimedExamTaker
        bookId={bookId}
        examId={examId}
        title={exam.title}
        questionIndex={idx}
        questionCount={questions.length}
        prompt={question.prompt}
        options={question.options}
        initialSelected={attempt.answers[String(idx)] ?? null}
        allowBack={attempt.allowBack}
        expiresAtIso={attempt.expiresAt}
      />
    </StudentShell>
  );
}
