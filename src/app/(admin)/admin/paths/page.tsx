import Link from "next/link";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { FilterBar } from "@/components/patterns/filter-bar";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/server/auth/guards";
import { GROWTH_PATH_STATUS, GROWTH_PATH_STATUS_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { listGrades } from "@/server/modules/grades/service";
import { listPaths } from "@/server/modules/paths/service";

export const runtime = "nodejs";

export default async function AdminPathsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; grade?: string; status?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const params = await searchParams;

  const grades = listGrades();
  const paths = listPaths({
    search: params.q,
    gradeId: params.grade || undefined,
    status: params.status || undefined,
  });

  return (
    <AdminShell user={user}>
      <PageHeader
        title="مسیرهای رشد"
        description="هر مسیر به یک پایه تحصیلی وابسته است و اهداف خود را دارد."
        actions={
          <Link href="/admin/paths/new" className={cn(buttonVariants())}>
            مسیر جدید
          </Link>
        }
      />

      {grades.length === 0 ? (
        <EmptyState
          title="ابتدا پایه‌ها را بسازید"
          description="مسیر رشد بدون پایه تعریف نمی‌شود."
          action={
            <Link href="/admin/grades" className={cn(buttonVariants())}>
              رفتن به پایه‌ها
            </Link>
          }
        />
      ) : (
        <>
          <FilterBar>
            <form className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted-foreground)]">جستجو</label>
                <Input name="q" defaultValue={params.q ?? ""} placeholder="عنوان مسیر" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted-foreground)]">پایه</label>
                <select
                  name="grade"
                  defaultValue={params.grade ?? ""}
                  className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                >
                  <option value="">همه</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.titleFa}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted-foreground)]">وضعیت</label>
                <select
                  name="status"
                  defaultValue={params.status ?? ""}
                  className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                >
                  <option value="">همه</option>
                  {Object.values(GROWTH_PATH_STATUS).map((status) => (
                    <option key={status} value={status}>
                      {GROWTH_PATH_STATUS_TITLES_FA[status]}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="secondary">
                اعمال فیلتر
              </Button>
            </form>
          </FilterBar>

          <DataTable
            rows={paths}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                title="مسیری یافت نشد"
                description="با دکمه «مسیر جدید» اولین مسیر رشد را بسازید."
                action={
                  <Link href="/admin/paths/new" className={cn(buttonVariants())}>
                    مسیر جدید
                  </Link>
                }
              />
            }
            columns={[
              {
                key: "title",
                header: "عنوان",
                cell: (row) => (
                  <Link
                    href={`/admin/paths/${row.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.title}
                  </Link>
                ),
              },
              { key: "grade", header: "پایه", cell: (row) => row.gradeTitleFa },
              {
                key: "status",
                header: "وضعیت",
                cell: (row) => GROWTH_PATH_STATUS_TITLES_FA[row.status] ?? row.status,
              },
              { key: "objectives", header: "اهداف", cell: (row) => row.objectiveCount },
              {
                key: "students",
                header: "دانش‌آموزان فعال",
                cell: (row) => row.activeEnrollmentCount,
              },
              {
                key: "actions",
                header: "عملیات",
                cell: (row) => (
                  <Link
                    href={`/admin/paths/${row.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    مدیریت
                  </Link>
                ),
              },
            ]}
          />
        </>
      )}
    </AdminShell>
  );
}
