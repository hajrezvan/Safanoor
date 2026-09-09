import { cn } from "@/lib/utils";

export function ProfileSectionCard({
  title,
  icon,
  action,
  children,
  className,
  accent = "teal",
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accent?: "teal" | "orange";
}) {
  const iconBg =
    accent === "orange" ? "bg-[var(--accent-orange-soft)] text-[var(--accent-orange)]" : "bg-[var(--brand-soft)] text-[var(--brand)]";

  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className={cn("inline-flex size-9 items-center justify-center rounded-full text-sm", iconBg)}>
              {icon}
            </span>
          ) : null}
          <h2 className="text-base font-bold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
