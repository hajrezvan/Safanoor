import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  ANNOUNCEMENT_AUDIENCE,
  ANNOUNCEMENT_STATUS,
  ROLE_KEYS,
} from "@/lib/enums";

const dbPath = path.join(os.tmpdir(), `safanoor-announcements-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

let service: typeof import("@/server/modules/announcements/service");

describe("announcements service", () => {
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
        id: "role_admin",
        key: ROLE_KEYS.ADMIN,
        titleFa: "مدیر",
        createdAt: now,
      })
      .run();

    db.insert(schema.users)
      .values({
        id: "usr_admin",
        username: "admin_ann",
        email: null,
        passwordHash: "x",
        fullName: "مدیر تست",
        roleId: "role_admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.grades)
      .values({
        id: "grd_1",
        key: "seventh",
        titleFa: "هفتم",
        ordering: 1,
        createdAt: now,
      })
      .run();

    db.insert(schema.students)
      .values({
        id: "std_ann",
        userId: null,
        gradeId: "grd_1",
        groupId: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    service = await import("@/server/modules/announcements/service");
  });

  afterAll(() => {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  });

  it("creates, publishes, and lists for student", () => {
    const created = service.createAnnouncement({
      title: "تست اطلاعیه",
      body: "متن تست",
      authorUserId: "usr_admin",
      audience: ANNOUNCEMENT_AUDIENCE.ALL_STUDENTS,
      status: ANNOUNCEMENT_STATUS.DRAFT,
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe(ANNOUNCEMENT_STATUS.DRAFT);

    const published = service.publishAnnouncement(created.id);
    expect(published.status).toBe(ANNOUNCEMENT_STATUS.PUBLISHED);
    expect(published.publishedAt).toBeTruthy();

    const all = service.listAnnouncements();
    expect(all.some((a) => a.id === created.id)).toBe(true);

    const forStudent = service.listPublishedForStudent("std_ann");
    expect(forStudent.some((a) => a.id === created.id)).toBe(true);
  });
});
