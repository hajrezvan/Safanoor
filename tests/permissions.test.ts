import { describe, expect, it } from "vitest";
import {
  getDefaultPermissionsForRole,
  hasRole,
  PERMISSIONS,
  userHasPermission,
} from "@/server/authz/policy";
import { ROLE_KEYS } from "@/lib/enums";
import type { AuthUser } from "@/server/auth/session";

const mentor: AuthUser = {
  id: "u1",
  username: "m",
  fullName: "مربی",
  roleId: "r-mentor",
  roleKey: ROLE_KEYS.MENTOR,
};

const student: AuthUser = {
  id: "u2",
  username: "s",
  fullName: "دانش‌آموز",
  roleId: "r-student",
  roleKey: ROLE_KEYS.STUDENT,
};

const admin: AuthUser = {
  id: "u3",
  username: "a",
  fullName: "مدیر",
  roleId: "r-admin",
  roleKey: ROLE_KEYS.ADMIN,
};

describe("permissions policy", () => {
  it("admin has all default permissions listed", () => {
    const perms = getDefaultPermissionsForRole(ROLE_KEYS.ADMIN);
    expect(perms).toContain(PERMISSIONS.USERS_MANAGE);
    expect(perms).toContain(PERMISSIONS.AI_USE);
  });

  it("student cannot manage users by default list", () => {
    const perms = getDefaultPermissionsForRole(ROLE_KEYS.STUDENT);
    expect(perms).not.toContain(PERMISSIONS.USERS_MANAGE);
    expect(perms).toContain(PERMISSIONS.CHAT_USE);
  });

  it("hasRole checks correctly", () => {
    expect(hasRole(mentor, ROLE_KEYS.MENTOR)).toBe(true);
    expect(hasRole(student, ROLE_KEYS.ADMIN)).toBe(false);
  });

  it("admin bypasses permission checks", () => {
    expect(userHasPermission(admin, PERMISSIONS.USERS_MANAGE)).toBe(true);
  });

  it("mentor can manage knowledge by default", () => {
    const perms = getDefaultPermissionsForRole(ROLE_KEYS.MENTOR);
    expect(perms).toContain(PERMISSIONS.KNOWLEDGE_MANAGE);
    expect(perms).toContain(PERMISSIONS.AI_USE);
  });

  it("student cannot manage knowledge by default", () => {
    const perms = getDefaultPermissionsForRole(ROLE_KEYS.STUDENT);
    expect(perms).not.toContain(PERMISSIONS.KNOWLEDGE_MANAGE);
  });
});
