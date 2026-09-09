import Link from "next/link";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { FilterBar } from "@/components/patterns/filter-bar";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/server/auth/guards";
import { COURSE_STATUS, COURSE_STATUS_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { toFaDigits } from "@/lib/digits";
import { cn } from "@/lib/utils";
import { listCourses } from "@/server/modules/courses/service";
import { CourseForm } from "./course-form";

export const runtime = "nodejs";

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const params = await searchParams;

  const courses = listCourses({
    search: params.q,
    status: params.status || undefined,
  });

  return (
    <AdminShell user={user}>
      <PageHeader
        title="دوره‌ها"
        description="هر دوره از چند درس تشکیل می‌شود و هر درس یک محتوا دارد."
      />

      <div className="mb-6">
        <CourseForm />
      </div>

      <FilterBar>
        <form className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">جستجو</label>
            <Input name="q" defaultValue={params.q ?? ""} placeholder="عنوان دوره" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">وضعیت</label>
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
            >
              <option value="">همه</option>
              {Object.values(COURSE_STATUS).map((status) => (
                <option key={status} value={status}>
                  {COURSE_STATUS_TITLES_FA[status]}
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
        rows={courses}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            title="دوره‌ای یافت نشد"
            description="با فرم بالا اولین دوره را بسازید یا فیلترها را تغییر دهید."
          />
        }
        columns={[
          {
            key: "title",
            header: "عنوان",
            cell: (row) => (
              <Link href={`/admin/courses/${row.id}`} className="font-medium hover:underline">
                {row.title}
              </Link>
            ),
          },
          {
            key: "status",
            header: "وضعیت",
            cell: (row) => COURSE_STATUS_TITLES_FA[row.status] ?? row.status,
          },
          { key: "lessons", header: "تعداد درس", cell: (row) => toFaDigits(row.lessonCount) },
          {
            key: "actions",
            header: "عملیات",
            cell: (row) => (
              <Link
                href={`/admin/courses/${row.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                مدیریت درس‌ها
              </Link>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
