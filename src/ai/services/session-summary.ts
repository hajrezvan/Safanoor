import { eq } from "drizzle-orm";
import { getAIProvider } from "@/ai/provider";
import { buildSessionSummaryPrompt, displayTextFromAiOutput } from "@/ai/context/builder";
import { persistAiInteraction } from "@/ai/services/interactions";
import { AI_FEATURES, assertCanUseAiForStudent } from "@/ai/services/mentor-assist";
import { db } from "@/db/client";
import { mentoringSessions } from "@/db/schema";
import type { AuthUser } from "@/server/auth/session";
import { getSessionById } from "@/server/modules/sessions/service";

/**
 * خلاصه‌سازی جلسه با AI.
 * rawNotes هرگز بازنویسی نمی‌شود.
 * اگر summary خالی باشد، متن ساختاریافته در summary نوشته می‌شود؛
 * همیشه در ai_interactions با relatedType=session ذخیره می‌شود.
 */
export async function summarizeSessionWithAi(opts: {
  sessionId: string;
  actor: AuthUser;
  rawNotesOverride?: string;
}) {
  const session = getSessionById(opts.sessionId);
  if (!session) throw new Error("جلسه یافت نشد.");

  assertCanUseAiForStudent(opts.actor, session.studentId);

  const rawNotes = (opts.rawNotesOverride ?? session.rawNotes ?? "").trim();
  if (rawNotes.length < 10) {
    throw new Error("برای خلاصه‌سازی، یادداشت خام جلسه باید حداقل ۱۰ نویسه باشد.");
  }

  const { system, prompt, contextMeta } = buildSessionSummaryPrompt(rawNotes);
  const result = await getAIProvider().generate({
    system,
    prompt,
    feature: AI_FEATURES.SESSION_SUMMARY,
  });

  const display = displayTextFromAiOutput(result.text);

  const interaction = persistAiInteraction({
    feature: AI_FEATURES.SESSION_SUMMARY,
    model: result.model ?? result.provider,
    contextMeta: {
      ...contextMeta,
      sessionId: session.id,
      hadExistingSummary: Boolean(session.summary?.trim()),
    },
    output: result.text,
    createdBy: opts.actor.id,
    studentId: session.studentId,
    relatedType: "session",
    relatedId: session.id,
  });

  // فقط اگر summary خالی است در فیلد جلسه بنویس؛ rawNotes دست نخورده می‌ماند
  if (!session.summary?.trim()) {
    db.update(mentoringSessions)
      .set({ summary: display.slice(0, 2000) })
      .where(eq(mentoringSessions.id, session.id))
      .run();
  }

  // مشاهدات: اگر خالی بود بخشی از خروجی AI را بگذار (بدون لمس rawNotes)
  if (!session.observations?.trim()) {
    const obsMatch = display.match(/###\s*مشاهدات\s*\n([\s\S]*?)(?=\n###|$)/);
    if (obsMatch?.[1]?.trim()) {
      db.update(mentoringSessions)
        .set({ observations: obsMatch[1].trim().slice(0, 2000) })
        .where(eq(mentoringSessions.id, session.id))
        .run();
    }
  }

  return {
    interaction,
    output: display,
    summaryApplied: !session.summary?.trim(),
    session: getSessionById(session.id)!,
  };
}
