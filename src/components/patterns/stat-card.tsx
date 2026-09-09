import { toFaDigits } from "@/lib/digits";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
};

export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)]">
        {toFaDigits(value)}
      </p>
      {hint ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{toFaDigits(hint)}</p> : null}
    </div>
  );
}
