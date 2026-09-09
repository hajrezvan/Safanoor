import Link from "next/link";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { listAssistants } from "@/server/modules/assistants/service";

export const runtime = "nodejs";

export default async function AssistantsPage() {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );
  const assistants = listAssistants(user);

  return (
    <StaffShell user={user} title="کمک‌مربیان">
      <PageHeader title="کمک‌مربیان" description="فهرست کمک‌مربیان و تعداد نیروهای تحت پوشش" />

      {assistants.length === 0 ? (
        <EmptyState title="کمک‌مربی‌ای نیست" description="پس از تعریف کاربران کمک‌مربی اینجا دیده می‌شوند." />
      ) : (
        <div className="space-y-3">
          {assistants.map((a) => (
            <Link
              key={a.userId}
              href={`/staff/assistants/${a.userId}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
            >
              <div>
                <p className="text-sm font-bold">{a.fullName}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]" dir="ltr">
                  @{a.username}
                </p>
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">
                {a.studentCount} دانش‌آموز
              </span>
            </Link>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
