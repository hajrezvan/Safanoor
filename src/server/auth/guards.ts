import { redirect } from "next/navigation";
import { getCurrentUser, type AuthUser } from "./session";
import type { RoleKey } from "@/lib/enums";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(...allowed: RoleKey[]): Promise<AuthUser> {
  const user = await requireUser();
  if (!allowed.includes(user.roleKey)) {
    redirect("/login?error=forbidden");
  }
  return user;
}

export function assertRole(user: AuthUser, ...allowed: RoleKey[]) {
  if (!allowed.includes(user.roleKey)) {
    throw new AuthError("دسترسی مجاز نیست.");
  }
}
