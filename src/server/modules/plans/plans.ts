import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { actions, individualPlans, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { ACTION_CLOSED_STATUSES, PLAN_STATUS } from "@/lib/enums";

const planStatusEnum = z.enum([
  PLAN_STATUS.DRAFT,
  PLAN_STATUS.ACTIVE,
  PLAN_STATUS.COMPLETED,
  PLAN_STATUS.ARCHIVED,
]);

const optionalText = z.string().optional().or(z.literal(""));

export const createPlanSchema = z.object({
  studentId: z.string().min(1, "دانش‌آموز الزامی است."),
  title: z.string().min(3, "عنوان برنامه حداقل ۳ نویسه است."),
  description: optionalText,
  status: planStatusEnum.default(PLAN_STATUS.DRAFT),
  createdBy: z.string().min(1),
});

export const updatePlanSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3, "عنوان برنامه حداقل ۳ نویسه است."),
  description: optionalText,
  status: planStatusEnum,
});

export type PlanListItem = {
  id: string;
  studentId: string;
  title: string;
  description: string | null;
  status: string;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  actionCount: number;
  openActionCount: number;
};

function planQuery() {
  const actionCount = sql<number>`(
    select count(*) from ${actions} where ${actions.planId} = ${individualPlans.id}
  )`;
  const openActionCount = sql<number>`(
    select count(*) from ${actions}
    where ${actions.planId} = ${individualPlans.id}
      and ${actions.status} not in (${sql.join(
        ACTION_CLOSED_STATUSES.map((status) => sql`${status}`),
        sql`, `,
      )})
  )`;

  return db
    .select({
      id: individualPlans.id,
      studentId: individualPlans.studentId,
      title: individualPlans.title,
      description: individualPlans.description,
      status: individualPlans.status,
      createdBy: individualPlans.createdBy,
      createdByName: users.fullName,
      createdAt: individualPlans.createdAt,
      updatedAt: individualPlans.updatedAt,
      actionCount,
      openActionCount,
    })
    .from(individualPlans)
    .leftJoin(users, eq(individualPlans.createdBy, users.id));
}

export type PlanFilters = {
  studentId?: string;
  studentIds?: string[];
  status?: string;
};

export function listPlans(filters: PlanFilters = {}): PlanListItem[] {
  const conditions = [];
  if (filters.studentId) conditions.push(eq(individualPlans.studentId, filters.studentId));
  if (filters.status) conditions.push(eq(individualPlans.status, filters.status));
  if (filters.studentIds) {
    conditions.push(
      filters.studentIds.length > 0
        ? inArray(individualPlans.studentId, filters.studentIds)
        : sql`1 = 0`,
    );
  }

  return planQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(individualPlans.createdAt))
    .all() as PlanListItem[];
}

export function getPlanById(id: string): PlanListItem | undefined {
  return planQuery().where(eq(individualPlans.id, id)).get() as PlanListItem | undefined;
}

/** فهرست ساده برنامه‌ها برای انتخاب در فرم اقدام */
export function listPlanOptions(studentId: string) {
  return db
    .select({
      id: individualPlans.id,
      title: individualPlans.title,
      status: individualPlans.status,
    })
    .from(individualPlans)
    .where(eq(individualPlans.studentId, studentId))
    .orderBy(asc(individualPlans.title))
    .all();
}

export function createPlan(input: z.infer<typeof createPlanSchema>) {
  const now = nowIso();
  const id = createId("pln");

  db.insert(individualPlans)
    .values({
      id,
      studentId: input.studentId,
      title: input.title.trim(),
      description: input.description || null,
      status: input.status,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getPlanById(id);
}

export function updatePlan(input: z.infer<typeof updatePlanSchema>) {
  const existing = db.select().from(individualPlans).where(eq(individualPlans.id, input.id)).get();
  if (!existing) throw new Error("برنامه فردی یافت نشد.");

  db.update(individualPlans)
    .set({
      title: input.title.trim(),
      description: input.description || null,
      status: input.status,
      updatedAt: nowIso(),
    })
    .where(eq(individualPlans.id, input.id))
    .run();

  return getPlanById(input.id);
}

/** حذف برنامه؛ اقدامات متصل حذف نمی‌شوند و `plan_id` آن‌ها null می‌شود. */
export function deletePlan(id: string) {
  const existing = db.select().from(individualPlans).where(eq(individualPlans.id, id)).get();
  if (!existing) throw new Error("برنامه فردی یافت نشد.");
  db.delete(individualPlans).where(eq(individualPlans.id, id)).run();
  return existing.studentId;
}
