"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createGroupAction } from "@/server/actions/groups";
import type { ActionState } from "@/server/actions/users";

const initial: ActionState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";

export function CreateGroupForm({
  grades,
}: {
  grades: { id: string; titleFa: string }[];
}) {
  const [state, action, pending] = useActionState(createGroupAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>گروه جدید</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">عنوان گروه</Label>
            <Input id="title" name="title" required placeholder="مثلاً حلقه شهید باکری" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gradeId">پایه</Label>
            <select id="gradeId" name="gradeId" required className={selectClass}>
              <option value="">انتخاب کنید</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.titleFa}
                </option>
              ))}
            </select>
          </div>

          {state.error ? (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm sm:col-span-2">
              {state.success}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending || grades.length === 0}>
              {pending ? "در حال ذخیره…" : "ایجاد گروه"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
