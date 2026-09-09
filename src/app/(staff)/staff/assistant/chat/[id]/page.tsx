import Link from "next/link";
import { notFound } from "next/navigation";
import { AssistantShell } from "@/components/patterns/assistant-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTE_VISIBILITY, ROLE_KEYS } from "@/lib/enums";
import { formatDateTimeFa } from "@/lib/date";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  assertChatParticipant,
  getConversationById,
  listMessages,
  markConversationRead,
} from "@/server/modules/chat/service";
import {
  convertChatMessageToActionAction,
  convertChatMessageToNoteAction,
  markChatReadAction,
  sendChatMessageAction,
} from "@/server/actions/chat";

export const runtime = "nodejs";

export default async function AssistantChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(user, PERMISSIONS.CHAT_USE);

  const { id } = await params;
  try {
    assertChatParticipant(id, user.id);
  } catch {
    notFound();
  }

  markConversationRead(id, user.id);
  const conversation = getConversationById(id, user.id);
  if (!conversation) notFound();
  const messages = listMessages(id);

  async function send(formData: FormData) {
    "use server";
    await sendChatMessageAction({}, formData);
  }
  async function markRead(formData: FormData) {
    "use server";
    await markChatReadAction(formData);
  }
  async function toNote(formData: FormData) {
    "use server";
    await convertChatMessageToNoteAction({}, formData);
  }
  async function toAction(formData: FormData) {
    "use server";
    await convertChatMessageToActionAction({}, formData);
  }

  return (
    <AssistantShell user={user}>
      <div className="mb-4">
        <Link
          href="/staff/assistant/chat"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          بازگشت به فهرست گفتگوها
        </Link>
      </div>

      <PageHeader
        title={conversation.studentName ?? "گفتگو"}
        description="ارسال پیام و تبدیل سریع به یادداشت یا اقدام"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>رشته پیام‌ها</CardTitle>
          <form action={markRead}>
            <input type="hidden" name="conversationId" value={id} />
            <Button type="submit" size="sm" variant="outline">
              علامت‌خوانده
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            {messages.map((msg) => {
              const mine = msg.senderUserId === user.id;
              return (
                <div key={msg.id} className="space-y-2">
                  <div className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        mine
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "bg-[var(--muted)]"
                      }`}
                    >
                      <p className="leading-7 whitespace-pre-wrap">{msg.content}</p>
                      <p className="mt-1 text-[10px] opacity-70">
                        {msg.senderName} — {formatDateTimeFa(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                  {!mine ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={toNote} className="flex gap-1">
                        <input type="hidden" name="messageId" value={msg.id} />
                        <input
                          type="hidden"
                          name="visibility"
                          value={NOTE_VISIBILITY.PRIVATE_STAFF}
                        />
                        <Button type="submit" size="sm" variant="outline">
                          تبدیل به یادداشت
                        </Button>
                      </form>
                      <form action={toAction} className="flex gap-1">
                        <input type="hidden" name="messageId" value={msg.id} />
                        <Button type="submit" size="sm" variant="outline">
                          تبدیل به اقدام
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {messages.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">هنوز پیامی نیست.</p>
            ) : null}
          </div>

          <form action={send} className="flex gap-2">
            <input type="hidden" name="conversationId" value={id} />
            <Input name="content" placeholder="پاسخ خود را بنویسید…" required className="flex-1" />
            <Button type="submit">ارسال</Button>
          </form>
        </CardContent>
      </Card>
    </AssistantShell>
  );
}
