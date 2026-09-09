import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  ROLE_KEYS,
  ROLE_TITLES_FA,
  SESSION_CONFIDENTIALITY,
  STUDENT_STATUS,
} from "@/lib/enums";
import type { AuthUser } from "@/server/auth/session";
import { MENTOR_ASSIST_REQUEST } from "@/ai/context/builder";

const dbPath = path.join(os.tmpdir(), `safanoor-ai-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

let mentorAssist: typeof import("@/ai/services/mentor-assist");
let sessionSummary: typeof import("@/ai/services/session-summary");
let nextActions: typeof import("@/ai/services/next-actions");
let interactions: typeof import("@/ai/services/interactions");
let students: typeof import("@/server/modules/students/service");
let grades: typeof import("@/server/modules/grades/service");
let sessions: typeof import("@/server/modules/sessions/service");

const ids = {
  mentor: "",
  otherMentor: "",
  assistant: "",
  studentUser: "",
  otherStudentUser: "",
  studentId: "",
  otherStudentId: "",
  sessionId: "",
  mentorRoleId: "",
  assistantRoleId: "",
};

function asUser(
  id: string,
  roleKey: (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS],
  roleId: string,
): AuthUser {
  return {
    id,
    username: id,
    fullName: id,
    roleId,
    roleKey,
  };
}

describe("AI mentor assist service", () => {
  beforeAll(async () => {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrate(drizzle(sqlite, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    sqlite.close();

    mentorAssist = await import("@/ai/services/mentor-assist");
    sessionSummary = await import("@/ai/services/session-summary");
    nextActions = await import("@/ai/services/next-actions");
    interactions = await import("@/ai/services/interactions");
    students = await import("@/server/modules/students/service");
    grades = await import("@/server/modules/grades/service");
    sessions = await import("@/server/modules/sessions/service");

    const { db } = await import("@/db/client");
    const now = nowIso();

    for (const key of Object.values(ROLE_KEYS)) {
      db.insert(schema.roles)
        .values({ id: createId("role"), key, titleFa: ROLE_TITLES_FA[key], createdAt: now })
        .run();
    }
    const roleIdByKey = Object.fromEntries(
      db.select().from(schema.roles).all().map((r) => [r.key, r.id]),
    );
    ids.mentorRoleId = roleIdByKey[ROLE_KEYS.MENTOR];
    ids.assistantRoleId = roleIdByKey[ROLE_KEYS.ASSISTANT_MENTOR];

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

    ids.mentor = addUser("مربی", "mentor_ai", ROLE_KEYS.MENTOR);
    ids.otherMentor = addUser("مربی دیگر", "mentor_ai2", ROLE_KEYS.MENTOR);
    ids.assistant = addUser("کمک‌مربی", "assist_ai", ROLE_KEYS.ASSISTANT_MENTOR);
    ids.studentUser = addUser("دانش‌آموز", "student_ai", ROLE_KEYS.STUDENT);
    ids.otherStudentUser = addUser("دانش‌آموز۲", "student_ai2", ROLE_KEYS.STUDENT);

    grades.seedGrades();
    const grade = grades.getGradeByKey(grades.GRADE_KEYS.EIGHTH)!;
    ids.studentId = students.createStudent({
      userId: ids.studentUser,
      gradeId: grade.id,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: ids.mentor,
      assistantUserId: ids.assistant,
    })!.id;
    ids.otherStudentId = students.createStudent({
      userId: ids.otherStudentUser,
      gradeId: grade.id,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: ids.otherMentor,
    })!.id;

    const session = sessions.createSession({
      studentId: ids.studentId,
      staffUserId: ids.mentor,
      date: "2026-09-01",
      type: "حضوری",
      rawNotes:
        "دانش‌آموز درباره مدیریت زمان صحبت کرد و گفت تکالیف را عقب می‌اندازد. برنامه هفتگی مرور شد.",
      summary: "",
      referralRequired: false,
      confidentiality: SESSION_CONFIDENTIALITY.NORMAL,
    });
    ids.sessionId = session.id;
  });

  afterAll(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("blocks assistant without AI_USE", async () => {
    await expect(
      mentorAssist.runMentorAssist({
        studentId: ids.studentId,
        actor: asUser(ids.assistant, ROLE_KEYS.ASSISTANT_MENTOR, ids.assistantRoleId),
        requestType: MENTOR_ASSIST_REQUEST.STATUS_SUMMARY,
      }),
    ).rejects.toThrow(/مجوز/);
  });

  it("blocks mentor for out-of-scope student", async () => {
    await expect(
      mentorAssist.runMentorAssist({
        studentId: ids.otherStudentId,
        actor: asUser(ids.mentor, ROLE_KEYS.MENTOR, ids.mentorRoleId),
        requestType: MENTOR_ASSIST_REQUEST.STATUS_SUMMARY,
      }),
    ).rejects.toThrow(/محدوده/);
  });

  it("runs mentor assist, persists interaction metadata, and accepts review", async () => {
    const actor = asUser(ids.mentor, ROLE_KEYS.MENTOR, ids.mentorRoleId);
    const result = await mentorAssist.runMentorAssist({
      studentId: ids.studentId,
      actor,
      requestType: MENTOR_ASSIST_REQUEST.STATUS_SUMMARY,
    });

    expect(result.interaction.id).toMatch(/^ai_/);
    expect(result.interaction.feature).toContain("mentor_assist");
    expect(result.interaction.studentId).toBe(ids.studentId);
    expect(result.interaction.createdBy).toBe(ids.mentor);
    expect(result.interaction.contextMeta).toBeTruthy();
    expect(result.output.length).toBeGreaterThan(10);

    const accepted = nextActions.acceptAiAssistOutput({
      interactionId: result.interaction.id,
      actor,
      decision: "accepted",
    });
    expect(accepted.accepted).toBe("accepted");
  });

  it("summarizes session without overwriting rawNotes", async () => {
    const actor = asUser(ids.mentor, ROLE_KEYS.MENTOR, ids.mentorRoleId);
    const before = sessions.getSessionById(ids.sessionId)!;
    expect(before.rawNotes).toContain("مدیریت زمان");

    const result = await sessionSummary.summarizeSessionWithAi({
      sessionId: ids.sessionId,
      actor,
    });

    const after = sessions.getSessionById(ids.sessionId)!;
    expect(after.rawNotes).toBe(before.rawNotes);
    expect(result.summaryApplied).toBe(true);
    expect(after.summary).toBeTruthy();
    expect(result.interaction.relatedType).toBe("session");
    expect(result.interaction.relatedId).toBe(ids.sessionId);
  });

  it("suggests next actions and creates Action only on accept", async () => {
    const actor = asUser(ids.mentor, ROLE_KEYS.MENTOR, ids.mentorRoleId);
    const suggestion = await nextActions.suggestNextActions({
      studentId: ids.studentId,
      actor,
      sessionId: ids.sessionId,
    });

    expect(suggestion.suggestions.length).toBeGreaterThan(0);
    expect(suggestion.interaction.accepted).toBeNull();

    const first = suggestion.suggestions[0];
    const accepted = nextActions.acceptSuggestedAction({
      interactionId: suggestion.interaction.id,
      actor,
      title: first.title,
      description: first.description,
    });

    expect(accepted.action.title).toBe(first.title);
    expect(accepted.action.studentId).toBe(ids.studentId);
    expect(accepted.interaction.accepted).toMatch(/accepted|edited/);

    const rejected = await nextActions.suggestNextActions({
      studentId: ids.studentId,
      actor,
    });
    const afterReject = nextActions.rejectAiSuggestion({
      interactionId: rejected.interaction.id,
      actor,
    });
    expect(afterReject.accepted).toBe("rejected");
  });

  it("lists interactions with limit", () => {
    const rows = interactions.listAiInteractions({
      studentId: ids.studentId,
      limit: 2,
    });
    expect(rows.length).toBeLessThanOrEqual(2);
  });
});
