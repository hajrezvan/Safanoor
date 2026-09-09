"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignActivityAction,
  provideMentorFeedbackAction,
} from "@/server/actions/activities";
import type { ActionState } from "@/server/actions/users";

const initial: ActionState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";
const textareaClass =
  "min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7";

export function AssignActivityForm({
  studentId,
  activities,
}: {
  studentId: string;
  activities: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(assignActivityAction, initial);

  if (activities.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        فعالیت منتشرشده‌ای برای محول‌کردن وجود ندارد.
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="activityId">فعالیت</Label>
        <select id="activityId" name="activityId" required className={selectClass}>
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="dueDate">مهلت (اختیاری)</Label>
        <Input id="dueDate" name="dueDate" type="date" />
      </div>
      {state.error ? (
        <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)] md:col-span-3">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm md:col-span-3">
          {state.success}
        </p>
      ) : null}
      <div className="md:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال محول‌سازی…" : "محول کردن"}
        </Button>
      </div>
    </form>
  );
}

export function MentorFeedbackForm({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(provideMentorFeedbackAction, initial);

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Label htmlFor={`fb-${assignmentId}`}>بازخورد مربی</Label>
      <textarea
        id={`fb-${assignmentId}`}
        name="feedback"
        required
        className={textareaClass}
        placeholder="نکات مثبت و پیشنهاد بهبود"
      />
      {state.error ? (
        <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm">{state.success}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "ثبت بازخورد"}
      </Button>
    </form>
  );
}
