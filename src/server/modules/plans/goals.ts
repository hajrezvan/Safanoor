import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { actions, goalCategories, goals, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { todayIsoDate } from "@/lib/date";
import {
  ACTION_CLOSED_STATUSES,
  GOAL_CATEGORY_KEYS,
  GOAL_CATEGORY_TITLES_FA,
  GOAL_STATUS,
  PRIORITY,
  type GoalCategoryKey,
} from "@/lib/enums";

/* ------------------------------- دسته‌بندی اهداف ------------------------------ */

/** دسته‌های هدف قابل توسعه‌اند؛ این فهرست فقط مرجع seed اولیه است. */
export const GOAL_CATEGORY_SEED: { key: GoalCategoryKey; titleFa: string }[] = Object.values(
  GOAL_CATEGORY_KEYS,
).map((key) => ({ key, titleFa: GOAL_CATEGORY_TITLES_FA[key] }));

export const createGoalCategorySchema = z.object({
  key: z.string().min(2, "کلید دسته الزامی است."),
  titleFa: z.string().min(2, "عنوان دسته الزامی است."),
});

export function listGoalCategories() {
  return db.select().from(goalCategories).orderBy(asc(goalCategories.titleFa)).all();
}

export function getGoalCategoryByKey(key: string) {
  return db.select().from(goalCategories).where(eq(goalCategories.key, key)).get();
}

export function createGoalCategory(input: z.infer<typeof createGoalCategorySchema>) {
  if (getGoalCategoryByKey(input.key)) throw new Error("این دسته قبلاً ثبت شده است.");

  const id = createId("gct");
  db.insert(goalCategories)
    .values({ id, key: input.key, titleFa: input.titleFa, createdAt: nowIso() })
    .run();
  return db.select().from(goalCategories).where(eq(goalCategories.id, id)).get();
}

/** ایجاد دسته‌های پیش‌فرض هدف؛ idempotent است. */
export function seedGoalCategories() {
  const now = nowIso();
  let created = 0;

  for (const category of GOAL_CATEGORY_SEED) {
    if (getGoalCategoryByKey(category.key)) continue;
    db.insert(goalCategories)
      .values({
        id: createId("gct"),
        key: category.key,
        titleFa: category.titleFa,
        createdAt: now,
      })
      .run();
    created += 1;
  }

  return { created, total: listGoalCategories().length };
}

export function ensureGoalCategoriesSeeded() {
  const existing = listGoalCategories();
  if (existing.length > 0) return existing;
  seedGoalCategories();
  return listGoalCategories();
}

/* ----------------------------------- اهداف ---------------------------------- */

const goalStatusEnum = z.enum([
  GOAL_STATUS.ACTIVE,
  GOAL_STATUS.COMPLETED,
  GOAL_STATUS.ON_HOLD,
  GOAL_STATUS.CANCELLED,
]);

const priorityEnum = z.enum([
  PRIORITY.LOW,
  PRIORITY.MEDIUM,
  PRIORITY.HIGH,
  PRIORITY.URGENT,
]);

const optionalText = z.string().optional().or(z.literal(""));

export const createGoalSchema = z.object({
  studentId: z.string().min(1, "دانش‌آموز الزامی است."),
  title: z.string().min(3, "عنوان هدف حداقل ۳ نویسه است."),
  description: optionalText,
  categoryId: z.string().min(1, "انتخاب دسته هدف الزامی است."),
  priority: priorityEnum.default(PRIORITY.MEDIUM),
  startDate: z.string().min(4, "تاریخ شروع الزامی است."),
  targetDate: optionalText,
  status: goalStatusEnum.default(GOAL_STATUS.ACTIVE),
  mentorNote: optionalText,
  createdBy: z.string().min(1),
});

export const updateGoalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3, "عنوان هدف حداقل ۳ نویسه است."),
  description: optionalText,
  categoryId: z.string().min(1, "انتخاب دسته هدف الزامی است."),
  priority: priorityEnum,
  startDate: z.string().min(4, "تاریخ شروع الزامی است."),
  targetDate: optionalText,
  status: goalStatusEnum,
  mentorNote: optionalText,
});

export type GoalListItem = {
  id: string;
  studentId: string;
  title: string;
  description: string | null;
  categoryId: string;
  categoryKey: string | null;
  categoryTitleFa: string | null;
  priority: string;
  startDate: string;
  targetDate: string | null;
  status: string;
  mentorNote: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  actionCount: number;
  openActionCount: number;
};

function goalQuery() {
  const actionCount = sql<number>`(
    select count(*) from ${actions} where ${actions.goalId} = ${goals.id}
  )`;
  const openActionCount = sql<number>`(
    select count(*) from ${actions}
    where ${actions.goalId} = ${goals.id}
      and ${actions.status} not in (${sql.join(
        ACTION_CLOSED_STATUSES.map((status) => sql`${status}`),
        sql`, `,
      )})
  )`;

  return db
    .select({
      id: goals.id,
      studentId: goals.studentId,
      title: goals.title,
      description: goals.description,
      categoryId: goals.categoryId,
      categoryKey: goalCategories.key,
      categoryTitleFa: goalCategories.titleFa,
      priority: goals.priority,
      startDate: goals.startDate,
      targetDate: goals.targetDate,
      status: goals.status,
      mentorNote: goals.mentorNote,
      createdBy: goals.createdBy,
      createdByName: users.fullName,
      createdAt: goals.createdAt,
      updatedAt: goals.updatedAt,
      actionCount,
      openActionCount,
    })
    .from(goals)
    .leftJoin(goalCategories, eq(goals.categoryId, goalCategories.id))
    .leftJoin(users, eq(goals.createdBy, users.id));
}

export type GoalFilters = {
  studentId?: string;
  studentIds?: string[];
  status?: string;
  categoryId?: string;
};

export function listGoals(filters: GoalFilters = {}): GoalListItem[] {
  const conditions = [];
  if (filters.studentId) conditions.push(eq(goals.studentId, filters.studentId));
  if (filters.status) conditions.push(eq(goals.status, filters.status));
  if (filters.categoryId) conditions.push(eq(goals.categoryId, filters.categoryId));
  if (filters.studentIds) {
    conditions.push(
      filters.studentIds.length > 0 ? inArray(goals.studentId, filters.studentIds) : sql`1 = 0`,
    );
  }

  return goalQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(goals.createdAt))
    .all() as GoalListItem[];
}

export function getGoalById(id: string): GoalListItem | undefined {
  return goalQuery().where(eq(goals.id, id)).get() as GoalListItem | undefined;
}

/** فهرست ساده اهداف برای انتخاب در فرم اقدام */
export function listGoalOptions(studentId: string) {
  return db
    .select({ id: goals.id, title: goals.title, status: goals.status })
    .from(goals)
    .where(eq(goals.studentId, studentId))
    .orderBy(asc(goals.title))
    .all();
}

export function createGoal(input: z.infer<typeof createGoalSchema>) {
  if (!db.select().from(goalCategories).where(eq(goalCategories.id, input.categoryId)).get()) {
    throw new Error("دسته هدف یافت نشد.");
  }
  if (input.targetDate && input.targetDate < input.startDate) {
    throw new Error("تاریخ هدف نمی‌تواند پیش از تاریخ شروع باشد.");
  }

  const now = nowIso();
  const id = createId("gol");

  db.insert(goals)
    .values({
      id,
      studentId: input.studentId,
      title: input.title.trim(),
      description: input.description || null,
      categoryId: input.categoryId,
      priority: input.priority,
      startDate: input.startDate,
      targetDate: input.targetDate || null,
      status: input.status,
      mentorNote: input.mentorNote || null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getGoalById(id);
}

export function updateGoal(input: z.infer<typeof updateGoalSchema>) {
  const existing = db.select().from(goals).where(eq(goals.id, input.id)).get();
  if (!existing) throw new Error("هدف یافت نشد.");
  if (input.targetDate && input.targetDate < input.startDate) {
    throw new Error("تاریخ هدف نمی‌تواند پیش از تاریخ شروع باشد.");
  }

  db.update(goals)
    .set({
      title: input.title.trim(),
      description: input.description || null,
      categoryId: input.categoryId,
      priority: input.priority,
      startDate: input.startDate,
      targetDate: input.targetDate || null,
      status: input.status,
      mentorNote: input.mentorNote || null,
      updatedAt: nowIso(),
    })
    .where(eq(goals.id, input.id))
    .run();

  return getGoalById(input.id);
}

/**
 * حذف هدف؛ اقدامات متصل باقی می‌مانند و پیوندشان با `goal_id = null` باز می‌شود
 * (رفتار `on delete set null` در اسکیما).
 */
export function deleteGoal(id: string) {
  const existing = db.select().from(goals).where(eq(goals.id, id)).get();
  if (!existing) throw new Error("هدف یافت نشد.");
  db.delete(goals).where(eq(goals.id, id)).run();
  return existing.studentId;
}

/** جمع‌بندی وضعیت اهداف یک دانش‌آموز — ورودی داشبوردهای فاز ۷ */
export function summarizeGoals(studentId: string) {
  const rows = db
    .select({ status: goals.status, count: sql<number>`count(*)` })
    .from(goals)
    .where(eq(goals.studentId, studentId))
    .groupBy(goals.status)
    .all();

  const byStatus = Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  return {
    total: rows.reduce((sum, row) => sum + Number(row.count), 0),
    active: byStatus[GOAL_STATUS.ACTIVE] ?? 0,
    completed: byStatus[GOAL_STATUS.COMPLETED] ?? 0,
    onHold: byStatus[GOAL_STATUS.ON_HOLD] ?? 0,
    cancelled: byStatus[GOAL_STATUS.CANCELLED] ?? 0,
  };
}

/** اهدافی که تاریخ هدف آن‌ها گذشته و هنوز فعال‌اند */
export function listGoalsPastTarget(studentIds?: string[]) {
  const today = todayIsoDate();
  const conditions = [
    eq(goals.status, GOAL_STATUS.ACTIVE),
    sql`${goals.targetDate} is not null and ${goals.targetDate} < ${today}`,
  ];
  if (studentIds) {
    conditions.push(
      studentIds.length > 0 ? inArray(goals.studentId, studentIds) : sql`1 = 0`,
    );
  }

  return goalQuery()
    .where(and(...conditions))
    .orderBy(asc(goals.targetDate))
    .all() as GoalListItem[];
}
