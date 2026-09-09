import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { grades } from "./academic";
import { students } from "./students";

export const growthPaths = sqliteTable(
  "growth_paths",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    gradeId: text("grade_id")
      .notNull()
      .references(() => grades.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    ordering: integer("ordering").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("growth_paths_grade_id_idx").on(table.gradeId)],
);

export const pathObjectives = sqliteTable(
  "path_objectives",
  {
    id: text("id").primaryKey(),
    pathId: text("path_id")
      .notNull()
      .references(() => growthPaths.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    ordering: integer("ordering").notNull(),
  },
  (table) => [index("path_objectives_path_id_idx").on(table.pathId)],
);

export const pathEnrollments = sqliteTable(
  "path_enrollments",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    pathId: text("path_id")
      .notNull()
      .references(() => growthPaths.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
  },
  (table) => [
    index("path_enrollments_student_id_idx").on(table.studentId),
    index("path_enrollments_path_id_idx").on(table.pathId),
    index("path_enrollments_student_status_idx").on(table.studentId, table.status),
    uniqueIndex("path_enrollments_student_path_unique").on(table.studentId, table.pathId),
  ],
);

export type GrowthPath = typeof growthPaths.$inferSelect;
export type PathObjective = typeof pathObjectives.$inferSelect;
export type PathEnrollment = typeof pathEnrollments.$inferSelect;
