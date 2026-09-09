import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

function resolveDatabasePath() {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
}

function createConnection() {
  const databasePath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createConnection>;

const globalForDb = globalThis as unknown as { __safanoorDb?: Db };

export const db = globalForDb.__safanoorDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__safanoorDb = db;
}

export function getDatabasePath() {
  return resolveDatabasePath();
}
