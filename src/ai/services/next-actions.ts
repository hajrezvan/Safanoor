import { getAIProvider } from "@/ai/provider";
import {
  buildNextActionSuggestionPrompt,
  displayTextFromAiOutput,
  parseActionSuggestions,
} from "@/ai/context/builder";
import { persistAiInteraction, setAiInteractionAccepted, getAiInteractionById } from "@/ai/services/interactions";
import {
  AI_FEATURES,
  assertCanUseAiForStudent,
  buildMentorAssistContext,
} from "@/ai/services/mentor-assist";
import { ACTION_STATUS, ACTION_TYPE, PRIORITY } from "@/lib/enums";
import { todayIsoDate } from "@/lib/date";
import type { AuthUser } from "@/server/auth/session";
import { createAction } from "@/server/modules/plans/service";
import { getSessionById } from "@/server/modules/sessions/service";
import { getStudentById } from "@/server/modules/students/service";
import { recordAudit } from "@/server/modules/audit/service";

export async function suggestNextActions(opts: {
  studentId: string;
  actor: AuthUser;
  sessionId?: string;
}) {
  assertCanUseAiForStudent(opts.actor, opts.studentId);

  let sessionHint: string | undefined;
  if (opts.sessionId) {
    const session = getSessionById(opts.sessionId);
    if (!session) throw new Error("جلسه یافت نشد.");
    if (session.studentId !== opts.studentId) {
      throw new Error("جلسه متعلق به این دانش‌آموز نیست.");
    }
    sessionHint = [
      `نوع: ${session.type}`,
      `تاریخ: ${session.date.slice(0, 10)}`,
      session.topics ? `موضوعات: ${session.topics}` : null,
      session.summary ? `خلاصه: ${session.summary}` : null,
      session.rawNotes ? `یادداشت خام (کوتاه): ${session.rawNotes.slice(0, 400)}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  const ctx = buildMentorAssistContext({
    studentId: opts.studentId,
    actor: opts.actor,
  });

  const { system, prompt, contextMeta } = buildNextActionSuggestionPrompt(ctx, sessionHint);
  const result = await getAIProvider().generate({
    system,
    prompt,
    feature: AI_FEATURES.NEXT_ACTION,
  });

  const suggestions = parseActionSuggestions(result.text);
  const interaction = persistAiInteraction({
    feature: AI_FEATURES.NEXT_ACTION,
    model: result.model ?? result.provider,
    contextMeta: {
      ...contextMeta,
      sessionId: opts.sessionId ?? null,
      suggestionCount: suggestions.length,
    },
    output: result.text,
    createdBy: opts.actor.id,
    studentId: opts.studentId,
    relatedType: opts.sessionId ? "session" : "student",
    relatedId: opts.sessionId ?? opts.studentId,
  });

  return {
    interaction,
    text: displayTextFromAiOutput(result.text),
    suggestions,
  };
}

export function acceptSuggestedAction(opts: {
  interactionId: string;
  actor: AuthUser;
  title: string;
  description?: string;
  deadline?: string;
}) {
  const interaction = getAiInteractionById(opts.interactionId);
  if (!interaction) throw new Error("پیشنهاد AI یافت نشد.");
  if (!interaction.studentId) throw new Error("پیشنهاد به دانش‌آموز متصل نیست.");

  assertCanUseAiForStudent(opts.actor, interaction.studentId);

  const student = getStudentById(interaction.studentId);
  if (!student?.userId) throw new Error("دانش‌آموز یافت نشد.");

  const title = opts.title.trim();
  if (title.length < 3) throw new Error("عنوان اقدام حداقل ۳ نویسه است.");

  const action = createAction({
    studentId: interaction.studentId,
    title,
    description:
      opts.description?.trim() ||
      "ایجادشده از پیشنهاد مربی‌یار هوشمند (پس از تأیید مربی).",
    type: ACTION_TYPE.TASK,
    assigneeUserId: student.userId,
    startDate: todayIsoDate(),
    deadline: opts.deadline || undefined,
    status: ACTION_STATUS.TODO,
    priority: PRIORITY.MEDIUM,
    createdBy: opts.actor.id,
  });
  if (!action) throw new Error("ایجاد اقدام ناموفق بود.");

  const wasEdited = (() => {
    const original = parseActionSuggestions(interaction.output);
    return !original.some((s) => s.title === title);
  })();

  setAiInteractionAccepted(interaction.id, wasEdited ? "edited" : "accepted");

  recordAudit({
    actorUserId: opts.actor.id,
    entityType: "ai_interaction",
    entityId: interaction.id,
    action: wasEdited ? "accept_edited" : "accept",
    after: { actionId: action.id, title: action.title },
    metadata: { studentId: interaction.studentId, feature: interaction.feature },
  });

  return { action, interaction: getAiInteractionById(interaction.id)! };
}

export function rejectAiSuggestion(opts: { interactionId: string; actor: AuthUser }) {
  const interaction = getAiInteractionById(opts.interactionId);
  if (!interaction) throw new Error("پیشنهاد AI یافت نشد.");
  if (!interaction.studentId) throw new Error("پیشنهاد به دانش‌آموز متصل نیست.");

  assertCanUseAiForStudent(opts.actor, interaction.studentId);
  const updated = setAiInteractionAccepted(interaction.id, "rejected");
  recordAudit({
    actorUserId: opts.actor.id,
    entityType: "ai_interaction",
    entityId: interaction.id,
    action: "reject",
    metadata: { studentId: interaction.studentId, feature: interaction.feature },
  });
  return updated;
}

export function acceptAiAssistOutput(opts: {
  interactionId: string;
  actor: AuthUser;
  decision: "accepted" | "rejected";
}) {
  const interaction = getAiInteractionById(opts.interactionId);
  if (!interaction) throw new Error("تعامل AI یافت نشد.");
  if (!interaction.studentId) throw new Error("تعامل به دانش‌آموز متصل نیست.");

  assertCanUseAiForStudent(opts.actor, interaction.studentId);
  return setAiInteractionAccepted(interaction.id, opts.decision);
}
