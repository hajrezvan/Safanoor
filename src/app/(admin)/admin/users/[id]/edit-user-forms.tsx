"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  updateUserAction,
  type ActionState,
} from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_TITLES_FA, type RoleKey } from "@/lib/enums";

const initial: ActionState = {};

type Props = {
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string | null;
    roleKey: string;
    isActive: boolean;
  };
};

export function EditUserForms({ user }: Props) {
  const [updateState, updateAction, updating] = useActionState(updateUserAction, initial);
  const [passState, passAction, changing] = useActionState(changePasswordAction, initial);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-2">
      <form action={updateAction} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="font-semibold">ویرایش مشخصات</h2>
        <input type="hidden" name="id" value={user.id} />
        <div className="space-y-2">
          <Label>نام کاربری</Label>
          <Input value={user.username} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">نام کامل</Label>
          <Input id="fullName" name="fullName" defaultValue={user.fullName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">ایمیل</Label>
          <Input id="email" name="email" type="email" defaultValue={user.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="roleKey">نقش</Label>
          <select
            id="roleKey"
            name="roleKey"
            defaultValue={user.roleKey}
            className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
          >
            {Object.entries(ROLE_TITLES_FA).map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
          حساب فعال است
        </label>
        {updateState.error ? (
          <p className="text-sm text-[var(--danger)]">{updateState.error}</p>
        ) : null}
        {updateState.success ? (
          <p className="text-sm text-[var(--brand)]">{updateState.success}</p>
        ) : null}
        <Button type="submit" disabled={updating}>
          ذخیره تغییرات
        </Button>
      </form>

      <form action={passAction} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="font-semibold">تغییر رمز عبور</h2>
        <input type="hidden" name="id" value={user.id} />
        <div className="space-y-2">
          <Label htmlFor="password">رمز جدید</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        {passState.error ? (
          <p className="text-sm text-[var(--danger)]">{passState.error}</p>
        ) : null}
        {passState.success ? (
          <p className="text-sm text-[var(--brand)]">{passState.success}</p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={changing}>
          به‌روزرسانی رمز
        </Button>
      </form>
    </div>
  );
}

// silence unused RoleKey if tree-shaken oddly
void (0 as unknown as RoleKey);
