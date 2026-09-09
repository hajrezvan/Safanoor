"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Check, Download, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTimeFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import { cn } from "@/lib/utils";
import {
  saveLessonNoteAction,
  type ActionState,
} from "@/server/actions/lesson-notes";
import type { ExamOption } from "@/server/modules/exams/service";

export type LessonExamView = {
  id: string;
  title: string;
  prompt: string;
  options: ExamOption[];
  submission: {
    selectedOption: string | null;
    answerText: string;
    status: string;
    score: number | null;
    feedback: string | null;
  } | null;
};

type TabKey = "content" | "exam" | "notes" | "files";

const TABS: { key: TabKey; label: string }[] = [
  { key: "content", label: "محتوا" },
  { key: "exam", label: "آزمون" },
  { key: "notes", label: "جزوه من" },
  { key: "files", label: "فایل‌ها" },
];

const initialNoteState: ActionState = {};

export function LessonDetailTabs({
  lessonId,
  body,
  description,
  filePath,
  fileLabel,
  exams,
  examsCompleted,
  submitExamAction,
  initialNoteBody = "",
  initialNoteUpdatedAt = null,
}: {
  lessonId: string;
  body?: string | null;
  description?: string | null;
  filePath?: string | null;
  fileLabel?: string;
  exams: LessonExamView[];
  examsCompleted: boolean;
  submitExamAction: (formData: FormData) => Promise<void>;
  initialNoteBody?: string;
  initialNoteUpdatedAt?: string | null;
}) {
  const [tab, setTab] = useState<TabKey>("content");
  const bodyText = body?.trim() || "";
  const descriptionText = description?.trim() || "";
  const fileHref =
    filePath && (filePath.startsWith("/") || filePath.startsWith("http"))
      ? filePath
      : filePath
        ? `/uploads/${filePath}`
        : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]">
      <div className="overflow-x-auto border-b border-[var(--border)] bg-[var(--muted)]/60">
        <div className="flex min-w-max items-stretch" role="tablist" aria-label="بخش‌های درس">
          {TABS.map((item) => {
            const active = tab === item.key;
            const showExamCheck = item.key === "exam" && examsCompleted;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.key)}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 px-3.5 py-3 text-sm transition-colors",
                  active
                    ? "font-bold text-[var(--foreground)]"
                    : "font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                <span>{item.label}</span>
                {showExamCheck ? (
                  <Check
                    className="size-3.5 text-[var(--accent-green)]"
                    strokeWidth={3}
                    aria-label="تکمیل‌شده"
                  />
                ) : null}
                {active ? (
                  <span
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--foreground)]"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-5" role="tabpanel">
        {tab === "content" ? (
          <div className="space-y-4">
            <p className="text-xs leading-6 text-[var(--muted-foreground)]">
              برای هایلایت نکات مهم، متن را انتخاب کنید. هایلایت‌ها فقط روی این دستگاه ذخیره می‌شوند.
            </p>
            {descriptionText ? (
              <p className="text-sm leading-7 text-[var(--muted-foreground)]">{descriptionText}</p>
            ) : null}
            {bodyText ? (
              <div className="text-sm leading-8 whitespace-pre-wrap text-[var(--foreground)]">
                {bodyText}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                متنی برای این درس ثبت نشده است.
              </p>
            )}
          </div>
        ) : null}

        {tab === "exam" ? (
          exams.length === 0 ? (
            <EmptyTab
              icon={<FileText className="size-5" />}
              title="آزمونی نیست"
              description="هنوز آزمونی به این درس متصل نشده است."
            />
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => {
                const submission = exam.submission;
                const locked = submission?.status === "reviewed";
                return (
                  <div
                    key={exam.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3"
                  >
                    <p className="text-sm font-medium">{exam.title}</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted-foreground)]">
                      {exam.prompt}
                    </p>

                    {locked ? (
                      <div className="mt-3 space-y-1 text-xs">
                        <p className="text-[var(--muted-foreground)]">
                          پاسخ شما:{" "}
                          {submission.selectedOption
                            ? `گزینه ${toFaDigits(submission.selectedOption)}`
                            : submission.answerText}
                        </p>
                        <p className="text-[var(--accent-green)]">
                          {submission.score != null
                            ? `نمره ${toFaDigits(submission.score)}`
                            : "بازبینی شد"}
                          {submission.feedback ? ` · ${submission.feedback}` : ""}
                        </p>
                      </div>
                    ) : exam.options.length === 0 ? (
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                        گزینه‌ای برای این آزمون تعریف نشده است.
                      </p>
                    ) : (
                      <form action={submitExamAction} className="mt-3 space-y-2">
                        <input type="hidden" name="examId" value={exam.id} />
                        <fieldset className="space-y-2">
                          <legend className="sr-only">گزینه‌ها</legend>
                          {exam.options.map((opt) => (
                            <label
                              key={opt.key}
                              className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand-soft)]"
                            >
                              <input
                                type="radio"
                                name="selectedOption"
                                value={opt.key}
                                required
                                defaultChecked={submission?.selectedOption === opt.key}
                                className="mt-1"
                              />
                              <span>
                                <span className="font-bold text-[var(--brand)]">
                                  {toFaDigits(opt.key)}.
                                </span>{" "}
                                {opt.text}
                              </span>
                            </label>
                          ))}
                        </fieldset>
                        <Button type="submit" size="sm">
                          {submission ? "به‌روزرسانی پاسخ" : "ارسال پاسخ"}
                        </Button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : null}

        {tab === "notes" ? (
          <LessonNotesPanel
            lessonId={lessonId}
            initialBody={initialNoteBody}
            initialUpdatedAt={initialNoteUpdatedAt}
          />
        ) : null}

        {tab === "files" ? (
          fileHref ? (
            <a
              href={fileHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3 text-sm font-medium text-[var(--brand)]"
            >
              <FileText className="size-4" />
              {fileLabel ?? "دانلود فایل درس"}
            </a>
          ) : (
            <EmptyTab
              icon={<FileText className="size-5" />}
              title="فایلی نیست"
              description="فایل پیوستی برای این درس ثبت نشده است."
            />
          )
        ) : null}
      </div>
    </div>
  );
}

function LessonNotesPanel({
  lessonId,
  initialBody,
  initialUpdatedAt,
}: {
  lessonId: string;
  initialBody: string;
  initialUpdatedAt: string | null;
}) {
  const [state, action, pending] = useActionState(saveLessonNoteAction, initialNoteState);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  useEffect(() => {
    if (state.success) setUpdatedAt(new Date().toISOString());
  }, [state.success]);

  const pdfHref = `/api/student/lessons/${lessonId}/notes/pdf`;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lessonId" value={lessonId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">جزوهٔ شخصی این درس</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {updatedAt
              ? `آخرین ذخیره: ${formatDateTimeFa(updatedAt)}`
              : "هنوز ذخیره‌ای انجام نشده است."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            <Save className="size-3.5" aria-hidden />
            {pending ? "در حال ذخیره…" : "ذخیره"}
          </Button>
          <a
            href={pdfHref}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]",
            )}
          >
            <Download className="size-3.5" aria-hidden />
            دانلود PDF
          </a>
        </div>
      </div>

      <label className="sr-only" htmlFor={`lesson-note-${lessonId}`}>
        متن جزوه
      </label>
      <textarea
        id={`lesson-note-${lessonId}`}
        name="body"
        dir="rtl"
        defaultValue={initialBody}
        rows={12}
        placeholder="یادداشت‌ها و نکات مهم این درس را اینجا بنویسید…"
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3.5 py-3 text-sm leading-8 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      />

      {state.error ? (
        <p className="text-xs text-[var(--destructive)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-xs text-[var(--accent-green)]" role="status">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

function EmptyTab({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
        {icon}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-6 text-[var(--muted-foreground)]">
        {description}
      </p>
    </div>
  );
}
