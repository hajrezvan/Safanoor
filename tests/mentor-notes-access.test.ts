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
  NOTE_VISIBILITY,
  REFERRAL_STATUS,
  ROLE_KEYS,
  ROLE_TITLES_FA,
  STUDENT_STATUS,
} from "@/lib/enums";

const dbPath = path.join(os.tmpdir(), `safanoor-notes-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

type NotesService = typeof import("@/server/modules/notes/service");
type ReferralsService = typeof import("@/server/modules/referrals/service");
type StudentsService = typeof import("@/server/modules/students/service");
type GradesService = typeof import("@/server/modules/grades/service");

let notes: NotesService;
let referrals: ReferralsService;
let students: StudentsService;
let grades: GradesService;

const ids = {
  mentor: "",
  assistant: "",
  studentUser: "",
  studentId: "",
};

describe("mentor notes access and referral lifecycle", () => {
  beforeAll(async () => {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrate(drizzle(sqlite, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    sqlite.close();

    notes = await import("@/server/modules/notes/service");
    referrals = await import("@/server/modules/referrals/service");
    students = await import("@/server/modules/students/service");
    grades = await import("@/server/modules/grades/service");
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

    ids.mentor = addUser("مربی", "mentor_n", ROLE_KEYS.MENTOR);
    ids.assistant = addUser("کمک‌مربی", "assist_n", ROLE_KEYS.ASSISTANT_MENTOR);
    ids.studentUser = addUser("دانش‌آموز", "student_n", ROLE_KEYS.STUDENT);

    grades.seedGrades();
    const grade = grades.getGradeByKey(grades.GRADE_KEYS.EIGHTH)!;
    ids.studentId = students.createStudent({
      userId: ids.studentUser,
      gradeId: grade.id,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: ids.mentor,
      assistantUserId: ids.assistant,
    })!.id;

    notes.createNote({
      authorUserId: ids.assistant,
      studentId: ids.studentId,
      content: "یادداشت قابل مشاهده برای دانش‌آموز",
      visibility: NOTE_VISIBILITY.STUDENT_VISIBLE,
    });
    notes.createNote({
      authorUserId: ids.assistant,
      studentId: ids.studentId,
      content: "یادداشت خصوصی پشتیبان",
      visibility: NOTE_VISIBILITY.PRIVATE_STAFF,
    });
    notes.createNote({
      authorUserId: ids.mentor,
      studentId: ids.studentId,
      content: "یادداشت فقط مربی",
      visibility: NOTE_VISIBILITY.MENTOR_ONLY,
    });
  });

  afterAll(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("student only sees STUDENT_VISIBLE notes", () => {
    const visible = notes.listNotesForStudent(
      ids.studentId,
      ids.studentUser,
      ROLE_KEYS.STUDENT,
    );
    expect(visible).toHaveLength(1);
    expect(visible[0].visibility).toBe(NOTE_VISIBILITY.STUDENT_VISIBLE);
  });

  it("assistant cannot see MENTOR_ONLY notes", () => {
    const visible = notes.listNotesForStudent(
      ids.studentId,
      ids.assistant,
      ROLE_KEYS.ASSISTANT_MENTOR,
    );
    expect(visible.every((n) => n.visibility !== NOTE_VISIBILITY.MENTOR_ONLY)).toBe(true);
    expect(visible.some((n) => n.visibility === NOTE_VISIBILITY.PRIVATE_STAFF)).toBe(true);
  });

  it("mentor sees all visibility levels for scoped student", () => {
    const visible = notes.listNotesForStudent(ids.studentId, ids.mentor, ROLE_KEYS.MENTOR);
    expect(visible).toHaveLength(3);
  });

  it("supports referral OPEN → IN_REVIEW → RESOLVED lifecycle", () => {
    const created = referrals.createReferral({
      studentId: ids.studentId,
      createdBy: ids.assistant,
      assignedTo: ids.mentor,
      subject: "ارجاع تستی",
      description: "نیاز به بررسی مربی",
      priority: "high",
      status: REFERRAL_STATUS.OPEN,
    });

    const reviewing = referrals.updateReferralStatus(
      { id: created.id, status: REFERRAL_STATUS.IN_REVIEW },
      ids.mentor,
      ROLE_KEYS.MENTOR,
    );
    expect(reviewing.status).toBe(REFERRAL_STATUS.IN_REVIEW);

    const resolved = referrals.updateReferralStatus(
      {
        id: created.id,
        status: REFERRAL_STATUS.RESOLVED,
        response: "بررسی شد و اقدام لازم تعریف گردید.",
      },
      ids.mentor,
      ROLE_KEYS.MENTOR,
    );
    expect(resolved.status).toBe(REFERRAL_STATUS.RESOLVED);
    expect(resolved.resolvedAt).toBeTruthy();
  });
});
