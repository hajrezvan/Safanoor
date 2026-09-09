import Link from "next/link";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_KEYS, STUDENT_STATUS_TITLES_FA } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { listStudentsForStaff } from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function ForcesPage() {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );
  const forces = listStudentsForStaff(user.id, user.roleKey);

  return (
    <StaffShell user={user} title="نیروها">
      <PageHeader
        title="نیروها"
        description="دانش‌آموزان تحت نظارت شما"
        actions={
          user.roleKey !== ROLE_KEYS.ASSISTANT_MENTOR ? (
            <Link href="/staff/forces/new" className={cn(buttonVariants())}>
              نیروی جدید
            </Link>
          ) : null
        }
      />

      {forces.length === 0 ? (
        <EmptyState
          title="نیرویی ثبت نشده"
          description="با ایجاد پرونده جدید، نیروها اینجا دیده می‌شوند."
          action={
            user.roleKey !== ROLE_KEYS.ASSISTANT_MENTOR ? (
              <Link href="/staff/forces/new" className={cn(buttonVariants())}>
                ایجاد نیرو
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {forces.map((f) => (
            <Link
              key={f.id}
              href={`/staff/forces/${f.id}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
            >
              <div>
                <p className="text-sm font-bold">{f.fullName}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {f.gradeTitleFa ?? "بدون پایه"}
                  {f.groupTitle ? ` · ${f.groupTitle}` : ""}
                </p>
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">
                {STUDENT_STATUS_TITLES_FA[f.status] ?? f.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
