import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { sessions, users, roles } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import type { RoleKey } from "@/lib/enums";

export const SESSION_COOKIE = "safanoor_session";
const SESSION_DAYS = 14;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.insert(sessions)
    .values({
      id: createId("ses"),
      userId,
      tokenHash,
      expiresAt,
      createdAt: now,
      revokedAt: null,
    })
    .run();

  return { token, expiresAt };
}

export async function revokeSessionByToken(token: string) {
  const tokenHash = hashToken(token);
  db.update(sessions)
    .set({ revokedAt: nowIso() })
    .where(eq(sessions.tokenHash, tokenHash))
    .run();
}

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  roleKey: RoleKey;
  roleId: string;
};

export async function getSessionUser(token?: string | null): Promise<AuthUser | null> {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = nowIso();

  const row = db
    .select({
      userId: users.id,
      username: users.username,
      fullName: users.fullName,
      roleId: users.roleId,
      roleKey: roles.key,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .get();

  if (!row || !row.isActive) return null;

  return {
    id: row.userId,
    username: row.username,
    fullName: row.fullName,
    roleId: row.roleId,
    roleKey: row.roleKey as RoleKey,
  };
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export async function setSessionCookie(token: string, expiresAt: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
