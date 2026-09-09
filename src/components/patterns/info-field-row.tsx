import { cn } from "@/lib/utils";

export function InfoFieldRow({
  children,
  accent = "teal",
  className,
}: {
  children: React.ReactNode;
  accent?: "teal" | "orange" | "blue" | "green";
  className?: string;
}) {
  const bar =
    accent === "orange"
      ? "bg-[var(--accent-orange)]"
      : accent === "blue"
        ? "bg-[var(--accent-blue)]"
        : accent === "green"
          ? "bg-[var(--accent-green)]"
          : "bg-[var(--brand)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-field)] bg-[var(--muted)] px-4 py-3 pe-5",
        className,
      )}
    >
      <span className={cn("absolute inset-y-2 end-1.5 w-1 rounded-full", bar)} aria-hidden />
      <div className="text-sm leading-7 text-[var(--foreground)]">{children}</div>
    </div>
  );
}
