import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { ROLE_KEYS } from "@/lib/enums";
import { formatDateTimeFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import { requireRole } from "@/server/auth/guards";
import { getAssistantDetail } from "@/server/modules/assistants/service";

export const runtime = "nodejs";

export default async function AssistantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );
  const { id } = await params;
  const detail = getAssistantDetail(id, user);
  if (!detail) notFound();

  return (
    <StaffShell user={user} title={detail.user.fullName}>
      <PageHeader
        title={detail.user.fullName}
        description={`@${detail.user.username}${detail.user.email ? ` · ${detail.user.email}` : ""}`}
      />

      <h2 className="mb-3 text-base font-bold">دانش‌آموزان ({toFaDigits(detail.students.length)})</h2>
      <div className="mb-8 space-y-2">
        {detail.students.map((s) => (
          <Link
            key={s.id}
            href={`/staff/forces/${s.id}`}
            className="block rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium"
          >
            {s.fullName}
          </Link>
        ))}
        {detail.students.length === 0 ? (
          <EmptyState title="دانش‌آموزی تخصیص داده نشده" className="py-8" />
        ) : null}
      </div>

      <h2 className="mb-3 text-base font-bold">گفتگوها ({toFaDigits(detail.conversations.length)})</h2>
      <div className="mb-8 space-y-2">
        {detail.conversations.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
          >
            <p className="text-sm font-medium">{c.studentName ?? "دانش‌آموز"}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {c.lastMessagePreview ?? "بدون پیام"}
              {c.unreadCount > 0 ? ` · ${toFaDigits(c.unreadCount)} خوانده‌نشده` : ""}
            </p>
          </div>
        ))}
        {detail.conversations.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">گفتگویی نیست.</p>
        ) : null}
      </div>

      <h2 className="mb-3 text-base font-bold">یادداشت‌ها ({toFaDigits(detail.notes.length)})</h2>
      <div className="space-y-2">
        {detail.notes.slice(0, 20).map((n) => (
          <div
            key={n.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
          >
            <p className="text-sm leading-7">{n.content}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {n.studentName} — {formatDateTimeFa(n.createdAt)}
            </p>
          </div>
        ))}
        {detail.notes.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">یادداشتی نیست.</p>
        ) : null}
      </div>
    </StaffShell>
  );
}
