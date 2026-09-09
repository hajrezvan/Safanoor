"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROWTH_PATH_STATUS, GROWTH_PATH_STATUS_TITLES_FA } from "@/lib/enums";
import { createPathAction, updatePathAction } from "@/server/actions/paths";
import type { ActionState } from "@/server/actions/users";
import type { PathListItem } from "@/server/modules/paths/service";

const initial: ActionState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7";

export function PathForm({
  grades,
  path,
}: {
  grades: { id: string; titleFa: string }[];
  path?: PathListItem;
}) {
  const isEdit = Boolean(path);
  const [state, action, pending] = useActionState(
    isEdit ? updatePathAction : createPathAction,
    initial,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "ویرایش مسیر" : "مسیر رشد جدید"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          {isEdit ? <input type="hidden" name="id" value={path!.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="title">عنوان مسیر</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={path?.title ?? ""}
              placeholder="مثلاً مسیر معرفتی پایه هشتم"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gradeId">پایه</Label>
            <select
              id="gradeId"
              name="gradeId"
              required
              defaultValue={path?.gradeId ?? ""}
              className={selectClass}
            >
              <option value="">انتخاب کنید</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.titleFa}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">وضعیت</Label>
            <select
              id="status"
              name="status"
              defaultValue={path?.status ?? GROWTH_PATH_STATUS.DRAFT}
              className={selectClass}
            >
              {Object.values(GROWTH_PATH_STATUS).map((status) => (
                <option key={status} value={status}>
                  {GROWTH_PATH_STATUS_TITLES_FA[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ordering">ترتیب نمایش</Label>
            <Input
              id="ordering"
              name="ordering"
              type="number"
              min={0}
              defaultValue={path?.ordering ?? 0}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">توضیح</Label>
            <textarea
              id="description"
              name="description"
              className={textareaClass}
              defaultValue={path?.description ?? ""}
              placeholder="هدف کلی این مسیر و انتظاری که از دانش‌آموز می‌رود."
            />
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
              {pending ? "در حال ذخیره…" : isEdit ? "ذخیره تغییرات" : "ایجاد مسیر"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
