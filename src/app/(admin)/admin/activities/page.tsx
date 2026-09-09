import Link from "next/link";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { FilterBar } from "@/components/patterns/filter-bar";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/server/auth/guards";
import {
  ACTIVITY_STATUS,
  ACTIVITY_STATUS_TITLES_FA,
  ACTIVITY_TYPE,
  ACTIVITY_TYPE_TITLES_FA,
  ROLE_KEYS,
  type ActivityType,
} from "@/lib/enums";
import { cn } from "@/lib/utils";
import { listActivities } from "@/server/modules/activities/service";
import { listGrades } from "@/server/modules/grades/service";
import { deleteActivityAction } from "@/server/actions/activities";
import { ActivityForm } from "./activity-form";

export const runtime = "nodejs";

export default async function AdminActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; edit?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const params = await searchParams;
  const grades = listGrades();
  const activities = listActivities({
    search: params.q,
    type: params.type || undefined,
    status: params.status || undefined,
  });
  const editing = params.edit ? activities.find((a) => a.id === params.edit) : undefined;

  return (
    <AdminShell user={user}>
      <PageHeader
        title="فعالیت‌ها و پروژه‌ها"
        description="تعریف فعالیت‌های غیردیجیتال و پروژه‌ای؛ محول‌سازی از پرونده دانش‌آموز انجام می‌شود."
      />

      <div className="mb-6">
        <ActivityForm activity={editing} grades={grades} />
        {editing ? (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            در حال ویرایش «{editing.title}».{" "}
            <Link href="/admin/activities" className="underline">
              انصراف و ساخت جدید
            </Link>
          </p>
        ) : null}
      </div>

      <FilterBar>
        <form className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">جستجو</label>
            <Input name="q" defaultValue={params.q ?? ""} placeholder="عنوان فعالیت" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">نوع</label>
            <select
              name="type"
              defaultValue={params.type ?? ""}
              className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
            >
              <option value="">همه</option>
              {Object.values(ACTIVITY_TYPE).map((type) => (
                <option key={type} value={type}>
                  {ACTIVITY_TYPE_TITLES_FA[type]}
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
              {Object.values(ACTIVITY_STATUS).map((status) => (
                <option key={status} value={status}>
                  {ACTIVITY_STATUS_TITLES_FA[status]}
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
        rows={activities}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            title="فعالیتی یافت نشد"
            description="با فرم بالا اولین فعالیت را بسازید یا فیلترها را تغییر دهید."
          />
        }
        columns={[
          { key: "title", header: "عنوان", cell: (row) => row.title },
          {
            key: "type",
            header: "نوع",
            cell: (row) =>
              ACTIVITY_TYPE_TITLES_FA[row.type as ActivityType] ?? row.type,
          },
          {
            key: "grade",
            header: "پایه",
            cell: (row) => row.gradeTitleFa ?? "همه",
          },
          {
            key: "status",
            header: "وضعیت",
            cell: (row) => ACTIVITY_STATUS_TITLES_FA[row.status as keyof typeof ACTIVITY_STATUS_TITLES_FA] ?? row.status,
          },
          { key: "count", header: "محول‌شده", cell: (row) => row.assignmentCount },
          {
            key: "actions",
            header: "عملیات",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/activities?edit=${row.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  ویرایش
                </Link>
                <form action={deleteActivityAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    حذف
                  </Button>
                </form>
              </div>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
