"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStudentAction, type ActionState } from "@/server/actions/students";
import { STUDENT_STATUS, STUDENT_STATUS_TITLES_FA } from "@/lib/enums";

const initial: ActionState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";

type Option = { id: string; fullName: string; username?: string };

export function CreateStudentForm({
  unlinkedUsers,
  grades,
  groups,
  mentors,
  assistants,
}: {
  unlinkedUsers: Option[];
  grades: { id: string; titleFa: string }[];
  groups: { id: string; title: string; gradeTitleFa: string }[];
  mentors: Option[];
  assistants: Option[];
}) {
  const [state, action, pending] = useActionState(createStudentAction, initial);
  const [mode, setMode] = useState<"existing" | "new">(
    unlinkedUsers.length > 0 ? "existing" : "new",
  );

  return (
    <form
      action={action}
      className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
    >
      <input type="hidden" name="mode" value={mode} />

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">حساب کاربری دانش‌آموز</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "existing" ? "default" : "outline"}
            onClick={() => setMode("existing")}
            disabled={unlinkedUsers.length === 0}
          >
            حساب موجود
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => setMode("new")}
          >
            ایجاد حساب جدید
          </Button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <Label htmlFor="userId">کاربر دانش‌آموز بدون پرونده</Label>
            <select id="userId" name="userId" className={selectClass} required>
              <option value="">انتخاب کنید</option>
              {unlinkedUsers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.fullName}
                  {option.username ? ` (${option.username})` : ""}
                </option>
              ))}
            </select>
            {unlinkedUsers.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                همه کاربران دانش‌آموز پرونده دارند. حساب جدیدی بسازید.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">نام کامل</Label>
              <Input id="fullName" name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">نام کاربری</Label>
              <Input id="username" name="username" required autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">ایمیل (اختیاری)</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">رمز عبور اولیه</Label>
              <Input id="password" name="password" type="password" required />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">اطلاعات تحصیلی</legend>

        <div className="space-y-2">
          <Label htmlFor="gradeId">پایه</Label>
          <select id="gradeId" name="gradeId" className={selectClass} required>
            <option value="">انتخاب کنید</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.titleFa}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="groupId">گروه (اختیاری)</Label>
          <select id="groupId" name="groupId" className={selectClass}>
            <option value="">بدون گروه</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.gradeTitleFa} — {group.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">وضعیت</Label>
          <select
            id="status"
            name="status"
            className={selectClass}
            defaultValue={STUDENT_STATUS.ACTIVE}
          >
            {Object.values(STUDENT_STATUS).map((status) => (
              <option key={status} value={status}>
                {STUDENT_STATUS_TITLES_FA[status]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">تخصیص مربی</legend>

        <div className="space-y-2">
          <Label htmlFor="mentorUserId">مربی</Label>
          <select id="mentorUserId" name="mentorUserId" className={selectClass}>
            <option value="">تخصیص نشده</option>
            {mentors.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>
                {mentor.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assistantUserId">کمک‌مربی</Label>
          <select id="assistantUserId" name="assistantUserId" className={selectClass}>
            <option value="">تخصیص نشده</option>
            {assistants.map((assistant) => (
              <option key={assistant.id} value={assistant.id}>
                {assistant.fullName}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {state.error ? (
        <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "در حال ذخیره…" : "ایجاد پرونده دانش‌آموز"}
      </Button>
    </form>
  );
}
