/**
 * Facade over plans domain modules — pages and seed import from here.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { actions } from "@/db/schema/plans";
import { nowIso } from "@/lib/id";
import { ACTION_STATUS, GOAL_CATEGORY_KEYS, GOAL_STATUS, PLAN_STATUS, type ActionStatus } from "@/lib/enums";

export {
  GOAL_CATEGORY_SEED,
  createGoalCategorySchema,
  createGoalSchema,
  updateGoalSchema,
  listGoalCategories,
  getGoalCategoryByKey,
  createGoalCategory,
  ensureGoalCategoriesSeeded,
  listGoals,
  getGoalById,
  listGoalOptions,
  createGoal,
  updateGoal,
  deleteGoal,
  summarizeGoals,
  listGoalsPastTarget,
  type GoalListItem,
  type GoalFilters,
} from "./goals";

export {
  createPlanSchema,
  updatePlanSchema,
  listPlans,
  getPlanById,
  listPlanOptions,
  createPlan,
  updatePlan,
  deletePlan,
  type PlanListItem,
  type PlanFilters,
} from "./plans";

export {
  createActionSchema,
  updateActionSchema,
  transitionActionSchema,
  actionFeedbackSchema,
  listActions,
  getActionById,
  listActionsForAssignee,
  summarizeActions,
  allowedActionTransitions,
  canTransitionAction,
  assertActionTransition,
  createAction,
  updateAction,
  transitionAction,
  setActionMentorFeedback,
  deleteAction,
  isActionAssignee,
  getActionStudentId,
  isActionOverdue,
  type ActionListItem,
  type ActionFilters,
} from "./actions";

import {
  listGoalCategories,
  listGoals,
  createGoal,
  seedGoalCategories as seedGoalCategoriesInternal,
} from "./goals";
import { listPlans, createPlan } from "./plans";
import {
  listActions,
  listOverdueActions as listOverdueActionsInternal,
  transitionAction,
  getActionById,
  createAction,
} from "./actions";

/** ایجاد دسته‌های پیش‌فرض و برگرداندن فهرست کامل برای seed/UI */
export function seedGoalCategories() {
  seedGoalCategoriesInternal();
  return listGoalCategories();
}

export function listGoalsForStudent(studentId: string) {
  return listGoals({ studentId });
}

export function listPlansForStudent(studentId: string) {
  return listPlans({ studentId });
}

export function listActionsForStudent(studentId: string) {
  return listActions({ studentId });
}

export const createIndividualPlan = createPlan;

export function listOverdueActions(opts?: { studentId?: string } | string[]) {
  if (Array.isArray(opts)) return listOverdueActionsInternal(opts);
  if (opts?.studentId) return listActions({ overdueOnly: true, studentId: opts.studentId });
  return listActions({ overdueOnly: true });
}

export function transitionActionStatus(
  actionId: string,
  next: ActionStatus,
  actorUserId?: string,
) {
  const existing = db.select().from(actions).where(eq(actions.id, actionId)).get();
  if (!existing) throw new Error("اقدام یافت نشد.");

  const result =
    next === ACTION_STATUS.DONE && !existing.result?.trim() ? "—" : existing.result ?? undefined;

  return transitionAction({ id: actionId, status: next, result }, actorUserId);
}

export function updateActionResult(
  actionId: string,
  result: string,
  status?: ActionStatus,
  actorUserId?: string,
) {
  if (status) {
    return transitionAction({ id: actionId, status, result }, actorUserId);
  }

  db.update(actions)
    .set({ result, updatedAt: nowIso() })
    .where(eq(actions.id, actionId))
    .run();

  return getActionById(actionId);
}

/** برای seed و دمو */
export function ensureDemoPlanBundle(opts: {
  studentId: string;
  studentUserId: string;
  mentorUserId: string;
}) {
  seedGoalCategories();
  if (listGoalsForStudent(opts.studentId).length > 0) return;

  const cats = listGoalCategories();
  const cat = cats.find((c) => c.key === GOAL_CATEGORY_KEYS.MAAREFATI) ?? cats[0];
  const goal = createGoal({
    studentId: opts.studentId,
    title: "تقویت انس با نماز و دعا",
    description: "نماز اول‌وقت و چند دقیقه دعا یا مطالعه معارفی در برنامه هفتگی.",
    categoryId: cat.id,
    priority: "high",
    startDate: nowIso().slice(0, 10),
    targetDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
    mentorNote: "تمرکز روی نظم عبادی و گزارش هفتگی کوتاه.",
    status: GOAL_STATUS.ACTIVE,
    createdBy: opts.mentorUserId,
  });
  const plan = createPlan({
    studentId: opts.studentId,
    title: "برنامه فردی نیم‌سال",
    description: "ترکیب مطالعه معارفی، انس با نماز و پیگیری تحصیلی.",
    status: PLAN_STATUS.ACTIVE,
    createdBy: opts.mentorUserId,
  });
  createAction({
    studentId: opts.studentId,
    title: "مطالعه هفتگی یک فصل معارفی",
    type: "practice",
    planId: plan!.id,
    goalId: goal!.id,
    assigneeUserId: opts.studentUserId,
    startDate: nowIso().slice(0, 10),
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    priority: "medium",
    status: ACTION_STATUS.TODO,
    createdBy: opts.mentorUserId,
  });
  createAction({
    studentId: opts.studentId,
    title: "گزارش مطالعه کتاب اخلاقی",
    type: "report",
    planId: plan!.id,
    goalId: goal!.id,
    assigneeUserId: opts.studentUserId,
    startDate: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    deadline: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    priority: "high",
    status: ACTION_STATUS.TODO,
    createdBy: opts.mentorUserId,
  });
}
