"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toFaDigits } from "@/lib/digits";
import {
  expireExamAttemptAction,
  saveExamAnswerAction,
} from "@/server/actions/exams";

type ExamOption = { key: string; text: string };

export function TimedExamTaker({
  bookId,
  examId,
  title,
  questionIndex,
  questionCount,
  prompt,
  options,
  initialSelected,
  allowBack,
  expiresAtIso,
}: {
  bookId: string;
  examId: string;
  title: string;
  questionIndex: number;
  questionCount: number;
  prompt: string;
  options: ExamOption[];
  initialSelected: string | null;
  allowBack: boolean;
  expiresAtIso: string;
}) {
  const [selected, setSelected] = useState(initialSelected ?? "");
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const [pending, startTransition] = useTransition();
  const expiresAt = useMemo(() => new Date(expiresAtIso).getTime(), [expiresAtIso]);
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    let expired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0 && !expired) {
        expired = true;
        const fd = new FormData();
        fd.set("examId", examId);
        fd.set("bookId", bookId);
        fd.set("questionIndex", String(questionIndex));
        const current = selectedRef.current;
        if (current) fd.set("selectedOption", current);
        startTransition(() => {
          void expireExamAttemptAction(fd);
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [expiresAt, examId, bookId, questionIndex]);

  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const timerLabel = `${toFaDigits(mm)}:${toFaDigits(String(ss).padStart(2, "0"))}`;
  const isLast = questionIndex >= questionCount - 1;

  function submit(finish: boolean, goToIndex?: number) {
    if (!selected) return;
    const fd = new FormData();
    fd.set("examId", examId);
    fd.set("bookId", bookId);
    fd.set("questionIndex", String(questionIndex));
    fd.set("selectedOption", selected);
    if (finish) fd.set("finish", "1");
    if (typeof goToIndex === "number") fd.set("goToIndex", String(goToIndex));
    startTransition(() => {
      void saveExamAnswerAction(fd);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            سوال {toFaDigits(questionIndex + 1)} از {toFaDigits(questionCount)}
          </p>
        </div>
        <p
          className={`text-sm font-bold tabular-nums ${
            remainingSec <= 30 ? "text-[var(--danger)]" : "text-[var(--brand)]"
          }`}
          aria-live="polite"
        >
          زمان باقی‌مانده: {timerLabel}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)]">
        <p className="text-sm leading-7">{prompt}</p>
        <fieldset className="mt-4 space-y-2" disabled={pending || remainingSec <= 0}>
          <legend className="sr-only">گزینه‌ها</legend>
          {options.map((opt, i) => (
            <label
              key={opt.key}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-sm has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand-soft)]"
            >
              <input
                type="radio"
                name="selectedOption"
                value={opt.key}
                checked={selected === opt.key}
                onChange={() => setSelected(opt.key)}
                className="mt-1"
              />
              <span>
                <span className="font-bold text-[var(--brand)]">
                  {toFaDigits(i + 1)}.
                </span>{" "}
                {opt.text}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4 flex flex-wrap gap-2">
          {allowBack && questionIndex > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !selected}
              onClick={() => submit(false, questionIndex - 1)}
            >
              سوال قبل
            </Button>
          ) : null}
          {!isLast ? (
            <Button
              type="button"
              size="sm"
              disabled={pending || !selected}
              onClick={() => submit(false, questionIndex + 1)}
            >
              سوال بعد
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={pending || !selected}
              onClick={() => submit(true)}
            >
              پایان آزمون
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
