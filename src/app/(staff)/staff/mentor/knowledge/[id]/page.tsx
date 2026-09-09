import Link from "next/link";
import { notFound } from "next/navigation";
import { MentorShell } from "@/components/patterns/mentor-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KNOWLEDGE_ITEM_STATUS_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  getKnowledgeItemById,
  listKnowledgeCategories,
} from "@/server/modules/knowledge/service";

export const runtime = "nodejs";

export default async function MentorKnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.KNOWLEDGE_MANAGE);

  const { id } = await params;
  const item = getKnowledgeItemById(id);
  if (!item) notFound();

  const categories = listKnowledgeCategories();

  return (
    <MentorShell user={user}>
      <PageHeader
        title={item.title}
        description={`${item.category} — ${
          KNOWLEDGE_ITEM_STATUS_TITLES_FA[
            item.status as keyof typeof KNOWLEDGE_ITEM_STATUS_TITLES_FA
          ] ?? item.status
        }`}
        actions={
          <Link
            href="/staff/mentor/knowledge"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            بازگشت به فهرست
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>سناریو</CardTitle>
          </CardHeader>
          <CardContent className="leading-7 text-sm whitespace-pre-wrap">
            {item.questionScenario}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>رویکرد پیشنهادی</CardTitle>
          </CardHeader>
          <CardContent className="leading-7 text-sm whitespace-pre-wrap">
            {item.recommendedApproach}
          </CardContent>
        </Card>
        {item.cautions ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>هشدارها</CardTitle>
            </CardHeader>
            <CardContent className="leading-7 text-sm whitespace-pre-wrap">
              {item.cautions}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <KnowledgeForm item={item} extraCategories={categories} />
    </MentorShell>
  );
}
