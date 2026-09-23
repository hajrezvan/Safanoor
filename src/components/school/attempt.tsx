"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { schoolAction } from "@/server/actions/school";
import type { studentAttempt } from "@/server/modules/school/service";
import { toFaDigits } from "@/lib/digits";
import { Button } from "@/components/ui/button";
export function SchoolAttempt({
  attempt,
}: {
  attempt: ReturnType<typeof studentAttempt>;
}) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, transition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const expired = useRef(false);
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((Date.parse(attempt.expiresAt) - Date.now()) / 1000),
      );
      setSeconds(left);
      if (!left && !expired.current) {
        expired.current = true;
        transition(async () => {
          const form = new FormData();
          form.set("operation", "finish");
          form.set("attemptId", attempt.id);
          const result = await schoolAction({}, form);
          if (result.error) {
            setMessage(result.error);
            expired.current = false;
          } else router.refresh();
        });
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt.expiresAt, attempt.id, router]);
  const send = (finish: boolean) => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    data.set("operation", finish ? "finish" : "answers");
    data.set("attemptId", attempt.id);
    transition(async () => {
      const result = await schoolAction({}, data);
      setMessage(
        result.error ?? (finish ? "پاسخ‌ها ارسال شد." : "پاسخ‌ها ذخیره شد."),
      );
      if (finish || seconds === 0) router.refresh();
    });
  };
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        send(true);
      }}
      className="space-y-5"
    >
      <div className="sticky top-16 z-20 flex justify-between rounded-2xl bg-[var(--brand)] p-4 text-white">
        <span>زمان باقی‌مانده</span>
        <span role="timer" dir="ltr">
          {seconds === null
            ? "…"
            : toFaDigits(
                `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
              )}
        </span>
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">
        برای ادامه در مراجعه بعدی، پاسخ‌ها را ذخیره کنید. در پایان زمان، آخرین
        پاسخ‌های ذخیره‌شده تصحیح می‌شوند.
      </p>
      {attempt.questions.map((q, i) => (
        <fieldset
          key={q.id}
          disabled={pending || seconds === 0}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
        >
          <legend className="px-2 text-sm font-bold">
            سؤال {toFaDigits(i + 1)} · {toFaDigits(q.points)} نمره
          </legend>
          <p className="mb-4 whitespace-pre-wrap leading-8">{q.prompt}</p>
          {
            <div className="space-y-2">
              {q.options.map((o) => (
                <label
                  className="flex cursor-pointer gap-3 rounded-xl bg-[var(--muted)] p-3"
                  key={o.key}
                >
                  <input
                    type="radio"
                    name={`answer:${q.id}`}
                    value={o.key}
                    defaultChecked={attempt.answers[q.id] === o.key}
                  />
                  {o.text}
                </label>
              ))}
            </div>
          }
        </fieldset>
      ))}
      {message && (
        <p role="status" className="rounded-xl bg-[var(--muted)] p-3">
          {message}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending || seconds === 0}
          onClick={() => send(false)}
        >
          ذخیره پاسخ‌ها
        </Button>
        <Button disabled={pending || seconds === 0}>پایان و ارسال آزمون</Button>
      </div>
    </form>
  );
}
