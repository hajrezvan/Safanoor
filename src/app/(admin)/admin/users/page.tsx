import Link from "next/link";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { FilterBar } from "@/components/patterns/filter-bar";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS, ROLE_TITLES_FA } from "@/lib/enums";
import { listUsers } from "@/server/modules/users/service";
import { toggleUserActiveAction } from "@/server/actions/users";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const params = await searchParams;
  const { items } = listUsers({
    search: params.q,
    roleKey: params.role || undefined,
    pageSize: 50,
  });

  return (
    <AdminShell user={user}>
      <PageHeader
        title="مدیریت کاربران"
        description="ایجاد و مدیریت حساب‌های مدیر، مربی، کمک‌مربی و دانش‌آموز."
        actions={
          <Link href="/admin/users/new" className={cn(buttonVariants())}>
            کاربر جدید
          </Link>
        }
      />

      <FilterBar>
        <form className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">جستجو</label>
            <Input name="q" defaultValue={params.q ?? ""} placeholder="نام یا نام کاربری" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">نقش</label>
            <select
              name="role"
              defaultValue={params.role ?? ""}
              className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
            >
              <option value="">همه</option>
              {Object.entries(ROLE_TITLES_FA).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
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
        rows={items}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            title="کاربری یافت نشد"
            description="با فیلترهای دیگر جستجو کنید یا کاربر جدید بسازید."
            action={
              <Link href="/admin/users/new" className={cn(buttonVariants())}>
                ایجاد کاربر
              </Link>
            }
          />
        }
        columns={[
          {
            key: "fullName",
            header: "نام",
            cell: (row) => (
              <Link className="font-medium text-[var(--brand)]" href={`/admin/users/${row.id}`}>
                {row.fullName}
              </Link>
            ),
          },
          { key: "username", header: "نام کاربری", cell: (row) => row.username },
          { key: "role", header: "نقش", cell: (row) => row.roleTitleFa },
          {
            key: "status",
            header: "وضعیت",
            cell: (row) => (row.isActive ? "فعال" : "غیرفعال"),
          },
          {
            key: "actions",
            header: "عملیات",
            cell: (row) => (
              <form action={toggleUserActiveAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="isActive" value={row.isActive ? "false" : "true"} />
                <Button type="submit" size="sm" variant="outline">
                  {row.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                </Button>
              </form>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
