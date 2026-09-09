import { and, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { roles, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { ROLE_KEYS, type RoleKey } from "@/lib/enums";
import { hashPassword } from "@/server/auth/password";
import { recordAudit } from "@/server/modules/audit/service";

export const createUserSchema = z.object({
  username: z.string().min(3, "نام کاربری حداقل ۳ کاراکتر باشد."),
  fullName: z.string().min(2, "نام کامل الزامی است."),
  email: z.string().email("ایمیل نامعتبر است.").optional().or(z.literal("")),
  password: z.string().min(8, "رمز عبور حداقل ۸ کاراکتر باشد."),
  roleKey: z.enum([
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.STUDENT,
  ]),
});

export const updateUserSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(2, "نام کامل الزامی است."),
  email: z.string().email("ایمیل نامعتبر است.").optional().or(z.literal("")),
  roleKey: z.enum([
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.STUDENT,
  ]),
  isActive: z.boolean(),
});

export const changePasswordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8, "رمز عبور حداقل ۸ کاراکتر باشد."),
});

export type UserListItem = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  roleKey: RoleKey;
  roleTitleFa: string;
  createdAt: string;
};

function getRoleByKey(roleKey: string) {
  const role = db.select().from(roles).where(eq(roles.key, roleKey)).get();
  if (!role) throw new Error(`نقش ${roleKey} یافت نشد.`);
  return role;
}

export function listUsers(options?: {
  search?: string;
  roleKey?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (options?.roleKey) {
    conditions.push(eq(roles.key, options.roleKey));
  }
  if (options?.search) {
    const q = `%${options.search}%`;
    conditions.push(
      or(like(users.fullName, q), like(users.username, q), like(users.email, q)),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      roleKey: roles.key,
      roleTitleFa: roles.titleFa,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(where)
    .orderBy(users.createdAt)
    .limit(pageSize)
    .offset(offset)
    .all();

  const totalRow = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(where)
    .get();

  return {
    items: rows as UserListItem[],
    total: Number(totalRow?.count ?? 0),
    page,
    pageSize,
  };
}

export function getUserById(id: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      roleId: users.roleId,
      roleKey: roles.key,
      roleTitleFa: roles.titleFa,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, id))
    .get();
}

export async function createUser(
  input: z.infer<typeof createUserSchema>,
  actorUserId?: string,
) {
  const existing = db.select().from(users).where(eq(users.username, input.username)).get();
  if (existing) {
    throw new Error("این نام کاربری قبلاً ثبت شده است.");
  }

  const role = getRoleByKey(input.roleKey);
  const now = nowIso();
  const passwordHash = await hashPassword(input.password);
  const id = createId("usr");

  db.insert(users)
    .values({
      id,
      username: input.username,
      email: input.email || null,
      passwordHash,
      fullName: input.fullName,
      roleId: role.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const created = getUserById(id);
  if (actorUserId && created) {
    recordAudit({
      actorUserId,
      entityType: "user",
      entityId: id,
      action: "create",
      after: {
        username: created.username,
        fullName: created.fullName,
        roleKey: created.roleKey,
        isActive: created.isActive,
      },
    });
  }
  return created;
}

export function updateUser(input: z.infer<typeof updateUserSchema>, actorUserId?: string) {
  const before = getUserById(input.id);
  const role = getRoleByKey(input.roleKey);
  db.update(users)
    .set({
      fullName: input.fullName,
      email: input.email || null,
      roleId: role.id,
      isActive: input.isActive,
      updatedAt: nowIso(),
    })
    .where(eq(users.id, input.id))
    .run();
  const after = getUserById(input.id);
  if (actorUserId && after) {
    recordAudit({
      actorUserId,
      entityType: "user",
      entityId: input.id,
      action: "update",
      before: before
        ? {
            fullName: before.fullName,
            roleKey: before.roleKey,
            isActive: before.isActive,
            email: before.email,
          }
        : undefined,
      after: {
        fullName: after.fullName,
        roleKey: after.roleKey,
        isActive: after.isActive,
        email: after.email,
      },
    });
  }
  return after;
}

export async function changeUserPassword(input: z.infer<typeof changePasswordSchema>) {
  const passwordHash = await hashPassword(input.password);
  db.update(users)
    .set({ passwordHash, updatedAt: nowIso() })
    .where(eq(users.id, input.id))
    .run();
}

export function setUserActive(id: string, isActive: boolean) {
  db.update(users)
    .set({ isActive, updatedAt: nowIso() })
    .where(eq(users.id, id))
    .run();
}

export function countUsersByRole() {
  return db
    .select({
      roleKey: roles.key,
      count: sql<number>`count(*)`,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .groupBy(roles.key)
    .all();
}
