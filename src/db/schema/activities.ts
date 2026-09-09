import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { grades } from "./academic";
import { students } from "./students";

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    gradeId: text("grade_id").references(() => grades.id),
    instructions: text("instructions"),
    expectedOutput: text("expected_output"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("activities_grade_id_idx").on(table.gradeId)],
);

export const activityAssignments = sqliteTable(
  "activity_assignments",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    dueDate: text("due_date"),
    result: text("result"),
    feedback: text("feedback"),
    submittedAt: text("submitted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("activity_assignments_activity_id_idx").on(table.activityId),
    index("activity_assignments_student_id_idx").on(table.studentId),
    uniqueIndex("activity_assignments_unique").on(table.activityId, table.studentId),
  ],
);

export const progressRecords = sqliteTable(
  "progress_records",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    relatedType: text("related_type").notNull(),
    relatedId: text("related_id").notNull(),
    status: text("status").notNull(),
    progressPercent: integer("progress_percent").notNull().default(0),
    reportText: text("report_text"),
    evidenceUrl: text("evidence_url"),
    evidenceFilePath: text("evidence_file_path"),
    mentorFeedback: text("mentor_feedback"),
    recordedAt: text("recorded_at").notNull(),
    reviewedAt: text("reviewed_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("progress_records_student_id_idx").on(table.studentId),
    index("progress_records_related_idx").on(table.relatedType, table.relatedId),
    index("progress_records_status_idx").on(table.status),
  ],
);

export type Activity = typeof activities.$inferSelect;
export type ActivityAssignment = typeof activityAssignments.$inferSelect;
export type ProgressRecord = typeof progressRecords.$inferSelect;
