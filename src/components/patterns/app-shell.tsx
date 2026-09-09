import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppShellProps = {
  title?: string;
  nav?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AppShell({ title, nav, actions, children, className }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-[var(--brand)]">
                صفا نور
              </span>
              {title ? (
                <span className="text-xs text-[var(--muted-foreground)]">{title}</span>
              ) : null}
            </div>
            {nav}
          </div>
          {actions}
        </div>
      </header>
      <main className={cn("mx-auto max-w-7xl px-6 py-8", className)}>{children}</main>
    </div>
  );
}
