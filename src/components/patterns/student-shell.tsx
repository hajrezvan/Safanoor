import { AppNav, studentDesktopNav, studentBottomNav } from "@/components/patterns/app-nav";
import { BottomNav } from "@/components/patterns/bottom-nav";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/server/auth/session";

export function StudentShell({
  user,
  children,
  title,
  fullWidth = false,
}: {
  user: AuthUser;
  children: React.ReactNode;
  title?: string;
  /**
   * Chat / fill layouts: viewport-height column for usable threads,
   * but still the same max-w-3xl chrome as other student pages.
   */
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-[var(--background)] text-[var(--foreground)]",
        fullWidth ? "flex h-dvh flex-col overflow-hidden" : "min-h-screen",
      )}
    >
      <header className="sticky top-0 z-40 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <div>
            <p className="text-base font-bold text-[var(--brand)]">صفا نور</p>
            {title ? (
              <p className="text-xs text-[var(--muted-foreground)]">{title}</p>
            ) : null}
          </div>
          <div className="hidden md:block">
            <AppNav items={studentDesktopNav} />
          </div>
        </div>
      </header>
      <main
        className={cn(
          "mx-auto w-full max-w-3xl bg-[var(--surface)] md:border-x md:border-[var(--border)]",
          fullWidth
            ? "flex min-h-0 flex-1 flex-col px-0 pb-24 md:px-4 md:pb-4 md:pt-4"
            : "min-h-[calc(100dvh-3.5rem)] px-4 py-6 pb-24 md:pb-8",
        )}
      >
        {children}
      </main>
      <BottomNav items={studentBottomNav} />
      <span className="sr-only">{user.fullName}</span>
    </div>
  );
}
