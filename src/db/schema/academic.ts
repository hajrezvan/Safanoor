import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const grades = sqliteTable("grades", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  titleFa: text("title_fa").notNull(),
  ordering: integer("ordering").notNull(),
  createdAt: text("created_at").notNull(),
});

export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    gradeId: text("grade_id")
      .notNull()
      .references(() => grades.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("groups_grade_id_idx").on(table.gradeId)],
);

export type Grade = typeof grades.$inferSelect;
export type Group = typeof groups.$inferSelect;
