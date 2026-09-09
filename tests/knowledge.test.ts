import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_ITEM_STATUS } from "@/lib/enums";

const dbPath = path.join(os.tmpdir(), `safanoor-knowledge-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;

let service: typeof import("@/server/modules/knowledge/service");

describe("knowledge base", () => {
  beforeAll(async () => {
    const sqlite = new Database(dbPath);
    migrate(drizzle(sqlite), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    sqlite.close();
    service = await import("@/server/modules/knowledge/service");
  });

  afterAll(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${dbPath}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("creates, filters, updates, and deletes knowledge items", () => {
    const created = service.createKnowledgeItem({
      title: "تست اضطراب امتحان",
      category: KNOWLEDGE_CATEGORIES.EXAM_ANXIETY,
      questionScenario: "دانش‌آموز شب امتحان مضطرب است و نمی‌خوابد.",
      recommendedApproach: "مرور سبک و روتین آرام‌سازی پیشنهاد بده.",
      cautions: "دارو پیشنهاد نکن.",
      tags: "اضطراب، امتحان",
      status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
    });

    expect(created.id).toMatch(/^knw_/);
    expect(
      service.listKnowledgeItems({ category: KNOWLEDGE_CATEGORIES.EXAM_ANXIETY }).map((i) => i.id),
    ).toContain(created.id);
    expect(service.listKnowledgeItems({ search: "نمی‌خوابد" }).map((i) => i.id)).toContain(
      created.id,
    );
    expect(service.listKnowledgeItems({ tag: "اضطراب" }).map((i) => i.id)).toContain(created.id);
    expect(
      service.listKnowledgeItems({ status: KNOWLEDGE_ITEM_STATUS.DRAFT }).map((i) => i.id),
    ).not.toContain(created.id);

    const updated = service.updateKnowledgeItem({
      id: created.id,
      title: "تست اضطراب امتحان به‌روز",
      category: KNOWLEDGE_CATEGORIES.EXAM_ANXIETY,
      questionScenario: created.questionScenario,
      recommendedApproach: created.recommendedApproach,
      cautions: created.cautions ?? "",
      tags: "اضطراب، خواب",
      status: KNOWLEDGE_ITEM_STATUS.ARCHIVED,
    });
    expect(updated.title).toContain("به‌روز");
    expect(updated.status).toBe(KNOWLEDGE_ITEM_STATUS.ARCHIVED);

    service.deleteKnowledgeItem(created.id);
    expect(service.getKnowledgeItemById(created.id)).toBeUndefined();
  });

  it("seeds Persian mentoring scenarios idempotently", () => {
    const first = service.seedKnowledgeItems();
    expect(first.created).toBeGreaterThan(0);
    const second = service.seedKnowledgeItems();
    expect(second.created).toBe(0);
    expect(second.total).toBeGreaterThanOrEqual(first.total);
    expect(service.listKnowledgeItems({ search: "انگیزه" }).length).toBeGreaterThan(0);
  });
});
