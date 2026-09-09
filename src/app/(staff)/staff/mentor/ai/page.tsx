import Link from "next/link";
import { MentorShell } from "@/components/patterns/mentor-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { MentorAiAssistPanel } from "@/components/ai/mentor-ai-assist-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { formatDateTimeFa } from "@/lib/date";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { listStudentsForStaff } from "@/server/modules/students/service";
import { listAiInteractions } from "@/ai/services/interactions";
import { displayTextFromAiOutput } from "@/ai/context/builder";
import { AI_SUGGESTION_DISCLAIMER_FA } from "@/ai/prompts/safety";

export const runtime = "nodejs";

export default async function MentorAiPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.MENTOR, ROLE_KEYS.ADMIN);
  assertPermission(user, PERMISSIONS.AI_USE);

  const { studentId } = await searchParams;
  const scopedStudents = listStudentsForStaff(user.id, user.roleKey).map((s) => ({
    id: s.id,
    fullName: s.fullName,
  }));

  const recent = listAiInteractions({
    createdBy: user.roleKey === ROLE_KEYS.ADMIN ? undefined : user.id,
    limit: 8,
  }).filter((row) => {
    if (user.roleKey === ROLE_KEYS.ADMIN) return true;
    return scopedStudents.some((s) => s.id === row.studentId);
  });

  const defaultStudentId =
    studentId && scopedStudents.some((s) => s.id === studentId) ? studentId : undefined;

  return (
    <MentorShell user={user}>
      <PageHeader
        title="مربی‌یار هوشمند"
        description="پیشنهاد وضعیت، موضوعات جلسه، سؤالات و اقدامات — بدون اجرای خودکار"
      />

      <p className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-7 text-[var(--muted-foreground)]">
        {AI_SUGGESTION_DISCLAIMER_FA}
      </p>

      <MentorAiAssistPanel students={scopedStudents} defaultStudentId={defaultStudentId} />

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>تعامل‌های اخیر AI</CardTitle>
          <Link
            href="/staff/mentor/sessions"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            جلسات و خلاصه‌سازی
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">هنوز تعاملی ثبت نشده است.</p>
          ) : (
            recent.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{row.feature}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatDateTimeFa(row.createdAt)}
                    {row.accepted ? ` — ${row.accepted}` : " — در انتظار بررسی"}
                  </p>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-[var(--muted-foreground)]">
                  {displayTextFromAiOutput(row.output)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </MentorShell>
  );
}
