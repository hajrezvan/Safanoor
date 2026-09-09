import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { ROLE_KEYS, ROLE_TITLES_FA } from "@/lib/enums";
import { createId, nowIso } from "@/lib/id";
import { hasRole } from "@/server/authz/policy";
import type { AuthUser } from "@/server/auth/session";

describe("password hashing", () => {
  it("hashes and verifies with argon2id", async () => {
    const hash = await hashPassword("Test@1234");
    expect(hash).toBeTruthy();
    expect(await verifyPassword(hash, "Test@1234")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });
});

describe("authz policy", () => {
  const admin: AuthUser = {
    id: "1",
    username: "admin",
    fullName: "مدیر",
    roleId: "r1",
    roleKey: ROLE_KEYS.ADMIN,
  };

  it("checks roles", () => {
    expect(hasRole(admin, ROLE_KEYS.ADMIN)).toBe(true);
    expect(hasRole(admin, ROLE_KEYS.STUDENT)).toBe(false);
  });
});

describe("sqlite migration smoke", () => {
  let dbPath: string;
  let sqlite: Database.Database;

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `safanoor-test-${Date.now()}.db`);
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  });

  afterAll(() => {
    sqlite.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("applies schema and inserts a role", () => {
    const db = drizzle(sqlite, { schema });
    const now = nowIso();
    db.insert(schema.roles)
      .values({
        id: createId("role"),
        key: ROLE_KEYS.ADMIN,
        titleFa: ROLE_TITLES_FA.admin,
        createdAt: now,
      })
      .run();

    const row = db.select().from(schema.roles).get();
    expect(row?.key).toBe(ROLE_KEYS.ADMIN);
  });
});
