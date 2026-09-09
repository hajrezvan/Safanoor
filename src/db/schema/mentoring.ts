import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { students } from "./students";

export const chatConversations = sqliteTable(
  "chat_conversations",
  {
    id: text("id").primaryKey(),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    staffUserId: text("staff_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("chat_conversations_student_user_id_idx").on(table.studentUserId),
    index("chat_conversations_staff_user_id_idx").on(table.staffUserId),
    index("chat_conversations_status_idx").on(table.studentUserId, table.status),
  ],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
    readAt: text("read_at"),
  },
  (table) => [
    index("chat_messages_conversation_id_idx").on(table.conversationId),
    index("chat_messages_sender_user_id_idx").on(table.senderUserId),
  ],
);

export const mentoringSessions = sqliteTable(
  "mentoring_sessions",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    staffUserId: text("staff_user_id")
      .notNull()
      .references(() => users.id),
    date: text("date").notNull(),
    type: text("type").notNull(),
    durationMinutes: integer("duration_minutes"),
    topics: text("topics"),
    rawNotes: text("raw_notes"),
    summary: text("summary"),
    observations: text("observations"),
    followUpDate: text("follow_up_date"),
    referralRequired: integer("referral_required", { mode: "boolean" }).notNull().default(false),
    confidentiality: text("confidentiality").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("mentoring_sessions_student_id_idx").on(table.studentId),
    index("mentoring_sessions_staff_user_id_idx").on(table.staffUserId),
    index("mentoring_sessions_date_idx").on(table.date),
  ],
);

export const mentorNotes = sqliteTable(
  "mentor_notes",
  {
    id: text("id").primaryKey(),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    visibility: text("visibility").notNull(),
    tags: text("tags"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("mentor_notes_student_id_idx").on(table.studentId),
    index("mentor_notes_author_user_id_idx").on(table.authorUserId),
    index("mentor_notes_visibility_idx").on(table.visibility),
  ],
);

export const referrals = sqliteTable(
  "referrals",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    assignedTo: text("assigned_to").references(() => users.id),
    subject: text("subject").notNull(),
    description: text("description"),
    priority: text("priority").notNull(),
    status: text("status").notNull(),
    response: text("response"),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("referrals_student_id_idx").on(table.studentId),
    index("referrals_status_idx").on(table.status),
    index("referrals_assigned_to_idx").on(table.assignedTo),
  ],
);

export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type MentoringSession = typeof mentoringSessions.$inferSelect;
export type MentorNote = typeof mentorNotes.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
