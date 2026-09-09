import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  chatConversations,
  chatMessages,
  mentorAssignments,
  students,
  users,
} from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { todayIsoDate } from "@/lib/date";
import {
  ACTION_STATUS,
  ACTION_TYPE,
  ASSIGNMENT_ROLE,
  CHAT_CONVERSATION_STATUS,
  NOTE_VISIBILITY,
  PRIORITY,
  ROLE_KEYS,
  ROLE_TITLES_FA,
  type AssignmentRole,
  type RoleKey,
} from "@/lib/enums";
import { canStaffAccessStudent, getStudentById } from "@/server/modules/students/service";
import { createAction } from "@/server/modules/plans/actions";
import { createNote } from "@/server/modules/notes/service";

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1, "متن پیام خالی است.").max(4000),
});

export type ConversationListItem = {
  id: string;
  studentUserId: string;
  staffUserId: string;
  status: string;
  createdAt: string;
  archivedAt: string | null;
  studentName: string | null;
  staffName: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};

export type StudentChatContact = {
  staffUserId: string;
  staffName: string;
  staffAvatarPath: string | null;
  assignmentRole: AssignmentRole;
  roleTitleFa: string;
};

export type StudentChatInboxItem = StudentChatContact & {
  conversationId: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};

const ASSIGNMENT_ROLE_ORDER: Record<AssignmentRole, number> = {
  [ASSIGNMENT_ROLE.ASSISTANT_MENTOR]: 0,
  [ASSIGNMENT_ROLE.MENTOR]: 1,
};

/** پشتیبان پیش‌فرض دانش‌آموز: اولویت با کمک‌مربی، در غیر این صورت مربی */
export function getActiveSupportStaffUserId(studentId: string) {
  const assistant = db
    .select()
    .from(mentorAssignments)
    .where(
      and(
        eq(mentorAssignments.studentId, studentId),
        eq(mentorAssignments.assignmentRole, ASSIGNMENT_ROLE.ASSISTANT_MENTOR),
        eq(mentorAssignments.isActive, true),
      ),
    )
    .get();
  if (assistant) return assistant.staffUserId;

  const mentor = db
    .select()
    .from(mentorAssignments)
    .where(
      and(
        eq(mentorAssignments.studentId, studentId),
        eq(mentorAssignments.assignmentRole, ASSIGNMENT_ROLE.MENTOR),
        eq(mentorAssignments.isActive, true),
      ),
    )
    .get();
  return mentor?.staffUserId ?? null;
}

/** @deprecated استفاده از getActiveSupportStaffUserId */
export function getActiveAssistantStaffUserId(studentId: string) {
  return getActiveSupportStaffUserId(studentId);
}

export function getStudentIdByUserId(userId: string) {
  return db.select().from(students).where(eq(students.userId, userId)).get()?.id ?? null;
}

export function getStudentUserIdByStudentId(studentId: string) {
  return db.select().from(students).where(eq(students.id, studentId)).get()?.userId ?? null;
}

/** آیا این staff تخصیص فعال (مربی یا کمک‌مربی) برای دانش‌آموز دارد؟ */
export function isActiveAssignedStaffForStudent(studentId: string, staffUserId: string) {
  return Boolean(
    db
      .select({ id: mentorAssignments.id })
      .from(mentorAssignments)
      .where(
        and(
          eq(mentorAssignments.studentId, studentId),
          eq(mentorAssignments.staffUserId, staffUserId),
          eq(mentorAssignments.isActive, true),
          inArray(mentorAssignments.assignmentRole, [
            ASSIGNMENT_ROLE.ASSISTANT_MENTOR,
            ASSIGNMENT_ROLE.MENTOR,
          ]),
        ),
      )
      .get(),
  );
}

/**
 * مخاطبین چت دانش‌آموز: تخصیص‌های فعال کمک‌مربی و مربی.
 * با محدودیت یک کمک‌مربی فعال، مربی نیز به‌عنوان گزینه نمایش داده می‌شود.
 */
export function listActiveChatContactsForStudent(studentUserId: string): StudentChatContact[] {
  const studentId = getStudentIdByUserId(studentUserId);
  if (!studentId) return [];

  const rows = db
    .select({
      staffUserId: mentorAssignments.staffUserId,
      staffName: users.fullName,
      staffAvatarPath: users.avatarPath,
      assignmentRole: mentorAssignments.assignmentRole,
    })
    .from(mentorAssignments)
    .innerJoin(users, eq(mentorAssignments.staffUserId, users.id))
    .where(
      and(
        eq(mentorAssignments.studentId, studentId),
        eq(mentorAssignments.isActive, true),
        inArray(mentorAssignments.assignmentRole, [
          ASSIGNMENT_ROLE.ASSISTANT_MENTOR,
          ASSIGNMENT_ROLE.MENTOR,
        ]),
      ),
    )
    .all();

  return rows
    .map((row) => {
      const assignmentRole = row.assignmentRole as AssignmentRole;
      const roleKey =
        assignmentRole === ASSIGNMENT_ROLE.ASSISTANT_MENTOR
          ? ROLE_KEYS.ASSISTANT_MENTOR
          : ROLE_KEYS.MENTOR;
      return {
        staffUserId: row.staffUserId,
        staffName: row.staffName,
        staffAvatarPath: row.staffAvatarPath?.trim() || null,
        assignmentRole,
        roleTitleFa: ROLE_TITLES_FA[roleKey],
      };
    })
    .sort(
      (a, b) =>
        (ASSIGNMENT_ROLE_ORDER[a.assignmentRole] ?? 99) -
        (ASSIGNMENT_ROLE_ORDER[b.assignmentRole] ?? 99),
    );
}

/**
 * فهرست اینباکس پیامرسان دانش‌آموز: مخاطبین تخصیص‌یافته به‌همراه
 * پیش‌نمایش آخرین پیام و تعداد خوانده‌نشده (در صورت وجود مکالمه).
 */
export function listStudentChatInbox(studentUserId: string): StudentChatInboxItem[] {
  const contacts = listActiveChatContactsForStudent(studentUserId);
  const conversations = listStudentConversations(studentUserId);
  const byStaff = new Map(conversations.map((c) => [c.staffUserId, c]));

  return contacts
    .map((contact) => {
      const conv = byStaff.get(contact.staffUserId);
      return {
        ...contact,
        conversationId: conv?.id ?? null,
        unreadCount: Number(conv?.unreadCount ?? 0),
        lastMessageAt: conv?.lastMessageAt ?? null,
        lastMessagePreview: conv?.lastMessagePreview ?? null,
      };
    })
    .sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) {
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      }
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return (
        (ASSIGNMENT_ROLE_ORDER[a.assignmentRole] ?? 99) -
        (ASSIGNMENT_ROLE_ORDER[b.assignmentRole] ?? 99)
      );
    });
}

/** آیا کاربر فعلی مجاز به چت در این جفت دانش‌آموز/پشتیبان است؟ */
export function assertAllowedChatPair(
  actorUserId: string,
  actorRole: RoleKey,
  studentUserId: string,
  staffUserId: string,
) {
  const student = db.select().from(students).where(eq(students.userId, studentUserId)).get();
  if (!student) throw new Error("دانش‌آموز یافت نشد.");

  if (!isActiveAssignedStaffForStudent(student.id, staffUserId)) {
    throw new Error("چت فقط با پشتیبان تخصیص‌یافته فعال مجاز است.");
  }

  if (actorRole === ROLE_KEYS.STUDENT) {
    if (actorUserId !== studentUserId) {
      throw new Error("دسترسی به این مکالمه مجاز نیست.");
    }
    return student;
  }

  if (actorRole === ROLE_KEYS.ADMIN) return student;

  if (actorUserId !== staffUserId) {
    throw new Error("دسترسی به این مکالمه مجاز نیست.");
  }

  if (!canStaffAccessStudent(actorUserId, actorRole, student.id)) {
    throw new Error("این دانش‌آموز در محدوده شما نیست.");
  }

  return student;
}

/** مکالمه فعال بین دانش‌آموز و پشتیبان assign‌شده؛ در غیر این صورت ساخته می‌شود */
export function getOrCreateActiveConversation(studentUserId: string, staffUserId: string) {
  const existing = db
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.studentUserId, studentUserId),
        eq(chatConversations.staffUserId, staffUserId),
        eq(chatConversations.status, CHAT_CONVERSATION_STATUS.ACTIVE),
      ),
    )
    .get();
  if (existing) return existing;

  const id = createId("chat");
  const now = nowIso();
  db.insert(chatConversations)
    .values({
      id,
      studentUserId,
      staffUserId,
      status: CHAT_CONVERSATION_STATUS.ACTIVE,
      createdAt: now,
      archivedAt: null,
    })
    .run();
  return db.select().from(chatConversations).where(eq(chatConversations.id, id)).get()!;
}

/**
 * برای دانش‌آموز: مکالمه فعال با پشتیبان انتخاب‌شده (یا پیش‌فرض کمک‌مربی/مربی) را برمی‌گرداند یا می‌سازد.
 */
export function getOrCreateConversationForStudent(
  studentUserId: string,
  preferredStaffUserId?: string,
) {
  const studentId = getStudentIdByUserId(studentUserId);
  if (!studentId) throw new Error("پرونده دانش‌آموز یافت نشد.");

  const contacts = listActiveChatContactsForStudent(studentUserId);
  if (contacts.length === 0) {
    throw new Error("هنوز پشتیبان یا مربی‌ای به شما تخصیص داده نشده است.");
  }

  const staffUserId =
    preferredStaffUserId && contacts.some((c) => c.staffUserId === preferredStaffUserId)
      ? preferredStaffUserId
      : (getActiveSupportStaffUserId(studentId) ?? contacts[0]!.staffUserId);

  if (preferredStaffUserId && preferredStaffUserId !== staffUserId) {
    throw new Error("چت فقط با پشتیبان تخصیص‌یافته فعال مجاز است.");
  }

  assertAllowedChatPair(studentUserId, ROLE_KEYS.STUDENT, studentUserId, staffUserId);
  return getOrCreateActiveConversation(studentUserId, staffUserId);
}

/**
 * برای پشتیبان: مکالمه فعال با دانش‌آموز scoped را برمی‌گرداند یا می‌سازد.
 */
export function getOrCreateConversationForStaff(
  staffUserId: string,
  staffRole: RoleKey,
  studentUserId: string,
) {
  assertAllowedChatPair(staffUserId, staffRole, studentUserId, staffUserId);
  return getOrCreateActiveConversation(studentUserId, staffUserId);
}

export function archiveConversationsForStudent(studentUserId: string) {
  db.update(chatConversations)
    .set({ status: CHAT_CONVERSATION_STATUS.ARCHIVED, archivedAt: nowIso() })
    .where(
      and(
        eq(chatConversations.studentUserId, studentUserId),
        eq(chatConversations.status, CHAT_CONVERSATION_STATUS.ACTIVE),
      ),
    )
    .run();
}

export function assertChatParticipant(conversationId: string, userId: string) {
  const conv = db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, conversationId))
    .get();
  if (!conv) throw new Error("مکالمه یافت نشد.");
  if (conv.studentUserId !== userId && conv.staffUserId !== userId) {
    throw new Error("دسترسی به این مکالمه مجاز نیست.");
  }
  return conv;
}

function conversationSelect(viewerUserId: string) {
  // Qualify outer columns by table name inside correlated subqueries.
  // `${chatConversations.id}` compiles to bare `"id"`, which SQLite resolves to
  // chat_messages.id and breaks last-message / unread joins.
  return db
    .select({
      id: chatConversations.id,
      studentUserId: chatConversations.studentUserId,
      staffUserId: chatConversations.staffUserId,
      status: chatConversations.status,
      createdAt: chatConversations.createdAt,
      archivedAt: chatConversations.archivedAt,
      studentName: sql<string | null>`(
        select full_name from users u where u.id = chat_conversations.student_user_id
      )`,
      staffName: sql<string | null>`(
        select full_name from users u where u.id = chat_conversations.staff_user_id
      )`,
      unreadCount: sql<number>`(
        select count(*) from chat_messages m
        where m.conversation_id = chat_conversations.id
          and m.sender_user_id != ${viewerUserId}
          and m.read_at is null
      )`,
      lastMessageAt: sql<string | null>`(
        select m.created_at from chat_messages m
        where m.conversation_id = chat_conversations.id
        order by m.created_at desc, m.rowid desc limit 1
      )`,
      lastMessagePreview: sql<string | null>`(
        select m.content from chat_messages m
        where m.conversation_id = chat_conversations.id
        order by m.created_at desc, m.rowid desc limit 1
      )`,
    })
    .from(chatConversations);
}

export function listStaffConversations(staffUserId: string): ConversationListItem[] {
  return conversationSelect(staffUserId)
    .where(
      and(
        eq(chatConversations.staffUserId, staffUserId),
        eq(chatConversations.status, CHAT_CONVERSATION_STATUS.ACTIVE),
      ),
    )
    .orderBy(desc(chatConversations.createdAt))
    .all() as ConversationListItem[];
}

export function listStudentConversations(studentUserId: string): ConversationListItem[] {
  return conversationSelect(studentUserId)
    .where(
      and(
        eq(chatConversations.studentUserId, studentUserId),
        eq(chatConversations.status, CHAT_CONVERSATION_STATUS.ACTIVE),
      ),
    )
    .orderBy(desc(chatConversations.createdAt))
    .all() as ConversationListItem[];
}

export function getConversationById(conversationId: string, viewerUserId: string) {
  return conversationSelect(viewerUserId)
    .where(eq(chatConversations.id, conversationId))
    .get() as ConversationListItem | undefined;
}

export function countUnreadForUser(userId: string) {
  const asStaff = listStaffConversations(userId).reduce((sum, c) => sum + Number(c.unreadCount), 0);
  const asStudent = listStudentConversations(userId).reduce(
    (sum, c) => sum + Number(c.unreadCount),
    0,
  );
  return asStaff + asStudent;
}

export function listMessages(conversationId: string) {
  return db
    .select({
      id: chatMessages.id,
      conversationId: chatMessages.conversationId,
      senderUserId: chatMessages.senderUserId,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
      readAt: chatMessages.readAt,
      senderName: users.fullName,
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.senderUserId, users.id))
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt)
    .all();
}

export function sendMessage(conversationId: string, senderUserId: string, content: string) {
  const conv = assertChatParticipant(conversationId, senderUserId);
  if (conv.status !== CHAT_CONVERSATION_STATUS.ACTIVE) {
    throw new Error("این مکالمه آرشیو شده و قابل ارسال پیام نیست.");
  }

  const id = createId("msg");
  const now = nowIso();
  db.insert(chatMessages)
    .values({
      id,
      conversationId,
      senderUserId,
      content: content.trim(),
      createdAt: now,
      readAt: null,
    })
    .run();
  return db.select().from(chatMessages).where(eq(chatMessages.id, id)).get()!;
}

export function markConversationRead(conversationId: string, readerUserId: string) {
  assertChatParticipant(conversationId, readerUserId);
  db.update(chatMessages)
    .set({ readAt: nowIso() })
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        isNull(chatMessages.readAt),
        sql`${chatMessages.senderUserId} != ${readerUserId}`,
      ),
    )
    .run();
}

export function getMessageById(messageId: string) {
  return db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).get();
}

/** تبدیل پیام چت به یادداشت مربی */
export function convertMessageToNote(opts: {
  messageId: string;
  actorUserId: string;
  visibility?: (typeof NOTE_VISIBILITY)[keyof typeof NOTE_VISIBILITY];
  tags?: string;
}) {
  const message = getMessageById(opts.messageId);
  if (!message) throw new Error("پیام یافت نشد.");

  const conv = assertChatParticipant(message.conversationId, opts.actorUserId);
  const student = db.select().from(students).where(eq(students.userId, conv.studentUserId)).get();
  if (!student) throw new Error("دانش‌آموز مرتبط یافت نشد.");

  return createNote({
    authorUserId: opts.actorUserId,
    studentId: student.id,
    content: message.content,
    visibility: opts.visibility ?? NOTE_VISIBILITY.PRIVATE_STAFF,
    tags: opts.tags ?? "از-چت",
  });
}

/** تبدیل پیام چت به Action */
export function convertMessageToAction(opts: {
  messageId: string;
  actorUserId: string;
  title?: string;
  deadline?: string;
  assigneeUserId?: string;
}) {
  const message = getMessageById(opts.messageId);
  if (!message) throw new Error("پیام یافت نشد.");

  const conv = assertChatParticipant(message.conversationId, opts.actorUserId);
  const student = db.select().from(students).where(eq(students.userId, conv.studentUserId)).get();
  if (!student || !student.userId) throw new Error("دانش‌آموز مرتبط یافت نشد.");

  const title =
    opts.title?.trim() ||
    (message.content.length > 60 ? `${message.content.slice(0, 57)}…` : message.content);

  return createAction({
    studentId: student.id,
    title,
    description: message.content,
    type: ACTION_TYPE.TASK,
    assigneeUserId: opts.assigneeUserId || student.userId,
    startDate: todayIsoDate(),
    deadline: opts.deadline || undefined,
    status: ACTION_STATUS.TODO,
    priority: PRIORITY.MEDIUM,
    createdBy: opts.actorUserId,
  });
}

/** دانش‌آموزانی که در N روز اخیر پیام چت نداشته‌اند (برای follow-up) */
export function listStudentsWithoutRecentChat(
  studentIds: string[],
  days = 7,
): { studentId: string; studentName: string | null; lastMessageAt: string | null }[] {
  if (studentIds.length === 0) return [];

  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const rows = db
    .select({
      studentId: students.id,
      studentName: users.fullName,
      studentUserId: students.userId,
    })
    .from(students)
    .leftJoin(users, eq(students.userId, users.id))
    .where(inArray(students.id, studentIds))
    .all();

  return rows
    .map((row) => {
      if (!row.studentUserId) {
        return { studentId: row.studentId, studentName: row.studentName, lastMessageAt: null };
      }
      const last = db
        .select({
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .innerJoin(chatConversations, eq(chatMessages.conversationId, chatConversations.id))
        .where(eq(chatConversations.studentUserId, row.studentUserId))
        .orderBy(desc(chatMessages.createdAt))
        .get();
      return {
        studentId: row.studentId,
        studentName: row.studentName,
        lastMessageAt: last?.createdAt ?? null,
      };
    })
    .filter((row) => !row.lastMessageAt || row.lastMessageAt < cutoff);
}

export function summarizeChatForStudent(studentId: string) {
  const student = getStudentById(studentId);
  if (!student?.userId) {
    return { activeConversation: null as ConversationListItem | null, messageCount: 0 };
  }
  const active = listStudentConversations(student.userId)[0] ?? null;
  const messageCount = active ? listMessages(active.id).length : 0;
  return { activeConversation: active, messageCount };
}
