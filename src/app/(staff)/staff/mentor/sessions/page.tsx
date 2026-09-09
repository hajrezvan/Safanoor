import { MentorShell } from "@/components/patterns/mentor-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionAiTools } from "@/components/ai/session-ai-tools";
import {
  ROLE_KEYS,
  SESSION_CONFIDENTIALITY,
  SESSION_CONFIDENTIALITY_TITLES_FA,
} from "@/lib/enums";
import { formatDateFa, todayIsoDate } from "@/lib/date";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS, userHasPermission } from "@/server/authz/policy";
import { getStudentIdsForStaff, listStudentsForStaff } from "@/server/modules/students/service";
import { listSessions } from "@/server/modules/sessions/service";
import {
  createActionFromSessionAction,
  createSessionAction,
} from "@/server/actions/sessions";
import { listAiInteractions } from "@/ai/services/interactions";
import { AI_FEATURES } from "@/ai/services/mentor-assist";
import { displayTextFromAiOutput } from "@/ai/context/builder";

export const runtime = "nodejs";

export default async function MentorSessionsPage() {
  const user = await requireRole(ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.SESSIONS_MANAGE);
  const canUseAi = userHasPermission(user, PERMISSIONS.AI_USE);

  const studentIds = getStudentIdsForStaff(user.id, user.roleKey);
  const students = listStudentsForStaff(user.id, user.roleKey);
  const sessions = listSessions({ studentIds });

  const sessionSummaries = new Map<string, string>();
  if (canUseAi) {
    for (const row of listAiInteractions({
      feature: AI_FEATURES.SESSION_SUMMARY,
      createdBy: user.id,
      limit: 40,
    })) {
      if (row.relatedType === "session" && row.relatedId && !sessionSummaries.has(row.relatedId)) {
        sessionSummaries.set(row.relatedId, displayTextFromAiOutput(row.output));
      }
    }
  }

  async function create(formData: FormData) {
    "use server";
    await createSessionAction({}, formData);
  }
  async function makeAction(formData: FormData) {
    "use server";
    await createActionFromSessionAction({}, formData);
  }

  return (
    <MentorShell user={user}>
      <PageHeader title="جلسات مربی‌گری" description="نظارت و ثبت جلسات با دانش‌آموزان محدوده" />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>جلسات اخیر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <EmptyState title="جلسه‌ای ثبت نشده" description="جلسه جدید را از فرم مقابل ثبت کنید." />
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div>
                    <p className="font-medium">
                      {session.type} — {session.studentName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {formatDateFa(session.date)}
                      {session.staffName ? ` — توسط ${session.staffName}` : ""}
                      {session.summary ? ` — ${session.summary}` : ""}
                    </p>
                  </div>
                  <form action={makeAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <Input
                      name="title"
                      placeholder="عنوان اقدام پیگیری"
                      required
                      className="min-w-[12rem] flex-1"
                    />
                    <Button type="submit" size="sm">
                      ایجاد اقدام
                    </Button>
                  </form>
                  {canUseAi ? (
                    <SessionAiTools
                      sessionId={session.id}
                      studentId={session.studentId}
                      rawNotes={session.rawNotes}
                      aiSummary={sessionSummaries.get(session.id) ?? null}
                    />
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>جلسه جدید</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={create} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                دانش‌آموز
                <select
                  name="studentId"
                  required
                  className="h-10 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"
                >
                  <option value="">انتخاب کنید</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                تاریخ
                <Input name="date" type="date" defaultValue={todayIsoDate()} required />
              </label>
              <label className="grid gap-1 text-sm">
                نوع جلسه
                <Input name="type" placeholder="مثلاً حضوری / گروهی" required />
              </label>
              <label className="grid gap-1 text-sm">
                مدت (دقیقه)
                <Input name="durationMinutes" type="number" min={1} />
              </label>
              <label className="grid gap-1 text-sm">
                موضوعات
                <Input name="topics" />
              </label>
              <label className="grid gap-1 text-sm">
                خلاصه
                <Input name="summary" placeholder="اختیاری — AI هم می‌تواند پر کند" />
              </label>
              <label className="grid gap-1 text-sm">
                یادداشت خام
                <textarea
                  name="rawNotes"
                  rows={4}
                  placeholder="یادداشت کامل جلسه (برای خلاصه‌سازی AI حفظ می‌شود)"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1 text-sm">
                مشاهدات
                <Input name="observations" />
              </label>
              <label className="grid gap-1 text-sm">
                سطح محرمانگی
                <select
                  name="confidentiality"
                  defaultValue={SESSION_CONFIDENTIALITY.NORMAL}
                  className="h-10 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"
                >
                  {Object.values(SESSION_CONFIDENTIALITY).map((key) => (
                    <option key={key} value={key}>
                      {SESSION_CONFIDENTIALITY_TITLES_FA[key]}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit">ثبت جلسه</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MentorShell>
  );
}
