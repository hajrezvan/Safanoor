import Link from "next/link";
import { MentorShell } from "@/components/patterns/mentor-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { FilterBar } from "@/components/patterns/filter-bar";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KNOWLEDGE_ITEM_STATUS,
  KNOWLEDGE_ITEM_STATUS_TITLES_FA,
  ROLE_KEYS,
} from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  listKnowledgeCategories,
  listKnowledgeItems,
  listKnowledgeTags,
} from "@/server/modules/knowledge/service";
import { seedKnowledgeItemsAction } from "@/server/actions/knowledge";

export const runtime = "nodejs";

export default async function MentorKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; tag?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.KNOWLEDGE_MANAGE);

  const params = await searchParams;
  const items = listKnowledgeItems({
    search: params.q,
    category: params.category || undefined,
    status: params.status || undefined,
    tag: params.tag || undefined,
  });
  const categories = listKnowledgeCategories();
  const tags = listKnowledgeTags();

  return (
    <MentorShell user={user}>
      <PageHeader
        title="بانک دانش"
        description="سناریوهای مربی‌گری را ببینید یا مورد جدید ثبت کنید."
        actions={
          <form action={seedKnowledgeItemsAction}>
            <Button type="submit" variant="outline">
              تکمیل سناریوهای پیش‌فرض
            </Button>
          </form>
        }
      />

      <div className="mb-6">
        <KnowledgeForm extraCategories={categories} />
      </div>

      <FilterBar>
        <form className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">جستجو</label>
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="عنوان، سناریو، رویکرد…"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">دسته</label>
            <select
              name="category"
              defaultValue={params.category ?? ""}
              className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
            >
              <option value="">همه</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
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
              {Object.values(KNOWLEDGE_ITEM_STATUS).map((status) => (
                <option key={status} value={status}>
                  {KNOWLEDGE_ITEM_STATUS_TITLES_FA[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">برچسب</label>
            <select
              name="tag"
              defaultValue={params.tag ?? ""}
              className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
            >
              <option value="">همه</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
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
            title="آیتمی یافت نشد"
            description="با فرم بالا یک سناریو ثبت کنید یا سناریوهای پیش‌فرض را بارگذاری کنید."
          />
        }
        columns={[
          {
            key: "title",
            header: "عنوان",
            cell: (row) => (
              <Link
                href={`/staff/mentor/knowledge/${row.id}`}
                className="font-medium hover:underline"
              >
                {row.title}
              </Link>
            ),
          },
          { key: "category", header: "دسته", cell: (row) => row.category },
          {
            key: "status",
            header: "وضعیت",
            cell: (row) =>
              KNOWLEDGE_ITEM_STATUS_TITLES_FA[
                row.status as keyof typeof KNOWLEDGE_ITEM_STATUS_TITLES_FA
              ] ?? row.status,
          },
          {
            key: "tags",
            header: "برچسب‌ها",
            cell: (row) => row.tags || "—",
          },
          {
            key: "actions",
            header: "عملیات",
            cell: (row) => (
              <Link
                href={`/staff/mentor/knowledge/${row.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                مشاهده / ویرایش
              </Link>
            ),
          },
        ]}
      />
    </MentorShell>
  );
}
