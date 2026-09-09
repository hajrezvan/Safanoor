import Link from "next/link";
import { Icon } from "@iconify/react";
import { formatDateFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import { resolveMediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { StudentChatInboxItem } from "@/server/modules/chat/service";

/** Compact inbox timestamp — drops year / «ساعت» so name + chip keep room. */
function formatInboxTimeFa(iso: string) {
  return formatDateFa(iso, {
    year: undefined,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ContactAvatar({
  name,
  avatarPath,
  sizeClass = "size-11",
}: {
  name: string;
  avatarPath?: string | null;
  sizeClass?: string;
}) {
  const src = resolveMediaSrc(avatarPath);
  const initial = name.trim().slice(0, 1) || "؟";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary)]/10 text-sm font-bold text-[var(--primary)]",
        sizeClass,
      )}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full rounded-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

export function ContactInboxList({
  items,
  activeStaffId,
  className,
}: {
  items: StudentChatInboxItem[];
  activeStaffId?: string | null;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-[var(--border)]", className)} role="list">
      {items.map((item) => {
        const active = item.staffUserId === activeStaffId;
        const unread = item.unreadCount > 0;
        return (
          <li key={item.staffUserId}>
            <Link
              href={`/student/messenger/${encodeURIComponent(item.staffUserId)}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 transition-colors",
                active
                  ? "bg-[var(--muted)]"
                  : "hover:bg-[var(--surface)] active:bg-[var(--muted)]",
              )}
            >
              <ContactAvatar name={item.staffName} avatarPath={item.staffAvatarPath} />

              <div className="min-w-0 flex-1 text-start">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <p
                      className={cn(
                        "min-w-0 break-words text-sm leading-5 text-[var(--foreground)]",
                        unread ? "font-bold" : "font-semibold",
                      )}
                    >
                      {item.staffName}
                    </p>
                    {item.roleTitleFa ? (
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                        {item.roleTitleFa}
                      </span>
                    ) : null}
                  </div>
                  {item.lastMessageAt ? (
                    <time
                      className="shrink-0 whitespace-nowrap pt-0.5 text-[10px] leading-4 text-[var(--muted-foreground)]"
                      dateTime={item.lastMessageAt}
                    >
                      {formatInboxTimeFa(item.lastMessageAt)}
                    </time>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mt-1 line-clamp-1 text-xs leading-5",
                    unread
                      ? "font-medium text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)]",
                  )}
                >
                  {item.lastMessagePreview?.trim() || "هنوز پیامی رد و بدل نشده است."}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-1.5">
                {unread ? (
                  <span className="flex min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary-foreground)]">
                    {item.unreadCount > 99 ? "۹۹+" : toFaDigits(item.unreadCount)}
                  </span>
                ) : null}
                <Icon
                  icon="mdi:chevron-left"
                  className="size-5 text-[var(--muted-foreground)]"
                  aria-hidden
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export { ContactAvatar };
