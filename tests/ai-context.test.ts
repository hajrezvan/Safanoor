import { describe, expect, it } from "vitest";
import {
  CONTEXT_LIMITS,
  MENTOR_ASSIST_REQUEST,
  buildMentorAssistPrompt,
  buildSessionSummaryPrompt,
  enforceContextLimits,
  parseActionSuggestions,
  truncateText,
  type MentorAssistContext,
} from "@/ai/context/builder";
import { AI_SAFETY_SYSTEM } from "@/ai/prompts/safety";
import { getDefaultPermissionsForRole, PERMISSIONS } from "@/server/authz/policy";
import { ROLE_KEYS } from "@/lib/enums";

function fatContext(): MentorAssistContext {
  return {
    studentName: "علی",
    gradeTitle: "هشتم",
    interests: "x".repeat(500),
    skills: "مهارت تست",
    academicStatus: "متوسط",
    activeGoals: Array.from({ length: 20 }, (_, i) => ({
      title: `هدف ${i}`,
      status: "active",
      priority: "medium",
    })),
    openActions: Array.from({ length: 20 }, (_, i) => ({
      title: `اقدام ${i}`,
      status: "TODO",
      deadline: null,
    })),
    recentSessions: Array.from({ length: 20 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      summary: `خلاصه ${i}`,
      topics: `موضوع ${i}`,
    })),
    openReferrals: Array.from({ length: 10 }, (_, i) => ({
      subject: `ارجاع ${i}`,
      priority: "high",
      status: "OPEN",
    })),
    knowledgeHints: Array.from({ length: 10 }, (_, i) => ({
      title: `دانش ${i}`,
      approach: "رویکرد",
    })),
    recentNotes: Array.from({ length: 10 }, (_, i) => ({
      visibility: "mentor_only",
      excerpt: `یادداشت ${i} ${"متن طولانی ".repeat(40)}`,
    })),
    planTitles: Array.from({ length: 10 }, (_, i) => `برنامه ${i}`),
  };
}

describe("AI context builder safety", () => {
  it("enforces hard limits so prompts never dump whole collections", () => {
    const limited = enforceContextLimits(fatContext());
    expect(limited.activeGoals).toHaveLength(CONTEXT_LIMITS.maxGoals);
    expect(limited.openActions).toHaveLength(CONTEXT_LIMITS.maxActions);
    expect(limited.recentSessions).toHaveLength(CONTEXT_LIMITS.maxSessions);
    expect(limited.openReferrals).toHaveLength(CONTEXT_LIMITS.maxReferrals);
    expect(limited.knowledgeHints).toHaveLength(CONTEXT_LIMITS.maxKnowledge);
    expect(limited.recentNotes).toHaveLength(CONTEXT_LIMITS.maxNotes);
    expect(limited.planTitles).toHaveLength(CONTEXT_LIMITS.maxPlans);
    expect(limited.interests!.length).toBeLessThanOrEqual(CONTEXT_LIMITS.maxTextChars + 1);
    expect(limited.recentNotes![0].excerpt.length).toBeLessThanOrEqual(
      CONTEXT_LIMITS.maxNoteChars + 1,
    );
  });

  it("builds prompts with safety system and request-specific instruction", () => {
    const { system, prompt, contextMeta } = buildMentorAssistPrompt(
      fatContext(),
      MENTOR_ASSIST_REQUEST.SUGGESTED_QUESTIONS,
    );
    expect(system).toContain("تشخیص پزشکی");
    expect(system).toBe(AI_SAFETY_SYSTEM);
    expect(prompt).toContain("دانش‌آموز: علی");
    expect(prompt).toContain("سؤال");
    expect(contextMeta.counts.goals).toBe(CONTEXT_LIMITS.maxGoals);
    expect(contextMeta.includesNotes).toBe(true);
  });

  it("session summary prompt clips huge raw notes", () => {
    const huge = "یادداشت ".repeat(2000);
    const { prompt, contextMeta } = buildSessionSummaryPrompt(huge);
    expect(prompt.length).toBeLessThan(huge.length);
    expect(contextMeta.rawNotesLength).toBe(huge.length);
    expect(contextMeta.clippedLength).toBeLessThanOrEqual(CONTEXT_LIMITS.maxTextChars > 0 ? 4001 : 0);
  });

  it("truncateText returns undefined for empty values", () => {
    expect(truncateText("")).toBeUndefined();
    expect(truncateText("  ")).toBeUndefined();
    expect(truncateText(null)).toBeUndefined();
  });

  it("parses JSON action suggestions from AI output", () => {
    const output = JSON.stringify({
      text: "پیشنهادها",
      suggestions: [
        { title: "مرور برنامه", description: "هفتگی" },
        { title: "ab" },
        { title: "تعیین پیگیری" },
      ],
    });
    const parsed = parseActionSuggestions(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("مرور برنامه");
  });
});

describe("AI permission policy", () => {
  it("mentor and admin have AI_USE; assistant and student do not", () => {
    expect(getDefaultPermissionsForRole(ROLE_KEYS.MENTOR)).toContain(PERMISSIONS.AI_USE);
    expect(getDefaultPermissionsForRole(ROLE_KEYS.ADMIN)).toContain(PERMISSIONS.AI_USE);
    expect(getDefaultPermissionsForRole(ROLE_KEYS.ASSISTANT_MENTOR)).not.toContain(
      PERMISSIONS.AI_USE,
    );
    expect(getDefaultPermissionsForRole(ROLE_KEYS.STUDENT)).not.toContain(PERMISSIONS.AI_USE);
  });
});
