import { AssistantShell } from "@/components/patterns/assistant-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PRIORITY,
  PRIORITY_TITLES_FA,
  REFERRAL_STATUS,
  REFERRAL_STATUS_TITLES_FA,
  ROLE_KEYS,
} from "@/lib/enums";
import { formatDateFa } from "@/lib/date";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { getStudentIdsForStaff, listStudentsForStaff } from "@/server/modules/students/service";
import { listReferrals } from "@/server/modules/referrals/service";
import {
  createReferralAction,
  updateReferralStatusAction,
} from "@/server/actions/referrals";

export const runtime = "nodejs";

export default async function AssistantReferralsPage() {
  const user = await requireRole(ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(user, PERMISSIONS.REFERRALS_MANAGE);

  const studentIds = getStudentIdsForStaff(user.id, user.roleKey);
  const students = listStudentsForStaff(user.id, user.roleKey);
  const items = listReferrals({ studentIds });

  async function create(formData: FormData) {
    "use server";
    await createReferralAction({}, formData);
  }
  async function updateStatus(formData: FormData) {
    "use server";
    await updateReferralStatusAction({}, formData);
  }

  return (
    <AssistantShell user={user}>
      <PageHeader title="ارجاع‌ها" description="ثبت و پیگیری ارجاع به مربی" />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>فهرست ارجاع‌ها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <EmptyState title="ارجاعی نیست" description="در صورت نیاز از فرم مقابل ارجاع بسازید." />
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div>
                    <p className="font-medium">{item.subject}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {item.studentName} —{" "}
                      {REFERRAL_STATUS_TITLES_FA[item.status as keyof typeof REFERRAL_STATUS_TITLES_FA] ??
                        item.status}{" "}
                      — {PRIORITY_TITLES_FA[item.priority as keyof typeof PRIORITY_TITLES_FA] ?? item.priority}
                      {" — "}
                      {formatDateFa(item.createdAt)}
                    </p>
                    {item.description ? (
                      <p className="mt-2 text-sm leading-7">{item.description}</p>
                    ) : null}
                    {item.response ? (
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">پاسخ: {item.response}</p>
                    ) : null}
                  </div>
                  {item.status === REFERRAL_STATUS.OPEN ? (
                    <form action={updateStatus}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="status" value={REFERRAL_STATUS.CANCELLED} />
                      <Button type="submit" size="sm" variant="outline">
                        لغو ارجاع
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ارجاع جدید</CardTitle>
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
                موضوع
                <Input name="subject" required placeholder="موضوع ارجاع" />
              </label>
              <label className="grid gap-1 text-sm">
                توضیح
                <Input name="description" placeholder="جزئیات برای مربی" />
              </label>
              <label className="grid gap-1 text-sm">
                اولویت
                <select
                  name="priority"
                  defaultValue={PRIORITY.MEDIUM}
                  className="h-10 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3"
                >
                  {Object.values(PRIORITY).map((key) => (
                    <option key={key} value={key}>
                      {PRIORITY_TITLES_FA[key]}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit">ثبت ارجاع</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AssistantShell>
  );
}
