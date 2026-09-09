import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { grades, groups } from "./academic";

export const students = sqliteTable(
  "students",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    gradeId: text("grade_id").references(() => grades.id),
    groupId: text("group_id").references(() => groups.id),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("students_user_id_unique").on(table.userId),
    index("students_grade_id_idx").on(table.gradeId),
    index("students_group_id_idx").on(table.groupId),
  ],
);

export const growthProfiles = sqliteTable("growth_profiles", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .unique()
    .references(() => students.id, { onDelete: "cascade" }),
  interests: text("interests"),
  skills: text("skills"),
  academicStatus: text("academic_status"),
  overallNote: text("overall_note"),
  birthDate: text("birth_date"),
  nationalId: text("national_id"),
  address: text("address"),
  phone: text("phone"),
  avatarPath: text("avatar_path"),
  /** JSON: [{relation:'brother'|'sister', relative:'older'|'younger', ageDiffYears:number}] */
  siblingsJson: text("siblings_json"),
  fatherName: text("father_name"),
  fatherJob: text("father_job"),
  fatherBirthDate: text("father_birth_date"),
  motherJob: text("mother_job"),
  fatherAlive: integer("father_alive", { mode: "boolean" }),
  motherAlive: integer("mother_alive", { mode: "boolean" }),
  parentsLiveTogether: integer("parents_live_together", { mode: "boolean" }),
  updatedAt: text("updated_at").notNull(),
});

export const mentorAssignments = sqliteTable(
  "mentor_assignments",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    staffUserId: text("staff_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignmentRole: text("assignment_role").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
  },
  (table) => [
    index("mentor_assignments_student_id_idx").on(table.studentId),
    index("mentor_assignments_staff_user_id_idx").on(table.staffUserId),
    index("mentor_assignments_active_idx").on(table.studentId, table.isActive),
    index("mentor_assignments_role_active_idx").on(
      table.studentId,
      table.assignmentRole,
      table.isActive,
    ),
  ],
);

export type Student = typeof students.$inferSelect;
export type GrowthProfile = typeof growthProfiles.$inferSelect;
export type MentorAssignment = typeof mentorAssignments.$inferSelect;
