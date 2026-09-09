import { cn } from "@/lib/utils";

export function LoadingState({
  label = "در حال بارگذاری…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-16",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
