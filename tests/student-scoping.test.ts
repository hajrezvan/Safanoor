import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { ASSIGNMENT_ROLE, ROLE_KEYS, ROLE_TITLES_FA, STUDENT_STATUS } from "@/lib/enums";

/**
 * سرویس‌ها به db singleton وصل‌اند، پس مسیر دیتابیس باید قبل از import ماژول ست شود.
 */
const dbPath = path.join(os.tmpdir(), `safanoor-scoping-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

type StudentsService = typeof import("@/server/modules/students/service");
type GradesService = typeof import("@/server/modules/grades/service");

let studentsService: StudentsService;
let gradesService: GradesService;

const ids = {
  mentorA: "",
  mentorB: "",
  assistantA: "",
  studentOfMentorA: "",
  studentOfMentorB: "",
  sharedStudent: "",
};

describe("student scoping", () => {
  let sqlite: Database.Database;

  beforeAll(async () => {
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrate(drizzle(sqlite, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    sqlite.close();

    studentsService = await import("@/server/modules/students/service");
    gradesService = await import("@/server/modules/grades/service");
    const { db } = await import("@/db/client");

    const now = nowIso();

    for (const key of Object.values(ROLE_KEYS)) {
      db.insert(schema.roles)
        .values({
          id: createId("role"),
          key,
          titleFa: ROLE_TITLES_FA[key],
          createdAt: now,
        })
        .run();
    }

    const roleIdByKey = Object.fromEntries(
      db
        .select()
        .from(schema.roles)
        .all()
        .map((role) => [role.key, role.id]),
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

    ids.mentorA = addUser("مربی الف", "mentor_a", ROLE_KEYS.MENTOR);
    ids.mentorB = addUser("مربی ب", "mentor_b", ROLE_KEYS.MENTOR);
    ids.assistantA = addUser("کمک‌مربی الف", "assistant_a", ROLE_KEYS.ASSISTANT_MENTOR);

    gradesService.seedGrades();
    const grade = gradesService.getGradeByKey(gradesService.GRADE_KEYS.EIGHTH)!;

    const studentUserA = addUser("حسین رجایی", "std_a", ROLE_KEYS.STUDENT);
    const studentUserB = addUser("مرتضی شریفی", "std_b", ROLE_KEYS.STUDENT);
    const studentUserC = addUser("جواد قاسمی", "std_c", ROLE_KEYS.STUDENT);

    ids.studentOfMentorA = studentsService.createStudent({
      userId: studentUserA,
      gradeId: grade.id,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: ids.mentorA,
    })!.id;

    ids.studentOfMentorB = studentsService.createStudent({
      userId: studentUserB,
      gradeId: grade.id,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: ids.mentorB,
    })!.id;

    ids.sharedStudent = studentsService.createStudent({
      userId: studentUserC,
      gradeId: grade.id,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: ids.mentorA,
      assistantUserId: ids.assistantA,
    })!.id;
  });

  afterAll(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("mentor only sees students assigned to them", () => {
    const scoped = studentsService.getStudentIdsForStaff(ids.mentorA, ROLE_KEYS.MENTOR);
    expect(scoped).toContain(ids.studentOfMentorA);
    expect(scoped).toContain(ids.sharedStudent);
    expect(scoped).not.toContain(ids.studentOfMentorB);
  });

  it("assistant only sees students assigned to them as assistant", () => {
    const scoped = studentsService.getStudentIdsForStaff(
      ids.assistantA,
      ROLE_KEYS.ASSISTANT_MENTOR,
    );
    expect(scoped).toEqual([ids.sharedStudent]);
  });

  it("mentor role does not inherit assistant assignments", () => {
    const asMentor = studentsService.getStudentIdsForStaff(
      ids.assistantA,
      ROLE_KEYS.MENTOR,
    );
    expect(asMentor).toEqual([]);
  });

  it("listStudentsForStaff limits rows to the staff scope", () => {
    const rows = studentsService.listStudentsForStaff(ids.mentorB, ROLE_KEYS.MENTOR);
    expect(rows.map((row) => row.id)).toEqual([ids.studentOfMentorB]);
  });

  it("admin sees every student", () => {
    const rows = studentsService.listStudentsForStaff("any-admin-id", ROLE_KEYS.ADMIN);
    expect(rows.length).toBe(3);
  });

  it("canStaffAccessStudent blocks out-of-scope access", () => {
    expect(
      studentsService.canStaffAccessStudent(
        ids.mentorA,
        ROLE_KEYS.MENTOR,
        ids.studentOfMentorB,
      ),
    ).toBe(false);
    expect(
      studentsService.canStaffAccessStudent(
        ids.mentorA,
        ROLE_KEYS.MENTOR,
        ids.studentOfMentorA,
      ),
    ).toBe(true);
  });

  it("reassigning a mentor archives the previous assignment", () => {
    studentsService.setStaffAssignment({
      studentId: ids.studentOfMentorA,
      staffUserId: ids.mentorB,
      assignmentRole: ASSIGNMENT_ROLE.MENTOR,
    });

    expect(
      studentsService.getStudentIdsForStaff(ids.mentorA, ROLE_KEYS.MENTOR),
    ).not.toContain(ids.studentOfMentorA);
    expect(studentsService.getStudentIdsForStaff(ids.mentorB, ROLE_KEYS.MENTOR)).toContain(
      ids.studentOfMentorA,
    );

    const history = studentsService.listAssignmentHistory(ids.studentOfMentorA);
    expect(history.length).toBe(2);
    expect(history.filter((item) => item.isActive).length).toBe(1);
  });
});
