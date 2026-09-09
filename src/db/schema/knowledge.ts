import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const knowledgeItems = sqliteTable(
  "knowledge_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    questionScenario: text("question_scenario").notNull(),
    recommendedApproach: text("recommended_approach").notNull(),
    cautions: text("cautions"),
    tags: text("tags"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("knowledge_items_category_idx").on(table.category),
    index("knowledge_items_status_idx").on(table.status),
  ],
);

export type KnowledgeItem = typeof knowledgeItems.$inferSelect;
