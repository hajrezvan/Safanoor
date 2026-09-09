"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTIVITY_STATUS,
  ACTIVITY_STATUS_TITLES_FA,
  ACTIVITY_TYPE,
  ACTIVITY_TYPE_TITLES_FA,
} from "@/lib/enums";
import {
  createActivityAction,
  updateActivityAction,
} from "@/server/actions/activities";
import type { ActionState } from "@/server/actions/users";
import type { ActivityListItem } from "@/server/modules/activities/service";

const initial: ActionState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7";

export function ActivityForm({
  activity,
  grades,
}: {
  activity?: ActivityListItem;
  grades: { id: string; titleFa: string }[];
}) {
  const isEdit = Boolean(activity);
  const [state, action, pending] = useActionState(
    isEdit ? updateActivityAction : createActivityAction,
    initial,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "ویرایش فعالیت" : "فعالیت جدید"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          {isEdit ? <input type="hidden" name="id" value={activity!.id} /> : null}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">عنوان</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={activity?.title ?? ""}
              placeholder="مثلاً پروژه عکاسی محله"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">نوع</Label>
            <select
              id="type"
              name="type"
              defaultValue={activity?.type ?? ACTIVITY_TYPE.PERSONAL_PRACTICE}
              className={selectClass}
            >
              {Object.values(ACTIVITY_TYPE).map((type) => (
                <option key={type} value={type}>
                  {ACTIVITY_TYPE_TITLES_FA[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">وضعیت</Label>
            <select
              id="status"
              name="status"
              defaultValue={activity?.status ?? ACTIVITY_STATUS.DRAFT}
              className={selectClass}
            >
              {Object.values(ACTIVITY_STATUS).map((status) => (
                <option key={status} value={status}>
                  {ACTIVITY_STATUS_TITLES_FA[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gradeId">پایه (اختیاری)</Label>
            <select
              id="gradeId"
              name="gradeId"
              defaultValue={activity?.gradeId ?? ""}
              className={selectClass}
            >
              <option value="">همه پایه‌ها</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.titleFa}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">توضیح</Label>
            <textarea
              id="description"
              name="description"
              className={textareaClass}
              defaultValue={activity?.description ?? ""}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="instructions">دستورالعمل</Label>
            <textarea
              id="instructions"
              name="instructions"
              className={textareaClass}
              defaultValue={activity?.instructions ?? ""}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="expectedOutput">خروجی مورد انتظار</Label>
            <textarea
              id="expectedOutput"
              name="expectedOutput"
              className={textareaClass}
              defaultValue={activity?.expectedOutput ?? ""}
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
            <Button type="submit" disabled={pending}>
              {pending ? "در حال ذخیره…" : isEdit ? "ذخیره تغییرات" : "ایجاد فعالیت"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
