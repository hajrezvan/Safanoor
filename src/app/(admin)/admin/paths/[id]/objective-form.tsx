"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createObjectiveAction, updateObjectiveAction } from "@/server/actions/paths";
import type { ActionState } from "@/server/actions/users";
import type { PathObjective } from "@/db/schema";

const initial: ActionState = {};

const textareaClass =
  "min-h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7";

export function ObjectiveForm({
  pathId,
  objective,
}: {
  pathId: string;
  objective?: PathObjective;
}) {
  const isEdit = Boolean(objective);
  const [state, action, pending] = useActionState(
    isEdit ? updateObjectiveAction : createObjectiveAction,
    initial,
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="pathId" value={pathId} />
      {isEdit ? <input type="hidden" name="id" value={objective!.id} /> : null}

      <div className="space-y-2 sm:col-span-3">
        <Label htmlFor={`objective-title-${objective?.id ?? "new"}`}>عنوان هدف</Label>
        <Input
          id={`objective-title-${objective?.id ?? "new"}`}
          name="title"
          required
          defaultValue={objective?.title ?? ""}
          placeholder="مثلاً انس روزانه با قرآن"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`objective-ordering-${objective?.id ?? "new"}`}>ترتیب</Label>
        <Input
          id={`objective-ordering-${objective?.id ?? "new"}`}
          name="ordering"
          type="number"
          min={0}
          defaultValue={objective?.ordering ?? 0}
        />
      </div>

      <div className="space-y-2 sm:col-span-4">
        <Label htmlFor={`objective-description-${objective?.id ?? "new"}`}>توضیح</Label>
        <textarea
          id={`objective-description-${objective?.id ?? "new"}`}
          name="description"
          className={textareaClass}
          defaultValue={objective?.description ?? ""}
        />
      </div>

      {state.error ? (
        <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)] sm:col-span-4">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm sm:col-span-4">
          {state.success}
        </p>
      ) : null}

      <div className="sm:col-span-4">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "در حال ذخیره…" : isEdit ? "ذخیره هدف" : "افزودن هدف"}
        </Button>
      </div>
    </form>
  );
}
