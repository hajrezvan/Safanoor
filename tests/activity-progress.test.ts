import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  ACTIVITY_ASSIGNMENT_STATUS,
  ACTIVITY_STATUS,
  ACTIVITY_TYPE,
  ROLE_KEYS,
} from "@/lib/enums";

const dbPath = path.join(os.tmpdir(), `safanoor-activities-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

let service: typeof import("@/server/modules/activities/service");
const ids = {
  mentor: "usr_mentor",
  studentUser: "usr_student",
  student: "student_act",
  activity: "",
  assignment: "",
};

describe("activity progress lifecycle", () => {
  beforeAll(async () => {
    const sqlite = new Database(dbPath);
    migrate(drizzle(sqlite, { schema }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    sqlite.close();

    const { db } = await import("@/db/client");
    const now = new Date().toISOString();
    db.insert(schema.roles)
      .values({
        id: "role_student",
        key: ROLE_KEYS.STUDENT,
        titleFa: "دانش‌آموز",
        createdAt: now,
      })
      .run();
    db.insert(schema.users)
      .values({
        id: ids.studentUser,
        username: "act_student",
        passwordHash: "x",
        fullName: "دانش‌آموز فعالیت",
        roleId: "role_student",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(schema.users)
      .values({
        id: ids.mentor,
        username: "act_mentor",
        passwordHash: "x",
        fullName: "مربی فعالیت",
        roleId: "role_student",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(schema.grades)
      .values({ id: "grade_act", key: "act", titleFa: "پایه تست", ordering: 1, createdAt: now })
      .run();
    db.insert(schema.students)
      .values({
        id: ids.student,
        userId: ids.studentUser,
        gradeId: "grade_act",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    service = await import("@/server/modules/activities/service");
    const activity = service.createActivity({
      title: "تمرین نوشتن روزانه",
      type: ACTIVITY_TYPE.WRITING,
      status: ACTIVITY_STATUS.PUBLISHED,
      instructions: "یک پاراگراف بنویس",
      expectedOutput: "متن کوتاه",
    })!;
    ids.activity = activity.id;
    const assignment = service.assignActivityToStudent({
      activityId: ids.activity,
      studentId: ids.student,
      dueDate: "2099-01-01",
    })!;
    ids.assignment = assignment.id;
  });

  afterAll(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("submits progress into assignment and progress_records", () => {
    const submitted = service.submitActivityProgress(
      {
        assignmentId: ids.assignment,
        reportText: "متن را نوشتم و بازخوانی کردم.",
        evidenceUrl: "https://example.com/evidence",
        markDone: true,
      },
      ids.studentUser,
    )!;
    expect(submitted.status).toBe(ACTIVITY_ASSIGNMENT_STATUS.SUBMITTED);
    expect(submitted.result).toContain("بازخوانی");
    expect(submitted.evidenceUrl).toBe("https://example.com/evidence");
    expect(submitted.progressStatus).toBeTruthy();
  });

  it("applies mentor feedback and marks reviewed", () => {
    const reviewed = service.provideMentorFeedback(
      {
        assignmentId: ids.assignment,
        feedback: "عالی؛ هفته بعد روی انسجام تمرکز کن.",
      },
      ids.mentor,
    )!;
    expect(reviewed.status).toBe(ACTIVITY_ASSIGNMENT_STATUS.REVIEWED);
    expect(reviewed.feedback).toContain("انسجام");
    expect(reviewed.mentorFeedback).toContain("انسجام");
  });

  it("rejects duplicate assignment", () => {
    expect(() =>
      service.assignActivityToStudent({
        activityId: ids.activity,
        studentId: ids.student,
      }),
    ).toThrow("قبلاً");
  });
});
