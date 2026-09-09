"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MENTOR_ASSIST_REQUEST,
  MENTOR_ASSIST_REQUEST_TITLES_FA,
  displayTextFromAiOutput,
  type MentorAssistRequestType,
} from "@/ai/context/builder";
import { AI_SUGGESTION_DISCLAIMER_FA } from "@/ai/prompts/safety";
import {
  mentorAssistAction,
  reviewAiInteractionAction,
  suggestNextActionsAiAction,
  acceptSuggestedActionAiAction,
  rejectSuggestedActionAiAction,
  type AiActionState,
} from "@/server/actions/ai";

const initial: AiActionState = {};
const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";
const textareaClass =
  "min-h-36 w-full rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-sm leading-7 whitespace-pre-wrap";

type StudentOption = { id: string; fullName: string };

export function MentorAiAssistPanel({
  students,
  defaultStudentId,
}: {
  students: StudentOption[];
  defaultStudentId?: string;
}) {
  const [assistState, assistAction, assistPending] = useActionState(mentorAssistAction, initial);
  const [reviewState, reviewAction, reviewPending] = useActionState(
    reviewAiInteractionAction,
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

  const requestOptions = Object.values(MENTOR_ASSIST_REQUEST) as MentorAssistRequestType[];
  const output = assistState.output ? displayTextFromAiOutput(assistState.output) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>درخواست مربی‌یار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-6 text-[var(--muted-foreground)]">
            {AI_SUGGESTION_DISCLAIMER_FA}
          </p>
          <form action={assistAction} className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="studentId">دانش‌آموز</Label>
              <select
                id="studentId"
                name="studentId"
                required
                defaultValue={defaultStudentId ?? ""}
                className={selectClass}
              >
                <option value="">انتخاب کنید</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestType">نوع درخواست</Label>
              <select
                id="requestType"
                name="requestType"
                required
                defaultValue={MENTOR_ASSIST_REQUEST.STATUS_SUMMARY}
                className={selectClass}
              >
                {requestOptions.map((key) => (
                  <option key={key} value={key}>
                    {MENTOR_ASSIST_REQUEST_TITLES_FA[key]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="includeNotes" defaultChecked />
              گنجاندن یادداشت‌های مجاز در context (محدود)
            </label>
            <Button type="submit" disabled={assistPending}>
              {assistPending ? "در حال تولید…" : "تولید پیشنهاد"}
            </Button>
          </form>
          {assistState.error ? (
            <p className="text-sm text-[var(--danger)]">{assistState.error}</p>
          ) : null}
          {assistState.success ? (
            <p className="text-sm text-[var(--success,theme(colors.emerald.700))]">
              {assistState.success}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>خروجی پیشنهاد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {output ? (
            <>
              <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
                برچسب: پیشنهاد تولیدشده توسط AI
              </p>
              <div className={textareaClass}>{output}</div>
              {assistState.interactionId ? (
                <form action={reviewAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="interactionId" value={assistState.interactionId} />
                  <Button
                    type="submit"
                    name="decision"
                    value="accepted"
                    size="sm"
                    disabled={reviewPending}
                  >
                    پذیرش
                  </Button>
                  <Button
                    type="submit"
                    name="decision"
                    value="rejected"
                    size="sm"
                    variant="outline"
                    disabled={reviewPending}
                  >
                    رد
                  </Button>
                </form>
              ) : null}
              {reviewState.success ? (
                <p className="text-sm text-[var(--muted-foreground)]">{reviewState.success}</p>
              ) : null}
              {reviewState.error ? (
                <p className="text-sm text-[var(--danger)]">{reviewState.error}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              پس از انتخاب دانش‌آموز و نوع درخواست، پیشنهاد اینجا نمایش داده می‌شود.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>پیشنهاد اقدام بعدی — بررسی مربی</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-6 text-[var(--muted-foreground)]">
            جریان: پیشنهاد AI → بررسی مربی → پذیرش/ویرایش/رد. فقط پس از پذیرش، Action در برنامه ایجاد
            می‌شود. مسائل حساس را به انسان ارجاع دهید.
          </p>
          <form action={suggestAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1 space-y-2">
              <Label htmlFor="suggestStudentId">دانش‌آموز</Label>
              <select
                id="suggestStudentId"
                name="studentId"
                required
                defaultValue={defaultStudentId ?? ""}
                className={selectClass}
              >
                <option value="">انتخاب کنید</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={suggestPending}>
              {suggestPending ? "در حال پیشنهاد…" : "پیشنهاد اقدامات"}
            </Button>
          </form>
          {suggestState.error ? (
            <p className="text-sm text-[var(--danger)]">{suggestState.error}</p>
          ) : null}
          {suggestState.output ? (
            <div className={textareaClass}>{suggestState.output}</div>
          ) : null}
          {suggestState.suggestions?.length && suggestState.interactionId ? (
            <div className="space-y-3">
              {suggestState.suggestions.map((item, index) => (
                <form
                  key={`${item.title}-${index}`}
                  action={acceptAction}
                  className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-[1fr_auto]"
                >
                  <input type="hidden" name="interactionId" value={suggestState.interactionId} />
                  <div className="grid gap-2">
                    <Input name="title" defaultValue={item.title} required />
                    <Input
                      name="description"
                      defaultValue={item.description ?? ""}
                      placeholder="توضیح (قابل ویرایش)"
                    />
                    <Input name="deadline" type="date" />
                  </div>
                  <div className="flex flex-col gap-2 sm:items-stretch">
                    <Button type="submit" size="sm" disabled={acceptPending}>
                      پذیرش و ایجاد
                    </Button>
                  </div>
                </form>
              ))}
              <form action={rejectAction}>
                <input type="hidden" name="interactionId" value={suggestState.interactionId} />
                <Button type="submit" variant="outline" size="sm" disabled={rejectPending}>
                  رد همه پیشنهادها
                </Button>
              </form>
            </div>
          ) : null}
          {acceptState.success ? (
            <p className="text-sm text-[var(--muted-foreground)]">{acceptState.success}</p>
          ) : null}
          {acceptState.error ? (
            <p className="text-sm text-[var(--danger)]">{acceptState.error}</p>
          ) : null}
          {rejectState.success ? (
            <p className="text-sm text-[var(--muted-foreground)]">{rejectState.success}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
