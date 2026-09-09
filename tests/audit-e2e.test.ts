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
  ACTION_STATUS,
  ACTION_TYPE,
  GOAL_STATUS,
  GROWTH_PATH_STATUS,
  PLAN_STATUS,
  PRIORITY,
  REFERRAL_STATUS,
  ROLE_KEYS,
  ROLE_TITLES_FA,
  SESSION_CONFIDENTIALITY,
  STUDENT_STATUS,
} from "@/lib/enums";

const dbPath = path.join(os.tmpdir(), `safanoor-audit-e2e-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

let audit: typeof import("@/server/modules/audit/service");
let students: typeof import("@/server/modules/students/service");
let plans: typeof import("@/server/modules/plans/service");
let grades: typeof import("@/server/modules/grades/service");
let paths: typeof import("@/server/modules/paths/service");
let chat: typeof import("@/server/modules/chat/service");
let sessions: typeof import("@/server/modules/sessions/service");
let referrals: typeof import("@/server/modules/referrals/service");
let nextActions: typeof import("@/ai/services/next-actions");

const ids = {
  admin: "",
  mentor: "",
  assistant: "",
  studentUser: "",
  studentId: "",
  mentorRoleId: "",
};

describe("audit trail and E2E composition", () => {
  beforeAll(async () => {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrate(drizzle(sqlite, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    sqlite.close();

    audit = await import("@/server/modules/audit/service");
    students = await import("@/server/modules/students/service");
    plans = await import("@/server/modules/plans/service");
    grades = await import("@/server/modules/grades/service");
    paths = await import("@/server/modules/paths/service");
    chat = await import("@/server/modules/chat/service");
    sessions = await import("@/server/modules/sessions/service");
    referrals = await import("@/server/modules/referrals/service");
    nextActions = await import("@/ai/services/next-actions");

    const { db } = await import("@/db/client");
    const now = nowIso();

    for (const key of Object.values(ROLE_KEYS)) {
      db.insert(schema.roles)
        .values({ id: createId("role"), key, titleFa: ROLE_TITLES_FA[key], createdAt: now })
        .run();
    }

    const roleByKey = Object.fromEntries(
      db.select().from(schema.roles).all().map((r) => [r.key, r.id]),
    );
    ids.mentorRoleId = roleByKey[ROLE_KEYS.MENTOR];

    ids.admin = createId("usr");
    ids.mentor = createId("usr");
    ids.assistant = createId("usr");
    ids.studentUser = createId("usr");

    for (const [userId, username, roleKey, fullName] of [
      [ids.admin, "admin_aud", ROLE_KEYS.ADMIN, "مدیر"],
      [ids.mentor, "mentor_aud", ROLE_KEYS.MENTOR, "مربی"],
      [ids.assistant, "assist_aud", ROLE_KEYS.ASSISTANT_MENTOR, "کمک‌مربی"],
      [ids.studentUser, "student_aud", ROLE_KEYS.STUDENT, "دانش‌آموز"],
    ] as const) {
      db.insert(schema.users)
        .values({
          id: userId,
          username,
          passwordHash: "x",
          fullName,
          roleId: roleByKey[roleKey],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    grades.seedGrades();
    const grade = grades.getGradeByKey(grades.GRADE_KEYS.EIGHTH)!;
    const student = students.createStudent(
      {
        userId: ids.studentUser,
        gradeId: grade.id,
        status: STUDENT_STATUS.ACTIVE,
        mentorUserId: ids.mentor,
        assistantUserId: ids.assistant,
      },
      ids.admin,
    )!;
    ids.studentId = student.id;
  });

  afterAll(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("records audit for student create and assignment", () => {
    const events = audit.listAuditEventsForStudent(ids.studentId);
    expect(events.some((e) => e.entityType === "student" && e.action === "create")).toBe(true);
    expect(events.some((e) => e.entityType === "mentor_assignment")).toBe(true);
  });

  it("composes goal → plan → action relations", () => {
    const categories = plans.seedGoalCategories();
    const goal = plans.createGoal({
      studentId: ids.studentId,
      title: "هدف تست رابطه",
      categoryId: categories[0].id,
      priority: PRIORITY.MEDIUM,
      startDate: nowIso(),
      status: GOAL_STATUS.ACTIVE,
      createdBy: ids.mentor,
    })!;
    const plan = plans.createIndividualPlan({
      studentId: ids.studentId,
      title: "برنامه تست",
      status: PLAN_STATUS.ACTIVE,
      createdBy: ids.mentor,
    })!;
    const action = plans.createAction({
      studentId: ids.studentId,
      planId: plan.id,
      goalId: goal.id,
      title: "اقدام وابسته",
      type: ACTION_TYPE.TASK,
      assigneeUserId: ids.studentUser,
      startDate: nowIso(),
      status: ACTION_STATUS.TODO,
      priority: PRIORITY.MEDIUM,
      createdBy: ids.mentor,
    })!;

    expect(action.planId).toBe(plan.id);
    expect(action.goalId).toBe(goal.id);
    expect(plans.listGoalsForStudent(ids.studentId).map((g) => g.id)).toContain(goal.id);
    expect(plans.listPlansForStudent(ids.studentId).map((p) => p.id)).toContain(plan.id);
  });

  it("walks mentoring flow pieces for one student", () => {
    const path = paths.createGrowthPath({
      title: "مسیر تست E2E",
      description: "مسیر نمونه",
      gradeId: grades.getGradeByKey(grades.GRADE_KEYS.EIGHTH)!.id,
      status: GROWTH_PATH_STATUS.ACTIVE,
      ordering: 1,
    });
    paths.setActiveEnrollment(ids.studentId, path.id);

    const conv = chat.getOrCreateActiveConversation(ids.studentUser, ids.assistant);
    chat.sendMessage(conv.id, ids.studentUser, "سلام برای تست");
    sessions.createSession({
      studentId: ids.studentId,
      staffUserId: ids.assistant,
      date: nowIso(),
      type: "حضوری",
      durationMinutes: 30,
      topics: "پیگیری",
      summary: "خلاصه",
      rawNotes: "یادداشت خام",
      confidentiality: SESSION_CONFIDENTIALITY.NORMAL,
      referralRequired: false,
    });
    const referral = referrals.createReferral({
      studentId: ids.studentId,
      createdBy: ids.assistant,
      assignedTo: ids.mentor,
      subject: "ارجاع تست",
      description: "توضیح",
      priority: PRIORITY.MEDIUM,
      status: REFERRAL_STATUS.OPEN,
    });
    referrals.updateReferralStatus(
      { id: referral.id, status: REFERRAL_STATUS.IN_REVIEW },
      ids.mentor,
      ROLE_KEYS.MENTOR,
    );

    expect(paths.getActiveEnrollment(ids.studentId)?.pathId).toBe(path.id);
    expect(chat.summarizeChatForStudent(ids.studentId).messageCount).toBeGreaterThan(0);
    expect(sessions.listSessions({ studentId: ids.studentId }).length).toBeGreaterThan(0);
    expect(referrals.listReferrals({ studentId: ids.studentId }).length).toBeGreaterThan(0);

    plans.transitionActionStatus(
      plans.listActionsForStudent(ids.studentId)[0]!.id,
      ACTION_STATUS.IN_PROGRESS,
      ids.mentor,
    );
    const auditEvents = audit.listAuditEventsForStudent(ids.studentId);
    expect(auditEvents.some((e) => e.entityType === "action")).toBe(true);
    expect(auditEvents.some((e) => e.entityType === "referral")).toBe(true);
  });

  it("audits AI accept and reject", async () => {
    const actor = {
      id: ids.mentor,
      username: "mentor_aud",
      fullName: "مربی",
      roleId: ids.mentorRoleId,
      roleKey: ROLE_KEYS.MENTOR,
    };
    const suggestion = await nextActions.suggestNextActions({
      studentId: ids.studentId,
      actor,
    });
    nextActions.acceptSuggestedAction({
      interactionId: suggestion.interaction.id,
      actor,
      title: suggestion.suggestions[0]?.title ?? "اقدام AI",
    });
    const second = await nextActions.suggestNextActions({
      studentId: ids.studentId,
      actor,
    });
    nextActions.rejectAiSuggestion({ interactionId: second.interaction.id, actor });

    const events = audit.listAuditEventsForStudent(ids.studentId);
    expect(events.some((e) => e.entityType === "ai_interaction" && e.action === "accept")).toBe(
      true,
    );
    expect(events.some((e) => e.entityType === "ai_interaction" && e.action === "reject")).toBe(
      true,
    );
  });
});
