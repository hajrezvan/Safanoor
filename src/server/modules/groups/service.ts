import { and, asc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { grades, groups, students } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { ENTITY_STATUS } from "@/lib/enums";

export const createGroupSchema = z.object({
  gradeId: z.string().min(1, "انتخاب پایه الزامی است."),
  title: z.string().min(2, "عنوان گروه حداقل ۲ کاراکتر باشد."),
  status: z
    .enum([ENTITY_STATUS.ACTIVE, ENTITY_STATUS.INACTIVE, ENTITY_STATUS.ARCHIVED])
    .default(ENTITY_STATUS.ACTIVE),
});

export const updateGroupSchema = createGroupSchema.extend({
  id: z.string().min(1),
});

export type GroupListItem = {
  id: string;
  title: string;
  status: string;
  gradeId: string;
  gradeTitleFa: string;
  gradeOrdering: number;
  studentCount: number;
  createdAt: string;
};

export function listGroups(options?: { gradeId?: string; search?: string; status?: string }) {
  const conditions = [];
  if (options?.gradeId) conditions.push(eq(groups.gradeId, options.gradeId));
  if (options?.status) conditions.push(eq(groups.status, options.status));
  if (options?.search) conditions.push(like(groups.title, `%${options.search}%`));

  const rows = db
    .select({
      id: groups.id,
      title: groups.title,
      status: groups.status,
      gradeId: groups.gradeId,
      gradeTitleFa: grades.titleFa,
      gradeOrdering: grades.ordering,
      studentCount: sql<number>`(select count(*) from ${students} where ${students.groupId} = ${groups.id})`,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .innerJoin(grades, eq(groups.gradeId, grades.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(grades.ordering), asc(groups.title))
    .all();

  return rows.map((row) => ({
    ...row,
    studentCount: Number(row.studentCount ?? 0),
  })) as GroupListItem[];
}

export function getGroupById(id: string) {
  return db
    .select({
      id: groups.id,
      title: groups.title,
      status: groups.status,
      gradeId: groups.gradeId,
      gradeTitleFa: grades.titleFa,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .innerJoin(grades, eq(groups.gradeId, grades.id))
    .where(eq(groups.id, id))
    .get();
}

export function createGroup(input: z.infer<typeof createGroupSchema>) {
  const grade = db.select().from(grades).where(eq(grades.id, input.gradeId)).get();
  if (!grade) throw new Error("پایه انتخاب‌شده یافت نشد.");

  const duplicate = db
    .select()
    .from(groups)
    .where(and(eq(groups.gradeId, input.gradeId), eq(groups.title, input.title)))
    .get();
  if (duplicate) throw new Error("گروهی با این عنوان در این پایه وجود دارد.");

  const id = createId("grp");
  db.insert(groups)
    .values({
      id,
      gradeId: input.gradeId,
      title: input.title,
      status: input.status,
      createdAt: nowIso(),
    })
    .run();

  return getGroupById(id);
}

export function updateGroup(input: z.infer<typeof updateGroupSchema>) {
  const grade = db.select().from(grades).where(eq(grades.id, input.gradeId)).get();
  if (!grade) throw new Error("پایه انتخاب‌شده یافت نشد.");

  db.update(groups)
    .set({ gradeId: input.gradeId, title: input.title, status: input.status })
    .where(eq(groups.id, input.id))
    .run();

  return getGroupById(input.id);
}

export function deleteGroup(id: string) {
  const inUse = db.select().from(students).where(eq(students.groupId, id)).get();
  if (inUse) throw new Error("این گروه دانش‌آموز دارد و حذف نمی‌شود.");
  db.delete(groups).where(eq(groups.id, id)).run();
}
