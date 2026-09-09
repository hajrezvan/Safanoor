import { sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { students } from "./students";

export const goalCategories = sqliteTable("goal_categories", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  titleFa: text("title_fa").notNull(),
  createdAt: text("created_at").notNull(),
});

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    categoryId: text("category_id")
      .notNull()
      .references(() => goalCategories.id),
    priority: text("priority").notNull(),
    startDate: text("start_date").notNull(),
    targetDate: text("target_date"),
    status: text("status").notNull(),
    mentorNote: text("mentor_note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("goals_student_id_idx").on(table.studentId),
    index("goals_category_id_idx").on(table.categoryId),
    index("goals_status_idx").on(table.status),
  ],
);

export const individualPlans = sqliteTable(
  "individual_plans",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("individual_plans_student_id_idx").on(table.studentId)],
);

export const actions = sqliteTable(
  "actions",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").references(() => individualPlans.id, { onDelete: "set null" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    assigneeUserId: text("assignee_user_id")
      .notNull()
      .references(() => users.id),
    startDate: text("start_date").notNull(),
    deadline: text("deadline"),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    result: text("result"),
    mentorFeedback: text("mentor_feedback"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("actions_student_id_idx").on(table.studentId),
    index("actions_plan_id_idx").on(table.planId),
    index("actions_goal_id_idx").on(table.goalId),
    index("actions_status_idx").on(table.status),
    index("actions_assignee_user_id_idx").on(table.assigneeUserId),
  ],
);

export type GoalCategory = typeof goalCategories.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type IndividualPlan = typeof individualPlans.$inferSelect;
export type Action = typeof actions.$inferSelect;
