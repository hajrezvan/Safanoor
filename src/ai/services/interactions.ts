import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiInteractions, type AiInteraction } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

export type PersistAiInteractionInput = {
  feature: string;
  model: string;
  contextMeta?: unknown;
  output: string;
  createdBy: string;
  studentId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  accepted?: string | null;
};

export function persistAiInteraction(input: PersistAiInteractionInput): AiInteraction {
  const id = createId("ai");
  const now = nowIso();
  db.insert(aiInteractions)
    .values({
      id,
      feature: input.feature,
      model: input.model,
      createdAt: now,
      contextMeta: input.contextMeta != null ? JSON.stringify(input.contextMeta) : null,
      output: input.output,
      accepted: input.accepted ?? null,
      createdBy: input.createdBy,
      studentId: input.studentId ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
    })
    .run();

  return getAiInteractionById(id)!;
}

export function getAiInteractionById(id: string): AiInteraction | undefined {
  return db.select().from(aiInteractions).where(eq(aiInteractions.id, id)).get();
}

export function setAiInteractionAccepted(
  id: string,
  accepted: "accepted" | "rejected" | "edited",
): AiInteraction {
  const existing = getAiInteractionById(id);
  if (!existing) throw new Error("تعامل AI یافت نشد.");

  db.update(aiInteractions)
    .set({ accepted })
    .where(eq(aiInteractions.id, id))
    .run();

  return getAiInteractionById(id)!;
}

export type AiInteractionFilters = {
  studentId?: string;
  createdBy?: string;
  feature?: string;
  relatedType?: string;
  relatedId?: string;
  pendingOnly?: boolean;
  limit?: number;
};

export function listAiInteractions(filters: AiInteractionFilters = {}): AiInteraction[] {
  const conditions = [];
  if (filters.studentId) conditions.push(eq(aiInteractions.studentId, filters.studentId));
  if (filters.createdBy) conditions.push(eq(aiInteractions.createdBy, filters.createdBy));
  if (filters.feature) conditions.push(eq(aiInteractions.feature, filters.feature));
  if (filters.relatedType) conditions.push(eq(aiInteractions.relatedType, filters.relatedType));
  if (filters.relatedId) conditions.push(eq(aiInteractions.relatedId, filters.relatedId));

  let rows = db
    .select()
    .from(aiInteractions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(aiInteractions.createdAt))
    .all();

  if (filters.pendingOnly) {
    rows = rows.filter((r) => r.accepted == null || r.accepted === "");
  }

  return filters.limit ? rows.slice(0, filters.limit) : rows;
}
