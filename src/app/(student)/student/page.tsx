import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { getStudentByUserId } from "@/server/modules/students/service";
import { listPublishedForStudent } from "@/server/modules/announcements/service";

export const runtime = "nodejs";

export default async function StudentHomePage() {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(user.id);
  const announcements = student ? listPublishedForStudent(student.id) : [];

  return (
    <StudentShell user={user} title="خانه">
      <PageHeader title="اطلاعیه‌ها" description="پیام‌های مربی و سامانه برای شما" />

      {!student ? (
        <EmptyState
          title="پرونده یافت نشد"
          description="از مدیر بخواهید پرونده شما را در سامانه ثبت کند."
        />
      ) : (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <EmptyState
              title="اطلاعیه‌ای نیست"
              description="وقتی اطلاعیه جدیدی منتشر شود اینجا می‌بینید."
            />
          ) : (
            <article className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)]">
              <h2 className="text-base font-bold">{announcements[0].title}</h2>
              <p className="mt-3 text-sm leading-7 whitespace-pre-wrap">
                {announcements[0].body}
              </p>
            </article>
          )}

          <div
            aria-disabled="true"
            className="w-full rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--muted)]/40 px-6 py-14 text-center opacity-60 pointer-events-none select-none"
          >
            <p className="text-base font-medium text-[var(--muted-foreground)]">
              قابلیت های مسجدی به زودی اضافه خواهد شد
            </p>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
