import { getAIProvider } from "@/ai/provider";
import {
  buildMentorAssistPrompt,
  CONTEXT_LIMITS,
  type MentorAssistContext,
  type MentorAssistRequestType,
  MENTOR_ASSIST_REQUEST,
  truncateText,
} from "@/ai/context/builder";
import { persistAiInteraction } from "@/ai/services/interactions";
import {
  GOAL_STATUS,
  KNOWLEDGE_ITEM_STATUS,
  ROLE_KEYS,
  type RoleKey,
} from "@/lib/enums";
import { PERMISSIONS, userHasPermission } from "@/server/authz/policy";
import type { AuthUser } from "@/server/auth/session";
import { listKnowledgeItems } from "@/server/modules/knowledge/service";
import { listNotesForStudent } from "@/server/modules/notes/service";
import { listActions, listGoals, listPlans } from "@/server/modules/plans/service";
import { listReferrals } from "@/server/modules/referrals/service";
import { listSessions } from "@/server/modules/sessions/service";
import {
  canStaffAccessStudent,
  getGrowthProfile,
  getStudentById,
} from "@/server/modules/students/service";

export const AI_FEATURES = {
  MENTOR_ASSIST: "mentor_assist",
  SESSION_SUMMARY: "session_summary",
  NEXT_ACTION: "next_action_suggestion",
} as const;

export function assertCanUseAiForStudent(user: AuthUser, studentId: string) {
  if (!userHasPermission(user, PERMISSIONS.AI_USE)) {
    throw new Error("مجوز استفاده از مربی‌یار را ندارید.");
  }
  if (user.roleKey !== ROLE_KEYS.ADMIN && !canStaffAccessStudent(user.id, user.roleKey, studentId)) {
    throw new Error("این دانش‌آموز در محدوده شما نیست.");
  }
}

/**
 * ساخت context محدود از پرونده — هرگز کل DB را بارگذاری نمی‌کند.
 */
export function buildMentorAssistContext(opts: {
  studentId: string;
  actor: AuthUser;
  includeNotes?: boolean;
}): MentorAssistContext {
  const student = getStudentById(opts.studentId);
  if (!student) throw new Error("دانش‌آموز یافت نشد.");

  const profile = getGrowthProfile(opts.studentId);
  const activeGoals = listGoals({
    studentId: opts.studentId,
    status: GOAL_STATUS.ACTIVE,
  })
    .slice(0, CONTEXT_LIMITS.maxGoals)
    .map((g) => ({ title: g.title, status: g.status, priority: g.priority }));

  const openActions = listActions({ studentId: opts.studentId, openOnly: true })
    .slice(0, CONTEXT_LIMITS.maxActions)
    .map((a) => ({ title: a.title, status: a.status, deadline: a.deadline }));

  const recentSessions = listSessions({ studentId: opts.studentId })
    .slice(0, CONTEXT_LIMITS.maxSessions)
    .map((s) => ({
      date: s.date,
      summary: s.summary,
      topics: s.topics,
    }));

  const openReferrals = listReferrals({ studentId: opts.studentId, openOnly: true })
    .slice(0, CONTEXT_LIMITS.maxReferrals)
    .map((r) => ({
      subject: r.subject,
      priority: r.priority,
      status: r.status,
    }));

  const knowledgeHints = listKnowledgeItems({
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  })
    .slice(0, CONTEXT_LIMITS.maxKnowledge)
    .map((k) => ({
      title: k.title,
      approach: truncateText(k.recommendedApproach) ?? "",
    }));

  const planTitles = listPlans({ studentId: opts.studentId })
    .slice(0, CONTEXT_LIMITS.maxPlans)
    .map((p) => p.title);

  let recentNotes: MentorAssistContext["recentNotes"];
  const mayIncludeNotes =
    opts.includeNotes !== false &&
    userHasPermission(opts.actor, PERMISSIONS.NOTES_MANAGE);

  if (mayIncludeNotes) {
    recentNotes = listNotesForStudent(
      opts.studentId,
      opts.actor.id,
      opts.actor.roleKey as RoleKey,
    )
      .slice(0, CONTEXT_LIMITS.maxNotes)
      .map((n) => ({
        visibility: n.visibility,
        excerpt: truncateText(n.content, CONTEXT_LIMITS.maxNoteChars) ?? "",
      }));
  }

  return {
    studentName: student.fullName,
    gradeTitle: student.gradeTitleFa ?? undefined,
    interests: profile?.interests ?? undefined,
    skills: profile?.skills ?? undefined,
    academicStatus: profile?.academicStatus ?? undefined,
    activeGoals,
    openActions,
    recentSessions,
    openReferrals,
    knowledgeHints,
    recentNotes,
    planTitles,
  };
}

export async function runMentorAssist(opts: {
  studentId: string;
  actor: AuthUser;
  requestType: MentorAssistRequestType;
  includeNotes?: boolean;
}) {
  assertCanUseAiForStudent(opts.actor, opts.studentId);

  const ctx = buildMentorAssistContext({
    studentId: opts.studentId,
    actor: opts.actor,
    includeNotes: opts.includeNotes,
  });

  const { system, prompt, contextMeta } = buildMentorAssistPrompt(ctx, opts.requestType);
  const feature = `${AI_FEATURES.MENTOR_ASSIST}:${opts.requestType}`;
  const result = await getAIProvider().generate({ system, prompt, feature });

  const interaction = persistAiInteraction({
    feature,
    model: result.model ?? result.provider,
    contextMeta,
    output: result.text,
    createdBy: opts.actor.id,
    studentId: opts.studentId,
    relatedType: "student",
    relatedId: opts.studentId,
  });

  return { interaction, output: result.text, requestType: opts.requestType };
}

export { MENTOR_ASSIST_REQUEST };
