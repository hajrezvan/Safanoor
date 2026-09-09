import { toFaDigits } from "@/lib/digits";
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]",
  green: "bg-[var(--accent-green-soft)] text-[var(--accent-green)]",
  orange: "bg-[var(--accent-orange-soft)] text-[var(--accent-orange)]",
  teal: "bg-[var(--brand-soft)] text-[var(--brand)]",
} as const;

export function StatPillCard({
  label,
  value,
  icon,
  tone = "teal",
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-max shrink-0 flex-1 flex-col gap-2 rounded-[var(--radius-card)] px-4 py-3 shadow-[var(--shadow-sm)]",
        tones[tone],
        className,
      )}
    >
      {icon ? <span className="text-lg">{icon}</span> : null}
      <p className="text-lg font-bold leading-none text-[var(--foreground)]">{toFaDigits(value)}</p>
      <p className="whitespace-nowrap text-xs text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}
