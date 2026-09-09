import Link from "next/link";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import {
  getAdminDashboard,
  getAssistantDashboard,
  getMentorDashboard,
} from "@/server/modules/dashboards/service";
import { listAnnouncements } from "@/server/modules/announcements/service";
import { listBooks } from "@/server/modules/books/service";
import { listCourses } from "@/server/modules/courses/service";
import { listAssistants } from "@/server/modules/assistants/service";
import { listStudentsForStaff } from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function StaffDashboardPage() {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );

  const forces = listStudentsForStaff(user.id, user.roleKey);
  const assistants = listAssistants(user);
  const courses = listCourses();
  const books = listBooks();
  const announcements = listAnnouncements().slice(0, 5);

  let needingAttention = 0;
  let openReferrals = 0;
  if (user.roleKey === ROLE_KEYS.ADMIN) {
    const dash = getAdminDashboard();
    needingAttention = dash.overdueActionsCount;
    openReferrals = dash.openReferralsCount;
  } else if (user.roleKey === ROLE_KEYS.MENTOR) {
    const dash = getMentorDashboard(user.id);
    needingAttention = dash.needingAttention.length;
    openReferrals = dash.openReferrals.length;
  } else {
    const dash = getAssistantDashboard(user.id);
    needingAttention = dash.needingFollowUpCount;
  }

  return (
    <StaffShell user={user} title="داشبورد">
      <PageHeader
        title="داشبورد"
        description="نمای کلی نیروها، کلاس‌ها، کتابخانه و اطلاعیه‌ها"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/staff/forces" className="block transition-opacity hover:opacity-90">
          <StatCard label="نیروها" value={forces.length} />
        </Link>
        <Link href="/staff/assistants" className="block transition-opacity hover:opacity-90">
          <StatCard label="کمک‌مربیان" value={assistants.length} />
        </Link>
        <Link href="/staff/classes" className="block transition-opacity hover:opacity-90">
          <StatCard label="کلاس‌ها" value={courses.length} />
        </Link>
        <Link href="/staff/library" className="block transition-opacity hover:opacity-90">
          <StatCard label="کتاب‌ها" value={books.length} />
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label="نیازمند توجه" value={needingAttention} />
        <StatCard label="ارجاع‌های باز" value={openReferrals} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>اطلاعیه‌های اخیر</CardTitle>
            <Link
              href="/staff/announcements"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              همه
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">اطلاعیه‌ای نیست.</p>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                    {a.body}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>دسترسی سریع</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/staff/forces/new" className={cn(buttonVariants())}>
              نیروی جدید
            </Link>
            <Link href="/staff/announcements" className={cn(buttonVariants({ variant: "outline" }))}>
              اطلاعیه‌ها
            </Link>
            <Link href="/staff/sessions" className={cn(buttonVariants({ variant: "outline" }))}>
              جلسات
            </Link>
            <Link href="/staff/chat" className={cn(buttonVariants({ variant: "outline" }))}>
              چت
            </Link>
          </CardContent>
        </Card>
      </div>
    </StaffShell>
  );
}
