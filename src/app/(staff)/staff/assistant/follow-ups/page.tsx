import Link from "next/link";
import { AssistantShell } from "@/components/patterns/assistant-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { toFaDigits } from "@/lib/digits";
import { requireRole } from "@/server/auth/guards";
import {
  filterFollowUpActions,
  getAssistantFollowUpDashboard,
  type FollowUpFilter,
} from "@/server/modules/followups/service";

export const runtime = "nodejs";

const FILTERS: { key: FollowUpFilter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "overdue", label: "عقب‌افتاده" },
  { key: "due_today", label: "امروز" },
  { key: "upcoming", label: "آینده" },
];

export default async function AssistantFollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ASSISTANT_MENTOR);
  const { filter: raw } = await searchParams;
  const filter: FollowUpFilter =
    raw === "overdue" || raw === "due_today" || raw === "upcoming" || raw === "all"
      ? raw
      : "all";

  const dash = getAssistantFollowUpDashboard(user.id);
  const actions = filterFollowUpActions(dash, filter);

  return (
    <AssistantShell user={user}>
      <PageHeader
        title="پیگیری‌ها"
        description="اقدامات موعددار، ارجاع‌ها و دانش‌آموزان بدون گفتگوی اخیر"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/staff/assistant/follow-ups?filter=${item.key}`}
            className={cn(
              buttonVariants({ variant: filter === item.key ? "default" : "outline", size: "sm" }),
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>اقدامات ({toFaDigits(actions.length)})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.length === 0 ? (
              <EmptyState title="موردی نیست" description="با فیلتر فعلی اقدامی پیدا نشد." />
            ) : (
              actions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {action.studentName}
                    {action.deadline ? ` — مهلت ${toFaDigits(action.deadline.slice(0, 10))}` : ""}
                    {action.isOverdue ? " — عقب‌افتاده" : ""}
                  </p>
                  {action.studentId ? (
                    <Link
                      href={`/staff/assistant/students/${action.studentId}?tab=actions`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-2")}
                    >
                      پرونده دانش‌آموز
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ارجاع‌های باز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dash.openReferrals.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">ارجاع بازی نیست.</p>
              ) : (
                dash.openReferrals.map((ref) => (
                  <div
                    key={ref.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <p className="text-sm font-medium">{ref.subject}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {ref.studentName} — {ref.status}
                    </p>
                  </div>
                ))
              )}
              <Link
                href="/staff/assistant/referrals"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                مدیریت ارجاع‌ها
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>بدون گفتگوی اخیر</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dash.studentsWithoutRecentChat.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">همه به‌روز هستند.</p>
              ) : (
                dash.studentsWithoutRecentChat.map((row) => (
                  <div
                    key={row.studentId}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{row.studentName}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {row.lastMessageAt
                          ? `آخرین پیام: ${row.lastMessageAt.slice(0, 10)}`
                          : "هیچ پیامی ثبت نشده"}
                      </p>
                    </div>
                    <Link
                      href={`/staff/assistant/students/${row.studentId}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      پرونده
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AssistantShell>
  );
}
