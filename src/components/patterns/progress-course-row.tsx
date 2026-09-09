import Link from "next/link";
import { toFaDigits } from "@/lib/digits";
import { cn } from "@/lib/utils";

export function ProgressCourseRow({
  title,
  href,
  progress,
  meta,
  thumbnail,
  completed,
  className,
}: {
  title: string;
  href?: string;
  progress: number;
  meta?: string;
  thumbnail?: React.ReactNode;
  completed?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, progress));
  const body = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <div className="ms-auto flex min-w-0 flex-1 flex-col gap-2 text-start">
        <p className="truncate text-sm font-bold">{title}</p>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className={cn("h-full rounded-full", completed ? "bg-[var(--accent-green)]" : "bg-[var(--brand)]")}
            style={{ width: `${pct}%` }}
          />
        </div>
        {meta ? (
          <p className="text-xs text-[var(--muted-foreground)]">{toFaDigits(meta)}</p>
        ) : null}
      </div>
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--muted)]">
        {thumbnail ?? <span className="text-xs text-[var(--muted-foreground)]">درس</span>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {body}
      </Link>
    );
  }
  return body;
}
