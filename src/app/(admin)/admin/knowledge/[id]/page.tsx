import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  getKnowledgeItemById,
  listKnowledgeCategories,
} from "@/server/modules/knowledge/service";
import { deleteKnowledgeItemAction } from "@/server/actions/knowledge";

export const runtime = "nodejs";

export default async function AdminKnowledgeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.KNOWLEDGE_MANAGE);

  const { id } = await params;
  const item = getKnowledgeItemById(id);
  if (!item) notFound();

  const categories = listKnowledgeCategories();

  return (
    <AdminShell user={user}>
      <PageHeader
        title={item.title}
        description="ویرایش سناریو و رویکرد مربی‌گری"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/knowledge"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              بازگشت به فهرست
            </Link>
            <form action={deleteKnowledgeItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" variant="danger">
                حذف آیتم
              </Button>
            </form>
          </div>
        }
      />

      <KnowledgeForm item={item} extraCategories={categories} />
    </AdminShell>
  );
}
