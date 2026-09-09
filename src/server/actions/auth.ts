"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { roles, users } from "@/db/schema";
import { verifyPassword } from "@/server/auth/password";
import {
  clearSessionCookie,
  createSession,
  revokeSessionByToken,
  setSessionCookie,
  SESSION_COOKIE,
} from "@/server/auth/session";
import { ROLE_KEYS } from "@/lib/enums";
import { loginSchema, type LoginState } from "@/server/auth/login-schema";

export type { LoginState };

function homeForRole(roleKey: string) {
  switch (roleKey) {
    case ROLE_KEYS.ADMIN:
      return "/admin";
    case ROLE_KEYS.MENTOR:
      return "/staff/mentor";
    case ROLE_KEYS.ASSISTANT_MENTOR:
      return "/staff/assistant";
    case ROLE_KEYS.STUDENT:
      return "/student";
    default:
      return "/login";
  }
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: "اطلاعات ورود معتبر نیست.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { username, password } = parsed.data;

  const user = db.select().from(users).where(eq(users.username, username)).get();

  if (!user || !user.isActive) {
    return { error: "نام کاربری یا رمز عبور نادرست است." };
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    return { error: "نام کاربری یا رمز عبور نادرست است." };
  }

  // Replace any leftover cookie from a previous seed / revoked session
  const jar = await cookies();
  const previous = jar.get(SESSION_COOKIE)?.value;
  if (previous) {
    await revokeSessionByToken(previous);
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  const role = db.select().from(roles).where(eq(roles.id, user.roleId)).get();

  redirect(homeForRole(role?.key ?? ""));
}

export async function logoutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await revokeSessionByToken(token);
  }
  await clearSessionCookie();
  redirect("/login");
}
