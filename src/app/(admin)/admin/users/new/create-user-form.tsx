"use client";

import { useActionState } from "react";
import { createUserAction, type ActionState } from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_TITLES_FA } from "@/lib/enums";

const initial: ActionState = {};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);

  return (
    <form action={action} className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
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
      <div className="space-y-2">
        <Label htmlFor="roleKey">نقش</Label>
        <select
          id="roleKey"
          name="roleKey"
          required
          className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
          defaultValue="student"
        >
          {Object.entries(ROLE_TITLES_FA).map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "در حال ذخیره…" : "ایجاد کاربر"}
      </Button>
    </form>
  );
}
