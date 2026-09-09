import Link from "next/link";
import { AssistantShell } from "@/components/patterns/assistant-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_KEYS } from "@/lib/enums";
import { formatDateTimeFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { listStaffConversations } from "@/server/modules/chat/service";
import { listStudentsForStaff } from "@/server/modules/students/service";
import { startChatWithStudentAction } from "@/server/actions/chat";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function AssistantChatListPage() {
  const user = await requireRole(ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(user, PERMISSIONS.CHAT_USE);

  const conversations = listStaffConversations(user.id);
  const students = listStudentsForStaff(user.id, user.roleKey);

  async function startChat(formData: FormData) {
    "use server";
    const id = await startChatWithStudentAction(formData);
    redirect(`/staff/assistant/chat/${id}`);
  }

  return (
    <AssistantShell user={user}>
      <PageHeader
        title="چت پشتیبانی"
        description="مکالمات فعال با دانش‌آموزان محدوده شما"
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {conversations.length === 0 ? (
            <EmptyState
              title="مکالمه‌ای نیست"
              description="از فهرست سمت چپ با یک دانش‌آموز گفتگو را شروع کنید."
            />
          ) : (
            conversations.map((conv) => (
              <Link key={conv.id} href={`/staff/assistant/chat/${conv.id}`} className="block">
                <Card className="transition-colors hover:bg-[var(--surface)]">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium">{conv.studentName ?? "دانش‌آموز"}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                        {conv.lastMessagePreview ?? "بدون پیام"}
                      </p>
                      {conv.lastMessageAt ? (
                        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                          {formatDateTimeFa(conv.lastMessageAt)}
                        </p>
                      ) : null}
                    </div>
                    {Number(conv.unreadCount) > 0 ? (
                      <span className="rounded-full bg-[var(--primary)] px-2.5 py-1 text-xs text-[var(--primary-foreground)]">
                        {toFaDigits(conv.unreadCount)}
                      </span>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">شروع گفتگوی جدید</p>
            {students.map((student) =>
              student.userId ? (
                <form action={startChat} key={student.id} className="flex items-center justify-between gap-2">
                  <input type="hidden" name="studentId" value={student.id} />
                  <span className="text-sm">{student.fullName}</span>
                  <Button type="submit" size="sm" variant="outline">
                    گفتگو
                  </Button>
                </form>
              ) : null,
            )}
            {students.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">دانش‌آموزی در محدوده نیست.</p>
            ) : null}
            <Link
              href="/staff/assistant/students"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
            >
              مدیریت دانش‌آموزان
            </Link>
          </CardContent>
        </Card>
      </div>
    </AssistantShell>
  );
}
