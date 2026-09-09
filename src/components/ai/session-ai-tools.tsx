"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  summarizeSessionAiAction,
  suggestNextActionsAiAction,
  acceptSuggestedActionAiAction,
  rejectSuggestedActionAiAction,
  type AiActionState,
} from "@/server/actions/ai";
import { AI_SUGGESTION_DISCLAIMER_FA } from "@/ai/prompts/safety";
import { displayTextFromAiOutput } from "@/ai/context/builder";

const initial: AiActionState = {};

export function SessionAiTools({
  sessionId,
  studentId,
  rawNotes,
  aiSummary,
}: {
  sessionId: string;
  studentId: string;
  rawNotes: string | null;
  aiSummary?: string | null;
}) {
  const [summaryState, summaryAction, summaryPending] = useActionState(
    summarizeSessionAiAction,
    initial,
  );
  const [suggestState, suggestAction, suggestPending] = useActionState(
    suggestNextActionsAiAction,
    initial,
  );
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptSuggestedActionAiAction,
    initial,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectSuggestedActionAiAction,
    initial,
  );

  const summaryOutput = summaryState.output
    ? displayTextFromAiOutput(summaryState.output)
    : aiSummary;

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/20 p-3">
      <p className="text-[11px] leading-5 text-[var(--muted-foreground)]">
        {AI_SUGGESTION_DISCLAIMER_FA}
      </p>

      {rawNotes ? (
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--muted-foreground)]">یادداشت خام</p>
          <p className="whitespace-pre-wrap text-sm leading-6">{rawNotes}</p>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">
          برای خلاصه‌سازی، ابتدا یادداشت خام را هنگام ثبت جلسه وارد کنید.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <form action={summaryAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <Button type="submit" size="sm" variant="secondary" disabled={summaryPending || !rawNotes}>
            {summaryPending ? "خلاصه‌سازی…" : "خلاصه‌سازی با AI"}
          </Button>
        </form>
        <form action={suggestAction}>
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <Button type="submit" size="sm" variant="outline" disabled={suggestPending}>
            {suggestPending ? "پیشنهاد…" : "پیشنهاد اقدام با AI"}
          </Button>
        </form>
      </div>

      {summaryState.error ? (
        <p className="text-sm text-[var(--danger)]">{summaryState.error}</p>
      ) : null}
      {summaryState.success ? (
        <p className="text-xs text-[var(--muted-foreground)]">{summaryState.success}</p>
      ) : null}
      {summaryOutput ? (
        <div>
          <p className="mb-1 text-xs font-medium">
            خلاصه / پیشنهاد AI{" "}
            <span className="font-normal text-[var(--muted-foreground)]">
              (جدا از یادداشت خام)
            </span>
          </p>
          <div className="whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-6">
            {summaryOutput}
          </div>
        </div>
      ) : null}

      {suggestState.error ? (
        <p className="text-sm text-[var(--danger)]">{suggestState.error}</p>
      ) : null}
      {suggestState.suggestions?.length && suggestState.interactionId ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">بررسی پیشنهادهای اقدام</p>
          {suggestState.suggestions.map((item, index) => (
            <form
              key={`${item.title}-${index}`}
              action={acceptAction}
              className="flex flex-wrap gap-2"
            >
              <input type="hidden" name="interactionId" value={suggestState.interactionId} />
              <Input name="title" defaultValue={item.title} className="min-w-[10rem] flex-1" />
              <Input
                name="description"
                defaultValue={item.description ?? ""}
                className="min-w-[10rem] flex-1"
                placeholder="توضیح"
              />
              <Button type="submit" size="sm" disabled={acceptPending}>
                پذیرش
              </Button>
            </form>
          ))}
          <form action={rejectAction}>
            <input type="hidden" name="interactionId" value={suggestState.interactionId} />
            <Button type="submit" size="sm" variant="outline" disabled={rejectPending}>
              رد پیشنهادها
            </Button>
          </form>
        </div>
      ) : null}
      {acceptState.success || rejectState.success ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {acceptState.success ?? rejectState.success}
        </p>
      ) : null}
    </div>
  );
}
