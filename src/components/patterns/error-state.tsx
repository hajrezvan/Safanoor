import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "خطایی رخ داد",
  description = "لطفاً دوباره تلاش کنید یا با مدیر سامانه تماس بگیرید.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-6 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-white/70 text-[var(--danger)]">
        <AlertTriangle className="size-5" />
      </div>
      <h2 className="text-base font-semibold text-[var(--danger)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-7 text-[var(--muted-foreground)]">
        {description}
      </p>
      {onRetry ? (
        <Button type="button" variant="outline" className="mt-6" onClick={onRetry}>
          تلاش مجدد
        </Button>
      ) : null}
    </div>
  );
}
