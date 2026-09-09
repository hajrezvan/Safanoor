import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db } from "@/db/client";
import { actions, goals, individualPlans, students, users } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { isPastDate, todayIsoDate } from "@/lib/date";
import {
  ACTION_CLOSED_STATUSES,
  ACTION_STATUS,
  ACTION_STATUS_TITLES_FA,
  ACTION_STATUS_TRANSITIONS,
  ACTION_TYPE,
  PRIORITY,
  type ActionStatus,
} from "@/lib/enums";
import { recordAudit } from "@/server/modules/audit/service";

const assigneeUser = alias(users, "assignee_user");
const creatorUser = alias(users, "creator_user");
const studentUser = alias(users, "action_student_user");

const actionStatusEnum = z.enum([
  ACTION_STATUS.TODO,
  ACTION_STATUS.IN_PROGRESS,
  ACTION_STATUS.DONE,
  ACTION_STATUS.CANCELLED,
]);

const actionTypeEnum = z.enum([
  ACTION_TYPE.TASK,
  ACTION_TYPE.STUDY,
  ACTION_TYPE.PRACTICE,
  ACTION_TYPE.MEETING,
  ACTION_TYPE.REPORT,
  ACTION_TYPE.OTHER,
]);

const priorityEnum = z.enum([
  PRIORITY.LOW,
  PRIORITY.MEDIUM,
  PRIORITY.HIGH,
  PRIORITY.URGENT,
]);

const optionalText = z.string().optional().or(z.literal(""));

export const createActionSchema = z.object({
  studentId: z.string().min(1, "دانش‌آموز الزامی است."),
  planId: optionalText,
  goalId: optionalText,
  title: z.string().min(3, "عنوان اقدام حداقل ۳ نویسه است."),
  description: optionalText,
  type: actionTypeEnum.default(ACTION_TYPE.TASK),
  assigneeUserId: z.string().min(1, "انتخاب مسئول انجام الزامی است."),
  startDate: z.string().min(4, "تاریخ شروع الزامی است."),
  deadline: optionalText,
  status: actionStatusEnum.default(ACTION_STATUS.TODO),
  priority: priorityEnum.default(PRIORITY.MEDIUM),
  createdBy: z.string().min(1),
});

export const updateActionSchema = z.object({
  id: z.string().min(1),
  planId: optionalText,
  goalId: optionalText,
  title: z.string().min(3, "عنوان اقدام حداقل ۳ نویسه است."),
  description: optionalText,
  type: actionTypeEnum,
  assigneeUserId: z.string().min(1, "انتخاب مسئول انجام الزامی است."),
  startDate: z.string().min(4, "تاریخ شروع الزامی است."),
  deadline: optionalText,
  priority: priorityEnum,
  mentorFeedback: optionalText,
});

export const transitionActionSchema = z.object({
  id: z.string().min(1),
  status: actionStatusEnum,
  result: optionalText,
});

export const actionFeedbackSchema = z.object({
  id: z.string().min(1),
  mentorFeedback: optionalText,
});

export type ActionListItem = {
  id: string;
  studentId: string;
  studentName: string | null;
  planId: string | null;
  planTitle: string | null;
  goalId: string | null;
  goalTitle: string | null;
  title: string;
  description: string | null;
  type: string;
  assigneeUserId: string;
  assigneeName: string | null;
  startDate: string;
  deadline: string | null;
  status: string;
  priority: string;
  result: string | null;
  mentorFeedback: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
};

function actionQuery() {
  return db
    .select({
      id: actions.id,
      studentId: actions.studentId,
      studentName: studentUser.fullName,
      planId: actions.planId,
      planTitle: individualPlans.title,
      goalId: actions.goalId,
      goalTitle: goals.title,
      title: actions.title,
      description: actions.description,
      type: actions.type,
      assigneeUserId: actions.assigneeUserId,
      assigneeName: assigneeUser.fullName,
      startDate: actions.startDate,
      deadline: actions.deadline,
      status: actions.status,
      priority: actions.priority,
      result: actions.result,
      mentorFeedback: actions.mentorFeedback,
      createdBy: actions.createdBy,
      createdByName: creatorUser.fullName,
      createdAt: actions.createdAt,
      updatedAt: actions.updatedAt,
    })
    .from(actions)
    .leftJoin(individualPlans, eq(actions.planId, individualPlans.id))
    .leftJoin(goals, eq(actions.goalId, goals.id))
    .leftJoin(assigneeUser, eq(actions.assigneeUserId, assigneeUser.id))
    .leftJoin(creatorUser, eq(actions.createdBy, creatorUser.id))
    .leftJoin(students, eq(actions.studentId, students.id))
    .leftJoin(studentUser, eq(students.userId, studentUser.id));
}

/** اقدام زمانی overdue است که مهلت آن گذشته باشد و هنوز بسته نشده باشد. */
export function isActionOverdue(
  action: { deadline: string | null; status: string },
  today = todayIsoDate(),
) {
  if (ACTION_CLOSED_STATUSES.includes(action.status as ActionStatus)) return false;
  return isPastDate(action.deadline, today);
}

type RawActionRow = Omit<ActionListItem, "isOverdue">;

function decorate(rows: RawActionRow[]): ActionListItem[] {
  const today = todayIsoDate();
  return rows.map((row) => ({ ...row, isOverdue: isActionOverdue(row, today) }));
}

export type ActionFilters = {
  studentId?: string;
  studentIds?: string[];
  assigneeUserId?: string;
  planId?: string;
  goalId?: string;
  status?: string;
  /** فقط اقدامات باز (TODO / IN_PROGRESS) */
  openOnly?: boolean;
  /** فقط اقداماتی که مهلتشان گذشته و بسته نشده‌اند */
  overdueOnly?: boolean;
};

function buildActionConditions(filters: ActionFilters) {
  const conditions = [];

  if (filters.studentId) conditions.push(eq(actions.studentId, filters.studentId));
  if (filters.assigneeUserId) {
    conditions.push(eq(actions.assigneeUserId, filters.assigneeUserId));
  }
  if (filters.planId) conditions.push(eq(actions.planId, filters.planId));
  if (filters.goalId) conditions.push(eq(actions.goalId, filters.goalId));
  if (filters.status) conditions.push(eq(actions.status, filters.status));
  if (filters.studentIds) {
    conditions.push(
      filters.studentIds.length > 0
        ? inArray(actions.studentId, filters.studentIds)
        : sql`1 = 0`,
    );
  }
  if (filters.openOnly || filters.overdueOnly) {
    conditions.push(
      sql`${actions.status} not in (${sql.join(
        ACTION_CLOSED_STATUSES.map((status) => sql`${status}`),
        sql`, `,
      )})`,
    );
  }
  if (filters.overdueOnly) {
    conditions.push(sql`${actions.deadline} is not null and ${actions.deadline} < ${todayIsoDate()}`);
  }

  return conditions.length ? and(...conditions) : undefined;
}

export function listActions(filters: ActionFilters = {}): ActionListItem[] {
  const rows = actionQuery()
    .where(buildActionConditions(filters))
    .orderBy(asc(actions.deadline), desc(actions.createdAt))
    .all() as RawActionRow[];
  return decorate(rows);
}

export function getActionById(id: string): ActionListItem | undefined {
  const row = actionQuery().where(eq(actions.id, id)).get() as RawActionRow | undefined;
  return row ? decorate([row])[0] : undefined;
}

/** اقدامات عقب‌افتاده — ورودی داشبوردهای پیگیری فازهای بعد */
export function listOverdueActions(studentIds?: string[]): ActionListItem[] {
  return listActions({ overdueOnly: true, studentIds });
}

/** اقدامات یک دانش‌آموز که خودش مسئول انجام آن‌هاست */
export function listActionsForAssignee(assigneeUserId: string, filters: ActionFilters = {}) {
  return listActions({ ...filters, assigneeUserId });
}

export function summarizeActions(filters: ActionFilters = {}) {
  const rows = listActions(filters);
  return {
    total: rows.length,
    todo: rows.filter((row) => row.status === ACTION_STATUS.TODO).length,
    inProgress: rows.filter((row) => row.status === ACTION_STATUS.IN_PROGRESS).length,
    done: rows.filter((row) => row.status === ACTION_STATUS.DONE).length,
    cancelled: rows.filter((row) => row.status === ACTION_STATUS.CANCELLED).length,
    overdue: rows.filter((row) => row.isOverdue).length,
  };
}

/* --------------------------------- چرخه حیات -------------------------------- */

export function allowedActionTransitions(from: ActionStatus): ActionStatus[] {
  return ACTION_STATUS_TRANSITIONS[from] ?? [];
}

export function canTransitionAction(from: ActionStatus, to: ActionStatus) {
  if (from === to) return true;
  return allowedActionTransitions(from).includes(to);
}

export function assertActionTransition(from: ActionStatus, to: ActionStatus) {
  if (!canTransitionAction(from, to)) {
    throw new Error(
      `تغییر وضعیت از «${ACTION_STATUS_TITLES_FA[from]}» به «${ACTION_STATUS_TITLES_FA[to]}» مجاز نیست.`,
    );
  }
}

/* ----------------------------------- CRUD ----------------------------------- */

function assertLinksBelongToStudent(
  studentId: string,
  planId: string | null,
  goalId: string | null,
) {
  if (planId) {
    const plan = db
      .select({ studentId: individualPlans.studentId })
      .from(individualPlans)
      .where(eq(individualPlans.id, planId))
      .get();
    if (!plan) throw new Error("برنامه فردی انتخاب‌شده یافت نشد.");
    if (plan.studentId !== studentId) {
      throw new Error("برنامه انتخاب‌شده به این دانش‌آموز تعلق ندارد.");
    }
  }

  if (goalId) {
    const goal = db
      .select({ studentId: goals.studentId })
      .from(goals)
      .where(eq(goals.id, goalId))
      .get();
    if (!goal) throw new Error("هدف انتخاب‌شده یافت نشد.");
    if (goal.studentId !== studentId) {
      throw new Error("هدف انتخاب‌شده به این دانش‌آموز تعلق ندارد.");
    }
  }
}

export function createAction(input: z.infer<typeof createActionSchema>) {
  const planId = input.planId || null;
  const goalId = input.goalId || null;
  assertLinksBelongToStudent(input.studentId, planId, goalId);

  if (input.deadline && input.deadline < input.startDate) {
    throw new Error("مهلت انجام نمی‌تواند پیش از تاریخ شروع باشد.");
  }
  if (!db.select({ id: users.id }).from(users).where(eq(users.id, input.assigneeUserId)).get()) {
    throw new Error("مسئول انجام یافت نشد.");
  }

  const now = nowIso();
  const id = createId("act");

  db.insert(actions)
    .values({
      id,
      planId,
      goalId,
      studentId: input.studentId,
      title: input.title.trim(),
      description: input.description || null,
      type: input.type,
      assigneeUserId: input.assigneeUserId,
      startDate: input.startDate,
      deadline: input.deadline || null,
      status: input.status,
      priority: input.priority,
      result: null,
      mentorFeedback: null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getActionById(id);
}

export function updateAction(input: z.infer<typeof updateActionSchema>) {
  const existing = db.select().from(actions).where(eq(actions.id, input.id)).get();
  if (!existing) throw new Error("اقدام یافت نشد.");

  const planId = input.planId || null;
  const goalId = input.goalId || null;
  assertLinksBelongToStudent(existing.studentId, planId, goalId);

  if (input.deadline && input.deadline < input.startDate) {
    throw new Error("مهلت انجام نمی‌تواند پیش از تاریخ شروع باشد.");
  }

  db.update(actions)
    .set({
      planId,
      goalId,
      title: input.title.trim(),
      description: input.description || null,
      type: input.type,
      assigneeUserId: input.assigneeUserId,
      startDate: input.startDate,
      deadline: input.deadline || null,
      priority: input.priority,
      mentorFeedback: input.mentorFeedback || null,
      updatedAt: nowIso(),
    })
    .where(eq(actions.id, input.id))
    .run();

  return getActionById(input.id);
}

/**
 * تغییر وضعیت اقدام با اعتبارسنجی گذار.
 * ثبت «انجام‌شده» بدون نتیجه مجاز نیست تا گزارش اقدام همیشه قابل بازخوانی باشد.
 */
export function transitionAction(
  input: z.infer<typeof transitionActionSchema>,
  actorUserId?: string,
) {
  const existing = db.select().from(actions).where(eq(actions.id, input.id)).get();
  if (!existing) throw new Error("اقدام یافت نشد.");

  const from = existing.status as ActionStatus;
  const to = input.status;
  assertActionTransition(from, to);

  const result = input.result !== undefined && input.result !== "" ? input.result : existing.result;

  if (to === ACTION_STATUS.DONE && !result?.trim()) {
    throw new Error("برای ثبت «انجام‌شده» نوشتن نتیجه اقدام الزامی است.");
  }

  db.update(actions)
    .set({ status: to, result: result || null, updatedAt: nowIso() })
    .where(eq(actions.id, input.id))
    .run();

  const updated = getActionById(input.id);
  if (actorUserId) {
    recordAudit({
      actorUserId,
      entityType: "action",
      entityId: input.id,
      action: "status_transition",
      before: { status: from, result: existing.result },
      after: { status: to, result: result || null },
      metadata: { studentId: existing.studentId, title: existing.title },
    });
  }
  return updated;
}

/** ثبت بازخورد مربی روی اقدام */
export function setActionMentorFeedback(input: z.infer<typeof actionFeedbackSchema>) {
  const existing = db.select().from(actions).where(eq(actions.id, input.id)).get();
  if (!existing) throw new Error("اقدام یافت نشد.");

  db.update(actions)
    .set({ mentorFeedback: input.mentorFeedback || null, updatedAt: nowIso() })
    .where(eq(actions.id, input.id))
    .run();

  return getActionById(input.id);
}

export function deleteAction(id: string) {
  const existing = db.select().from(actions).where(eq(actions.id, id)).get();
  if (!existing) throw new Error("اقدام یافت نشد.");
  db.delete(actions).where(eq(actions.id, id)).run();
  return existing.studentId;
}

/** آیا این کاربر مسئول انجام اقدام است؟ مبنای اجازه به‌روزرسانی توسط دانش‌آموز. */
export function isActionAssignee(actionId: string, userId: string) {
  const row = db
    .select({ assigneeUserId: actions.assigneeUserId })
    .from(actions)
    .where(eq(actions.id, actionId))
    .get();
  return Boolean(row && row.assigneeUserId === userId);
}

export function getActionStudentId(actionId: string) {
  return db
    .select({ studentId: actions.studentId })
    .from(actions)
    .where(eq(actions.id, actionId))
    .get()?.studentId;
}
