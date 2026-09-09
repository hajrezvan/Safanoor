"use client";

import { useActionState } from "react";
import { loginAction } from "@/server/actions/auth";
import type { LoginState } from "@/server/auth/login-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <Card className="w-full max-w-md border-[var(--border)] shadow-[var(--shadow-sm)]">
      <CardHeader>
        <CardTitle>ورود به سامانه</CardTitle>
        <CardDescription>
          با نام کاربری و رمز عبور اختصاصی خود وارد شوید.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">نام کاربری</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="مثلاً admin"
              required
            />
            {state.fieldErrors?.username ? (
              <p className="text-xs text-[var(--danger)]">{state.fieldErrors.username[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            {state.fieldErrors?.password ? (
              <p className="text-xs text-[var(--danger)]">{state.fieldErrors.password[0]}</p>
            ) : null}
          </div>
          {state.error ? (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "در حال ورود…" : "ورود"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
