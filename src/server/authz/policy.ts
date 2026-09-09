/**
 * لایه مجوز مرکزی — UI نباید permission را hard-code کند.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { permissions, rolePermissions, roles } from "@/db/schema";
import type { AuthUser } from "@/server/auth/session";
import type { RoleKey } from "@/lib/enums";
import { ROLE_KEYS } from "@/lib/enums";
import { AuthError } from "@/server/auth/guards";

export const PERMISSIONS = {
  USERS_MANAGE: "users.manage",
  STUDENTS_MANAGE: "students.manage",
  STUDENTS_VIEW_SCOPED: "students.view_scoped",
  FORCES_MANAGE: "forces.manage",
  PLANS_MANAGE: "plans.manage",
  SESSIONS_MANAGE: "sessions.manage",
  NOTES_MANAGE: "notes.manage",
  CHAT_USE: "chat.use",
  REFERRALS_MANAGE: "referrals.manage",
  PATHS_MANAGE: "paths.manage",
  COURSES_MANAGE: "courses.manage",
  CLASSES_MANAGE: "classes.manage",
  LIBRARY_MANAGE: "library.manage",
  ANNOUNCEMENTS_MANAGE: "announcements.manage",
  EXAMS_REVIEW: "exams.review",
  ACTIVITIES_MANAGE: "activities.manage",
  KNOWLEDGE_MANAGE: "knowledge.manage",
  AI_USE: "ai.use",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_DEFAULT_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  admin: Object.values(PERMISSIONS),
  mentor: [
    PERMISSIONS.STUDENTS_VIEW_SCOPED,
    PERMISSIONS.FORCES_MANAGE,
    PERMISSIONS.PLANS_MANAGE,
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.NOTES_MANAGE,
    PERMISSIONS.CHAT_USE,
    PERMISSIONS.REFERRALS_MANAGE,
    PERMISSIONS.COURSES_MANAGE,
    PERMISSIONS.CLASSES_MANAGE,
    PERMISSIONS.LIBRARY_MANAGE,
    PERMISSIONS.ANNOUNCEMENTS_MANAGE,
    PERMISSIONS.EXAMS_REVIEW,
    PERMISSIONS.KNOWLEDGE_MANAGE,
    PERMISSIONS.AI_USE,
  ],
  assistant_mentor: [
    PERMISSIONS.STUDENTS_VIEW_SCOPED,
    PERMISSIONS.PLANS_MANAGE,
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.NOTES_MANAGE,
    PERMISSIONS.CHAT_USE,
    PERMISSIONS.REFERRALS_MANAGE,
    PERMISSIONS.LIBRARY_MANAGE,
    PERMISSIONS.EXAMS_REVIEW,
  ],
  student: [PERMISSIONS.CHAT_USE],
};

export function hasRole(user: AuthUser, ...allowed: RoleKey[]) {
  return allowed.includes(user.roleKey);
}

export function getDefaultPermissionsForRole(roleKey: RoleKey): PermissionKey[] {
  return ROLE_DEFAULT_PERMISSIONS[roleKey] ?? [];
}

export function listPermissionsForRole(roleId: string): PermissionKey[] {
  const rows = db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId))
    .all();

  if (rows.length === 0) {
    const role = db.select().from(roles).where(eq(roles.id, roleId)).get();
    if (role) {
      return getDefaultPermissionsForRole(role.key as RoleKey);
    }
  }

  return rows.map((r) => r.key as PermissionKey);
}

export function userHasPermission(user: AuthUser, permission: PermissionKey) {
  if (user.roleKey === ROLE_KEYS.ADMIN) return true;
  const perms = listPermissionsForRole(user.roleId);
  return perms.includes(permission);
}

export function assertPermission(user: AuthUser, permission: PermissionKey) {
  if (!userHasPermission(user, permission)) {
    throw new AuthError("دسترسی مجاز نیست.");
  }
}

export function assertRole(user: AuthUser, ...allowed: RoleKey[]) {
  if (!hasRole(user, ...allowed)) {
    throw new AuthError("نقش شما برای این عملیات مجاز نیست.");
  }
}
