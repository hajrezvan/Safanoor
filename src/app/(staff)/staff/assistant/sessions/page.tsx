import { AssistantShell } from "@/components/patterns/assistant-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ROLE_KEYS,
  SESSION_CONFIDENTIALITY,
  SESSION_CONFIDENTIALITY_TITLES_FA,
} from "@/lib/enums";
import { formatDateFa, todayIsoDate } from "@/lib/date";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { getStudentIdsForStaff, listStudentsForStaff } from "@/server/modules/students/service";
import { listSessions } from "@/server/modules/sessions/service";
import {
  createActionFromSessionAction,
  createSessionAction,
} from "@/server/actions/sessions";

export const runtime = "nodejs";

export default async function AssistantSessionsPage() {
  const user = await requireRole(ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(user, PERMISSIONS.SESSIONS_MANAGE);

  const studentIds = getStudentIdsForStaff(user.id, user.roleKey);
  const students = listStudentsForStaff(user.id, user.roleKey);
  const sessions = listSessions({ studentIds });

  async function create(formData: FormData) {
    "use server";
    await createSessionAction({}, formData);
  }
  async function makeAction(formData: FormData) {
    "use server";
    await createActionFromSessionAction({}, formData);
  }

  return (
    <AssistantShell user={user}>
      <PageHeader title="جلسات مربی‌گری" description="ثبت جلسه و ایجاد اقدام پیگیری" />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>جلسات اخیر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <EmptyState title="جلسه‌ای ثبت نشده" description="اولین جلسه را از فرم مقابل ثبت کنید." />
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
                      {session.durationMinutes ? ` — ${session.durationMinutes} دقیقه` : ""}
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
                    <Input name="deadline" type="date" className="w-40" />
                    <Button type="submit" size="sm">
                      ایجاد اقدام
                    </Button>
                  </form>
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
                <Input name="type" placeholder="مثلاً حضوری / تلفنی" required />
              </label>
              <label className="grid gap-1 text-sm">
                مدت (دقیقه)
                <Input name="durationMinutes" type="number" min={1} placeholder="45" />
              </label>
              <label className="grid gap-1 text-sm">
                موضوعات
                <Input name="topics" placeholder="موضوعات مطرح‌شده" />
              </label>
              <label className="grid gap-1 text-sm">
                خلاصه
                <Input name="summary" placeholder="خلاصه کوتاه جلسه" />
              </label>
              <label className="grid gap-1 text-sm">
                یادداشت خام
                <Input name="rawNotes" placeholder="یادداشت کامل" />
              </label>
              <label className="grid gap-1 text-sm">
                تاریخ پیگیری
                <Input name="followUpDate" type="date" />
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
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="referralRequired" />
                نیاز به ارجاع دارد
              </label>
              <Button type="submit">ثبت جلسه</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AssistantShell>
  );
}
