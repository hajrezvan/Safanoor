"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseCover } from "@/components/patterns/course-cover";
import { COURSE_STATUS, COURSE_STATUS_TITLES_FA } from "@/lib/enums";
import { createCourseAction, updateCourseAction } from "@/server/actions/courses";
import type { ActionState } from "@/server/actions/users";
import type { CourseListItem } from "@/server/modules/courses/service";

const initial: ActionState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7";

export function CourseForm({ course }: { course?: CourseListItem }) {
  const isEdit = Boolean(course);
  const [state, action, pending] = useActionState(
    isEdit ? updateCourseAction : createCourseAction,
    initial,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "ویرایش دوره" : "دوره جدید"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} encType="multipart/form-data" className="grid gap-4 sm:grid-cols-2">
          {isEdit ? <input type="hidden" name="id" value={course!.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="title">عنوان دوره</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={course?.title ?? ""}
              placeholder="مثلاً آشنایی با نماز"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">وضعیت</Label>
            <select
              id="status"
              name="status"
              defaultValue={course?.status ?? COURSE_STATUS.DRAFT}
              className={selectClass}
            >
              {Object.values(COURSE_STATUS).map((status) => (
                <option key={status} value={status}>
                  {COURSE_STATUS_TITLES_FA[status]}
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
              defaultValue={course?.ordering ?? 0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cover">کاور دوره (آپلود)</Label>
            <Input id="cover" name="cover" type="file" accept="image/*" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="coverPath">مسیر یا آدرس کاور</Label>
            <Input
              id="coverPath"
              name="coverPath"
              dir="ltr"
              defaultValue={course?.coverPath ?? ""}
              placeholder="/covers/course-default.svg یا /uploads/covers/... یا https://..."
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              آپلود فایل اولویت دارد؛ در غیر این صورت همین مسیر/URL ذخیره می‌شود.
            </p>
            {course?.coverPath ? (
              <CourseCover
                coverPath={course.coverPath}
                title={course.title}
                className="mt-2 aspect-[16/9] max-w-xs rounded-xl"
              />
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">توضیح</Label>
            <textarea
              id="description"
              name="description"
              className={textareaClass}
              defaultValue={course?.description ?? ""}
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
              {pending ? "در حال ذخیره…" : isEdit ? "ذخیره تغییرات" : "ایجاد دوره"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
