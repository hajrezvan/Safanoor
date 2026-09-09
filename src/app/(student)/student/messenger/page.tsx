import { redirect } from "next/navigation";
import { StudentShell } from "@/components/patterns/student-shell";
import { EmptyState } from "@/components/patterns/empty-state";
import { ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { listStudentChatInbox } from "@/server/modules/chat/service";
import { ContactInboxList } from "./contact-inbox-list";

export const runtime = "nodejs";

export default async function StudentMessengerInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; staffId?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  assertPermission(user, PERMISSIONS.CHAT_USE);

  const params = await searchParams;
  const legacyStaffId = params.staffId || params.staff;
  if (legacyStaffId) {
    redirect(`/student/messenger/${encodeURIComponent(legacyStaffId)}`);
  }

  const inbox = listStudentChatInbox(user.id);

  return (
    <StudentShell user={user} title="پیامرسان" fullWidth>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--background)] md:rounded-[var(--radius-card)] md:border md:border-[var(--border)] md:bg-[var(--card)] md:shadow-[var(--shadow-card)]">
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex min-h-0 w-full flex-1 flex-col md:w-72 md:flex-none md:shrink-0 md:border-e md:border-[var(--border)]">
            <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:bg-transparent">
              <h1 className="text-lg font-bold tracking-tight text-[var(--foreground)] md:text-base">
                پیامرسان
              </h1>
              <p className="text-sm leading-7 text-[var(--muted-foreground)] md:text-xs md:leading-5">
                گفتگو با کمک‌مربی یا مربی تخصیص‌یافته
              </p>
            </div>

            {inbox.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-4 py-8">
                <EmptyState
                  title="مخاطبی نیست"
                  description="هنوز پشتیبان یا مربی‌ای به شما تخصیص داده نشده است."
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ContactInboxList items={inbox} />
              </div>
            )}
          </aside>

          <div className="hidden min-h-0 flex-1 items-center justify-center px-4 md:flex">
            <EmptyState
              title="گفتگویی انتخاب کنید"
              description="از فهرست کنار، یک مخاطب را برای شروع یا ادامه گفتگو برگزینید."
            />
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
