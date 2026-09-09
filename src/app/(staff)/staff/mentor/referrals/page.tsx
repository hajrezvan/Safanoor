import { MentorShell } from "@/components/patterns/mentor-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PRIORITY_TITLES_FA,
  REFERRAL_STATUS,
  REFERRAL_STATUS_TITLES_FA,
  ROLE_KEYS,
  type ReferralStatus,
} from "@/lib/enums";
import { formatDateFa } from "@/lib/date";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { getStudentIdsForStaff } from "@/server/modules/students/service";
import {
  listOpenReferralsForMentor,
  listReferrals,
  REFERRAL_STATUS_TRANSITIONS,
} from "@/server/modules/referrals/service";
import { updateReferralStatusAction } from "@/server/actions/referrals";

export const runtime = "nodejs";

export default async function MentorReferralsPage() {
  const user = await requireRole(ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.REFERRALS_MANAGE);

  const studentIds = getStudentIdsForStaff(user.id, user.roleKey);
  const openItems = listOpenReferralsForMentor(user.id).filter(
    (item) => studentIds.includes(item.studentId) || !item.assignedTo || item.assignedTo === user.id,
  );
  // Also show open referrals for scoped students even if assigned elsewhere / unassigned
  const scopedOpen = listReferrals({ studentIds, openOnly: true });
  const byId = new Map([...openItems, ...scopedOpen].map((r) => [r.id, r]));
  const items = [...byId.values()];
  const resolved = listReferrals({
    studentIds,
    status: [REFERRAL_STATUS.RESOLVED, REFERRAL_STATUS.CANCELLED],
  }).slice(0, 10);

  async function updateStatus(formData: FormData) {
    "use server";
    await updateReferralStatusAction({}, formData);
  }

  return (
    <MentorShell user={user}>
      <PageHeader
        title="ارجاع‌ها"
        description="بررسی، پاسخ و حل ارجاع‌های باز دانش‌آموزان"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ارجاع‌های باز</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.length === 0 ? (
              <EmptyState title="ارجاع بازی نیست" description="ارجاع‌های کمک‌مربی اینجا ظاهر می‌شوند." />
            ) : (
              items.map((item) => {
                const status = item.status as ReferralStatus;
                const next = REFERRAL_STATUS_TRANSITIONS[status] ?? [];
                return (
                  <div
                    key={item.id}
                    className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div>
                      <p className="font-medium">{item.subject}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {item.studentName} — {REFERRAL_STATUS_TITLES_FA[status]} —{" "}
                        {PRIORITY_TITLES_FA[item.priority as keyof typeof PRIORITY_TITLES_FA] ??
                          item.priority}{" "}
                        — {formatDateFa(item.createdAt)}
                      </p>
                      {item.description ? (
                        <p className="mt-2 text-sm leading-7">{item.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        ایجادکننده: {item.createdByName}
                      </p>
                    </div>
                    <form action={updateStatus} className="grid gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <Input name="response" placeholder="پاسخ مربی" defaultValue={item.response ?? ""} />
                      <div className="flex flex-wrap gap-2">
                        {next.map((s) => (
                          <Button
                            key={s}
                            type="submit"
                            name="status"
                            value={s}
                            size="sm"
                            variant={s === REFERRAL_STATUS.RESOLVED ? "default" : "outline"}
                          >
                            {REFERRAL_STATUS_TITLES_FA[s]}
                          </Button>
                        ))}
                      </div>
                    </form>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>اخیراً بسته‌شده</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolved.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">موردی نیست.</p>
            ) : (
              resolved.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <p className="text-sm font-medium">{item.subject}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {item.studentName} —{" "}
                    {REFERRAL_STATUS_TITLES_FA[item.status as ReferralStatus] ?? item.status}
                  </p>
                  {item.response ? (
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.response}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </MentorShell>
  );
}
