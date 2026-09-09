"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createForceAction, type ActionState } from "@/server/actions/students";
import { STUDENT_STATUS, STUDENT_STATUS_TITLES_FA } from "@/lib/enums";

const initial: ActionState = {};
const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";

type Option = { id: string; fullName?: string; username?: string; titleFa?: string; title?: string };

export function CreateForceForm({
  unlinkedUsers,
  grades,
  groups,
  mentors,
  assistants,
}: {
  unlinkedUsers: Option[];
  grades: Option[];
  groups: Option[];
  mentors: Option[];
  assistants: Option[];
}) {
  const [state, action, pending] = useActionState(createForceAction, initial);
  const [mode, setMode] = useState<"existing" | "new">(
    unlinkedUsers.length > 0 ? "existing" : "new",
  );

  return (
    <form action={action} className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <input type="hidden" name="mode" value={mode} />
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" variant={mode === "new" ? "default" : "outline"} size="sm" onClick={() => setMode("new")}>
          حساب جدید
        </Button>
        <Button type="button" variant={mode === "existing" ? "default" : "outline"} size="sm" onClick={() => setMode("existing")}>
          کاربر موجود
        </Button>
      </div>

      {mode === "new" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="fullName">نام کامل</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">نام کاربری</Label>
            <Input id="username" name="username" required dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <Input id="password" name="password" type="password" required dir="ltr" />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="userId">کاربر دانش‌آموز</Label>
          <select id="userId" name="userId" className={selectClass} required>
            <option value="">انتخاب کنید</option>
            {unlinkedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName ?? u.id} ({u.username})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="gradeId">پایه</Label>
        <select id="gradeId" name="gradeId" className={selectClass} required>
          <option value="">انتخاب پایه</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.titleFa ?? g.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="groupId">گروه</Label>
        <select id="groupId" name="groupId" className={selectClass}>
          <option value="">بدون گروه</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title ?? g.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">وضعیت</Label>
        <select id="status" name="status" className={selectClass} defaultValue={STUDENT_STATUS.ACTIVE}>
          {Object.values(STUDENT_STATUS).map((s) => (
            <option key={s} value={s}>
              {STUDENT_STATUS_TITLES_FA[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mentorUserId">مربی</Label>
        <select id="mentorUserId" name="mentorUserId" className={selectClass}>
          <option value="">بدون مربی</option>
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName ?? m.id}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assistantUserId">کمک‌مربی</Label>
        <select id="assistantUserId" name="assistantUserId" className={selectClass}>
          <option value="">بدون کمک‌مربی</option>
          {assistants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName ?? a.id}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "در حال ثبت…" : "ثبت نیرو"}
      </Button>
    </form>
  );
}
