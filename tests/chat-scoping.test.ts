import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  ASSIGNMENT_ROLE,
  CHAT_CONVERSATION_STATUS,
  ROLE_KEYS,
  ROLE_TITLES_FA,
  STUDENT_STATUS,
} from "@/lib/enums";

const dbPath = path.join(os.tmpdir(), `safanoor-chat-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

type ChatService = typeof import("@/server/modules/chat/service");
type StudentsService = typeof import("@/server/modules/students/service");
type GradesService = typeof import("@/server/modules/grades/service");

let chat: ChatService;
let students: StudentsService;
let grades: GradesService;
let db: typeof import("@/db/client").db;

const ids = {
  mentor: "",
  assistantA: "",
  assistantB: "",
  studentUser: "",
  studentId: "",
  otherStudentUser: "",
  otherStudentId: "",
};

describe("chat scoping", () => {
  beforeAll(async () => {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrate(drizzle(sqlite, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    sqlite.close();

    chat = await import("@/server/modules/chat/service");
    students = await import("@/server/modules/students/service");
    grades = await import("@/server/modules/grades/service");
    ({ db } = await import("@/db/client"));
    const now = nowIso();

    for (const key of Object.values(ROLE_KEYS)) {
      db.insert(schema.roles)
        .values({ id: createId("role"), key, titleFa: ROLE_TITLES_FA[key], createdAt: now })
        .run();
    }
    const roleIdByKey = Object.fromEntries(
      db.select().from(schema.roles).all().map((r) => [r.key, r.id]),
    );

    function addUser(fullName: string, username: string, roleKey: string) {
      const id = createId("usr");
      db.insert(schema.users)
        .values({
          id,
          username,
          email: null,
          passwordHash: "x",
          fullName,
          roleId: roleIdByKey[roleKey],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return id;
    }

    ids.mentor = addUser("مربی", "m1", ROLE_KEYS.MENTOR);
    ids.assistantA = addUser("کمک‌مربی الف", "a1", ROLE_KEYS.ASSISTANT_MENTOR);
    ids.assistantB = addUser("کمک‌مربی ب", "a2", ROLE_KEYS.ASSISTANT_MENTOR);
    ids.studentUser = addUser("دانش‌آموز یک", "s1", ROLE_KEYS.STUDENT);
    ids.otherStudentUser = addUser("دانش‌آموز دو", "s2", ROLE_KEYS.STUDENT);

    grades.seedGrades();
    const grade = grades.getGradeByKey(grades.GRADE_KEYS.EIGHTH)!;

    ids.studentId = students.createStudent({
      userId: ids.studentUser,
      gradeId: grade.id,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: ids.mentor,
      assistantUserId: ids.assistantA,
    })!.id;

    ids.otherStudentId = students.createStudent({
      userId: ids.otherStudentUser,
      gradeId: grade.id,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: ids.mentor,
      assistantUserId: ids.assistantB,
    })!.id;
  });

  afterAll(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("lets student chat with assigned assistant by default", () => {
    const contacts = chat.listActiveChatContactsForStudent(ids.studentUser);
    expect(contacts.map((c) => c.staffUserId).sort()).toEqual(
      [ids.assistantA, ids.mentor].sort(),
    );

    const conv = chat.getOrCreateConversationForStudent(ids.studentUser);
    expect(conv.staffUserId).toBe(ids.assistantA);
    expect(conv.status).toBe(CHAT_CONVERSATION_STATUS.ACTIVE);

    expect(() =>
      chat.assertAllowedChatPair(
        ids.studentUser,
        ROLE_KEYS.STUDENT,
        ids.studentUser,
        ids.assistantB,
      ),
    ).toThrow("چت فقط با پشتیبان");
  });

  it("lets student choose mentor when both mentor and assistant are assigned", () => {
    const withMentor = chat.getOrCreateConversationForStudent(ids.studentUser, ids.mentor);
    expect(withMentor.staffUserId).toBe(ids.mentor);

    const withAssistant = chat.getOrCreateConversationForStudent(
      ids.studentUser,
      ids.assistantA,
    );
    expect(withAssistant.staffUserId).toBe(ids.assistantA);
    expect(withAssistant.id).not.toBe(withMentor.id);

    expect(() =>
      chat.getOrCreateConversationForStudent(ids.studentUser, ids.assistantB),
    ).toThrow("چت فقط با پشتیبان");
  });

  it("blocks staff from chatting with out-of-scope students", () => {
    expect(() =>
      chat.getOrCreateConversationForStaff(
        ids.assistantA,
        ROLE_KEYS.ASSISTANT_MENTOR,
        ids.otherStudentUser,
      ),
    ).toThrow();
  });

  it("archives active conversations when assistant assignment changes", () => {
    const conv = chat.getOrCreateConversationForStudent(ids.studentUser);
    chat.sendMessage(conv.id, ids.studentUser, "سلام");

    students.setStaffAssignment({
      studentId: ids.studentId,
      staffUserId: ids.assistantB,
      assignmentRole: ASSIGNMENT_ROLE.ASSISTANT_MENTOR,
    });

    const row = db
      .select()
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.id, conv.id))
      .get();
    expect(row?.status).toBe(CHAT_CONVERSATION_STATUS.ARCHIVED);

    const next = chat.getOrCreateConversationForStudent(ids.studentUser);
    expect(next.staffUserId).toBe(ids.assistantB);
    expect(next.id).not.toBe(conv.id);
  });

  it("student inbox shows last message preview when messages exist", () => {
    // Restore assistant A so inbox has a known pair (archive test left assistant B).
    students.setStaffAssignment({
      studentId: ids.studentId,
      staffUserId: ids.assistantA,
      assignmentRole: ASSIGNMENT_ROLE.ASSISTANT_MENTOR,
    });

    const conv = chat.getOrCreateConversationForStudent(ids.studentUser, ids.assistantA);
    chat.sendMessage(conv.id, ids.studentUser, "اولین پیام آزمایشی");
    chat.sendMessage(conv.id, ids.assistantA, "پاسخ کمک‌مربی");
    chat.sendMessage(conv.id, ids.studentUser, "آخرین پیام آزمایشی");

    const inbox = chat.listStudentChatInbox(ids.studentUser);
    const row = inbox.find((item) => item.staffUserId === ids.assistantA);
    expect(row).toBeDefined();
    expect(row?.conversationId).toBe(conv.id);
    expect(row?.lastMessagePreview).toBe("آخرین پیام آزمایشی");
    expect(row?.lastMessageAt).toBeTruthy();

    const mentorRow = inbox.find((item) => item.staffUserId === ids.mentor);
    expect(mentorRow?.lastMessagePreview ?? null).toBeNull();
  });
});
