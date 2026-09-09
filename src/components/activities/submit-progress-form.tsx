"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitActivityProgressAction } from "@/server/actions/activities";
import type { ActionState } from "@/server/actions/users";

const initial: ActionState = {};

const textareaClass =
  "min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7";

export function SubmitProgressForm({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(submitActivityProgressAction, initial);

  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="markDone" value="1" />

      <div className="space-y-2">
        <Label htmlFor={`report-${assignmentId}`}>گزارش انجام</Label>
        <textarea
          id={`report-${assignmentId}`}
          name="reportText"
          required
          className={textareaClass}
          placeholder="چه کردید و نتیجه چه بود؟"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`url-${assignmentId}`}>لینک شواهد (اختیاری)</Label>
        <Input
          id={`url-${assignmentId}`}
          name="evidenceUrl"
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`file-${assignmentId}`}>فایل شواهد (اختیاری)</Label>
        <Input id={`file-${assignmentId}`} name="evidenceFile" type="file" />
      </div>

      {state.error ? (
        <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm">{state.success}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "در حال ارسال…" : "اعلام انجام و ارسال"}
      </Button>
    </form>
  );
}
