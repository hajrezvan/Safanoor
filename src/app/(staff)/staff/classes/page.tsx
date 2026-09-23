import Link from "next/link";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { CourseCover } from "@/components/patterns/course-cover";
import { buttonVariants } from "@/components/ui/button";
import { COURSE_STATUS_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { toFaDigits } from "@/lib/digits";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { listCourses } from "@/server/modules/courses/service";

export const runtime = "nodejs";

export default async function StaffClassesPage() {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );
  const courses = listCourses();

  return (
    <StaffShell user={user} title="کلاس‌ها">
      <PageHeader
        title="کلاس‌ها"
        description="دوره‌ها، فصل‌ها و درس‌ها"
        actions={user.roleKey !== ROLE_KEYS.ASSISTANT_MENTOR ? (
          <Link href="/staff/classes/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ایجاد دوره
          </Link>
        ) : undefined}
      />

      {courses.length === 0 ? (
        <EmptyState title="کلاسی نیست" description="مربی می‌تواند یک دوره جدید ایجاد کند." />
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/staff/classes/${c.id}`}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
            >
              <CourseCover
                coverPath={c.coverPath}
                title={c.title}
                className="size-14 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{c.title}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {toFaDigits(c.lessonCount)} درس · {COURSE_STATUS_TITLES_FA[c.status] ?? c.status}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
