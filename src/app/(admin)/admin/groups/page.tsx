import Link from "next/link";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { FilterBar } from "@/components/patterns/filter-bar";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { listGrades } from "@/server/modules/grades/service";
import { listGroups } from "@/server/modules/groups/service";
import { deleteGroupAction } from "@/server/actions/groups";
import { CreateGroupForm } from "./create-group-form";

export const runtime = "nodejs";

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; grade?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const params = await searchParams;

  const grades = listGrades();
  const groups = listGroups({ search: params.q, gradeId: params.grade || undefined });

  return (
    <AdminShell user={user}>
      <PageHeader
        title="گروه‌ها"
        description="هر گروه به یک پایه تحصیلی وابسته است."
      />

      {grades.length === 0 ? (
        <EmptyState
          title="ابتدا پایه‌ها را بسازید"
          description="گروه بدون پایه تعریف نمی‌شود. ابتدا پایه‌های تحصیلی را ایجاد کنید."
          action={
            <Link href="/admin/grades" className={cn(buttonVariants())}>
              رفتن به پایه‌ها
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6">
            <CreateGroupForm grades={grades} />
          </div>

          <FilterBar>
            <form className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[var(--muted-foreground)]">جستجو</label>
                <Input name="q" defaultValue={params.q ?? ""} placeholder="عنوان گروه" />
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
              <Button type="submit" variant="secondary">
                اعمال فیلتر
              </Button>
            </form>
          </FilterBar>

          <DataTable
            rows={groups}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                title="گروهی یافت نشد"
                description="با فرم بالا گروه جدیدی بسازید یا فیلترها را تغییر دهید."
              />
            }
            columns={[
              {
                key: "title",
                header: "عنوان",
                cell: (row) => <span className="font-medium">{row.title}</span>,
              },
              { key: "grade", header: "پایه", cell: (row) => row.gradeTitleFa },
              { key: "students", header: "دانش‌آموزان", cell: (row) => row.studentCount },
              {
                key: "actions",
                header: "عملیات",
                cell: (row) =>
                  row.studentCount === 0 ? (
                    <form action={deleteGroupAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button type="submit" size="sm" variant="outline">
                        حذف
                      </Button>
                    </form>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      دارای دانش‌آموز
                    </span>
                  ),
              },
            ]}
          />
        </>
      )}
    </AdminShell>
  );
}
