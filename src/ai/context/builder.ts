/**
 * Context Builder کنترل‌شده برای مربی‌یار — هرگز کل DB را در prompt نگذار.
 */
import { AI_SAFETY_SYSTEM } from "@/ai/prompts/safety";

export const MENTOR_ASSIST_REQUEST = {
  STATUS_SUMMARY: "status_summary",
  SESSION_TOPICS: "session_topics",
  SUGGESTED_QUESTIONS: "suggested_questions",
  NEXT_ACTIONS: "next_actions",
} as const;

export type MentorAssistRequestType =
  (typeof MENTOR_ASSIST_REQUEST)[keyof typeof MENTOR_ASSIST_REQUEST];

export const MENTOR_ASSIST_REQUEST_TITLES_FA: Record<MentorAssistRequestType, string> = {
  [MENTOR_ASSIST_REQUEST.STATUS_SUMMARY]: "خلاصه وضعیت",
  [MENTOR_ASSIST_REQUEST.SESSION_TOPICS]: "موضوعات جلسه",
  [MENTOR_ASSIST_REQUEST.SUGGESTED_QUESTIONS]: "سؤالات پیشنهادی",
  [MENTOR_ASSIST_REQUEST.NEXT_ACTIONS]: "اقدامات بعدی",
};

/** سقف‌های ایمنی برای جلوگیری از dump کل DB */
export const CONTEXT_LIMITS = {
  maxGoals: 5,
  maxActions: 8,
  maxSessions: 5,
  maxReferrals: 5,
  maxKnowledge: 5,
  maxNotes: 3,
  maxPlans: 3,
  maxTextChars: 280,
  maxNoteChars: 200,
} as const;

export type MentorAssistContext = {
  studentName: string;
  gradeTitle?: string;
  interests?: string;
  skills?: string;
  academicStatus?: string;
  activeGoals: Array<{ title: string; status: string; priority: string }>;
  openActions: Array<{ title: string; status: string; deadline?: string | null }>;
  recentSessions: Array<{ date: string; summary?: string | null; topics?: string | null }>;
  openReferrals: Array<{ subject: string; priority: string; status: string }>;
  knowledgeHints: Array<{ title: string; approach: string }>;
  /** فقط وقتی مجوز NOTES_MANAGE و دسترسی مشاهده وجود دارد */
  recentNotes?: Array<{ visibility: string; excerpt: string }>;
  planTitles?: string[];
};

export function truncateText(value: string | null | undefined, max: number = CONTEXT_LIMITS.maxTextChars) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export function enforceContextLimits(ctx: MentorAssistContext): MentorAssistContext {
  return {
    studentName: truncateText(ctx.studentName, 80) ?? "دانش‌آموز",
    gradeTitle: truncateText(ctx.gradeTitle, 80),
    interests: truncateText(ctx.interests),
    skills: truncateText(ctx.skills),
    academicStatus: truncateText(ctx.academicStatus),
    activeGoals: ctx.activeGoals.slice(0, CONTEXT_LIMITS.maxGoals).map((g) => ({
      title: truncateText(g.title, 120) ?? "",
      status: g.status,
      priority: g.priority,
    })),
    openActions: ctx.openActions.slice(0, CONTEXT_LIMITS.maxActions).map((a) => ({
      title: truncateText(a.title, 120) ?? "",
      status: a.status,
      deadline: a.deadline ?? null,
    })),
    recentSessions: ctx.recentSessions.slice(0, CONTEXT_LIMITS.maxSessions).map((s) => ({
      date: s.date.slice(0, 10),
      summary: truncateText(s.summary),
      topics: truncateText(s.topics, 120),
    })),
    openReferrals: ctx.openReferrals.slice(0, CONTEXT_LIMITS.maxReferrals).map((r) => ({
      subject: truncateText(r.subject, 120) ?? "",
      priority: r.priority,
      status: r.status,
    })),
    knowledgeHints: ctx.knowledgeHints.slice(0, CONTEXT_LIMITS.maxKnowledge).map((k) => ({
      title: truncateText(k.title, 100) ?? "",
      approach: truncateText(k.approach) ?? "",
    })),
    recentNotes: ctx.recentNotes
      ?.slice(0, CONTEXT_LIMITS.maxNotes)
      .map((n) => ({
        visibility: n.visibility,
        excerpt: truncateText(n.excerpt, CONTEXT_LIMITS.maxNoteChars) ?? "",
      })),
    planTitles: ctx.planTitles
      ?.slice(0, CONTEXT_LIMITS.maxPlans)
      .map((t) => truncateText(t, 100) ?? "")
      .filter(Boolean),
  };
}

function requestInstruction(requestType: MentorAssistRequestType): string {
  switch (requestType) {
    case MENTOR_ASSIST_REQUEST.STATUS_SUMMARY:
      return "با توجه به این context یک خلاصه وضعیت کوتاه برای مربی بنویس (۳ تا ۶ جمله).";
    case MENTOR_ASSIST_REQUEST.SESSION_TOPICS:
      return "۳ تا ۵ موضوع پیشنهادی برای جلسه بعد پیشنهاد بده.";
    case MENTOR_ASSIST_REQUEST.SUGGESTED_QUESTIONS:
      return "۵ سؤال باز و غیرتشخیصی برای جلسه بعد پیشنهاد بده.";
    case MENTOR_ASSIST_REQUEST.NEXT_ACTIONS:
      return [
        "۳ اقدام بعدی عملی پیشنهاد بده.",
        "خروجی را JSON با کلیدهای text و suggestions (آرایه‌ای از title و description) بده.",
      ].join(" ");
    default:
      return "پیشنهادهای مفید و کوتاه برای مربی بنویس.";
  }
}

export function buildMentorAssistPrompt(
  ctx: MentorAssistContext,
  requestType: MentorAssistRequestType = MENTOR_ASSIST_REQUEST.STATUS_SUMMARY,
) {
  const safe = enforceContextLimits(ctx);
  const system = AI_SAFETY_SYSTEM;

  const prompt = [
    `دانش‌آموز: ${safe.studentName}`,
    safe.gradeTitle ? `پایه: ${safe.gradeTitle}` : null,
    safe.interests ? `علایق: ${safe.interests}` : null,
    safe.skills ? `مهارت‌ها: ${safe.skills}` : null,
    safe.academicStatus ? `وضعیت تحصیلی: ${safe.academicStatus}` : null,
    safe.planTitles?.length ? `برنامه‌ها: ${JSON.stringify(safe.planTitles)}` : null,
    `اهداف فعال: ${JSON.stringify(safe.activeGoals)}`,
    `اقدامات باز: ${JSON.stringify(safe.openActions)}`,
    `جلسات اخیر: ${JSON.stringify(safe.recentSessions)}`,
    `ارجاع‌های باز: ${JSON.stringify(safe.openReferrals)}`,
    `نکات بانک دانش: ${JSON.stringify(safe.knowledgeHints)}`,
    safe.recentNotes?.length ? `یادداشت‌های مجاز: ${JSON.stringify(safe.recentNotes)}` : null,
    requestInstruction(requestType),
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt, contextMeta: summarizeContextMeta(safe, requestType) };
}

export function summarizeContextMeta(
  ctx: MentorAssistContext,
  requestType?: MentorAssistRequestType,
) {
  return {
    requestType: requestType ?? null,
    counts: {
      goals: ctx.activeGoals.length,
      actions: ctx.openActions.length,
      sessions: ctx.recentSessions.length,
      referrals: ctx.openReferrals.length,
      knowledge: ctx.knowledgeHints.length,
      notes: ctx.recentNotes?.length ?? 0,
      plans: ctx.planTitles?.length ?? 0,
    },
    includesNotes: Boolean(ctx.recentNotes?.length),
  };
}

export function buildSessionSummaryPrompt(rawNotes: string) {
  const system = [
    AI_SAFETY_SYSTEM,
    "گزارش خام جلسه مربی‌گری را بدون حذف نکات مهم به فارسی ساختاربندی کن.",
    "یادداشت خام را بازنویسی یا جایگزین نکن؛ فقط خلاصهٔ ساختاریافته بساز.",
  ].join(" ");

  const clipped = truncateText(rawNotes, 4000) ?? "";
  const prompt = [
    "متن خام جلسه:",
    clipped,
    "",
    "خروجی را در بخش‌های زیر بده: خلاصه جلسه، مسائل اصلی، مشاهدات، اقدامات پیشنهادی، موارد نیازمند پیگیری.",
  ].join("\n");

  return {
    system,
    prompt,
    contextMeta: { rawNotesLength: rawNotes.length, clippedLength: clipped.length },
  };
}

export function buildNextActionSuggestionPrompt(ctx: MentorAssistContext, sessionHint?: string) {
  const base = buildMentorAssistPrompt(ctx, MENTOR_ASSIST_REQUEST.NEXT_ACTIONS);
  const prompt = [
    base.prompt,
    sessionHint ? `زمینه جلسه: ${truncateText(sessionHint, 500)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return { ...base, prompt };
}

/** استخراج پیشنهادهای اقدام از خروجی مدل (JSON یا متن ساده) */
export function parseActionSuggestions(output: string): Array<{ title: string; description?: string }> {
  const trimmed = output.trim();
  try {
    const parsed = JSON.parse(trimmed) as {
      suggestions?: Array<{ title?: string; description?: string }>;
    };
    if (Array.isArray(parsed.suggestions)) {
      return parsed.suggestions
        .filter((s) => s.title && s.title.trim().length >= 3)
        .map((s) => ({
          title: s.title!.trim(),
          description: s.description?.trim() || undefined,
        }));
    }
  } catch {
    /* fall through to line parse */
  }

  const lines = trimmed
    .split("\n")
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter((l) => l.length >= 3);

  return lines.slice(0, 5).map((title) => ({ title }));
}

export function displayTextFromAiOutput(output: string): string {
  try {
    const parsed = JSON.parse(output) as { text?: string };
    if (typeof parsed.text === "string" && parsed.text.trim()) return parsed.text.trim();
  } catch {
    /* plain text */
  }
  return output;
}
