import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@iconify/react";
import { StudentShell } from "@/components/patterns/student-shell";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_KEYS } from "@/lib/enums";
import { formatDateTimeFa } from "@/lib/date";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  getOrCreateConversationForStudent,
  listMessages,
  listStudentChatInbox,
  markConversationRead,
} from "@/server/modules/chat/service";
import { sendChatMessageAction } from "@/server/actions/chat";
import { ContactInboxList, ContactAvatar } from "../contact-inbox-list";

export const runtime = "nodejs";

export default async function StudentMessengerThreadPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  assertPermission(user, PERMISSIONS.CHAT_USE);

  const { staffId: rawStaffId } = await params;
  const staffId = decodeURIComponent(rawStaffId);

  const inbox = listStudentChatInbox(user.id);
  const selectedContact = inbox.find((c) => c.staffUserId === staffId) ?? null;

  if (!selectedContact) {
    notFound();
  }

  let conversation = null as Awaited<ReturnType<typeof getOrCreateConversationForStudent>> | null;
  let error: string | null = null;

  try {
    conversation = getOrCreateConversationForStudent(user.id, staffId);
    markConversationRead(conversation.id, user.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "گفتگو در دسترس نیست.";
  }

  const messages = conversation ? listMessages(conversation.id) : [];

  async function send(formData: FormData) {
    "use server";
    await sendChatMessageAction({}, formData);
  }

  return (
    <StudentShell user={user} title="پیامرسان" fullWidth>
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[var(--background)] md:rounded-[var(--radius-card)] md:border md:border-[var(--border)] md:bg-[var(--card)] md:shadow-[var(--shadow-card)]">
        {/* دسکتاپ: فهرست مخاطبین کنار گفتگو */}
        <aside className="hidden min-h-0 w-72 shrink-0 flex-col border-e border-[var(--border)] md:flex">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h1 className="text-base font-bold tracking-tight text-[var(--foreground)]">
              پیامرسان
            </h1>
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">فهرست گفتگوها</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ContactInboxList items={inbox} activeStaffId={staffId} />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 md:bg-transparent">
            <Link
              href="/student/messenger"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "shrink-0 md:hidden",
              )}
              aria-label="بازگشت به فهرست گفتگوها"
            >
              <Icon icon="mdi:chevron-right" className="size-6" aria-hidden />
            </Link>
            <ContactAvatar
              name={selectedContact.staffName}
              avatarPath={selectedContact.staffAvatarPath}
              sizeClass="size-9"
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <p className="min-w-0 break-words text-sm font-semibold leading-5">
                {selectedContact.staffName}
              </p>
              {selectedContact.roleTitleFa ? (
                <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                  {selectedContact.roleTitleFa}
                </span>
              ) : null}
            </div>
          </div>

          {error || !conversation ? (
            <div className="flex flex-1 items-center justify-center px-4 py-8">
              <EmptyState
                title="گفتگویی فعال نیست"
                description={error ?? "پشتیبانی تخصیص داده نشده است."}
              />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--background)] px-4 py-4 md:bg-transparent">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--muted-foreground)]">
                    هنوز پیامی رد و بدل نشده است.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const mine = msg.senderUserId === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${mine ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                            mine
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "bg-[var(--muted)] text-[var(--foreground)]"
                          }`}
                        >
                          <p className="leading-7 whitespace-pre-wrap">{msg.content}</p>
                          <p className="mt-1 text-[10px] opacity-70">
                            {msg.senderName} — {formatDateTimeFa(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                action={send}
                className="flex shrink-0 gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:bg-transparent"
              >
                <input type="hidden" name="conversationId" value={conversation.id} />
                <Input
                  name="content"
                  placeholder="پیام خود را بنویسید…"
                  required
                  className="flex-1"
                  autoComplete="off"
                />
                <Button type="submit">ارسال</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
