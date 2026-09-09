import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { students } from "./students";

export const aiInteractions = sqliteTable(
  "ai_interactions",
  {
    id: text("id").primaryKey(),
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    createdAt: text("created_at").notNull(),
    contextMeta: text("context_meta"),
    output: text("output").notNull(),
    accepted: text("accepted"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    studentId: text("student_id").references(() => students.id, { onDelete: "set null" }),
    relatedType: text("related_type"),
    relatedId: text("related_id"),
  },
  (table) => [
    index("ai_interactions_created_by_idx").on(table.createdBy),
    index("ai_interactions_student_id_idx").on(table.studentId),
    index("ai_interactions_feature_idx").on(table.feature),
  ],
);

export type AiInteraction = typeof aiInteractions.$inferSelect;
