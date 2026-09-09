"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  staffAdminExtraNav,
  staffMainNav,
  staffToolsNav,
  type NavItem,
} from "@/components/patterns/app-nav";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";
import type { AuthUser } from "@/server/auth/session";
import { ROLE_KEYS } from "@/lib/enums";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active =
    item.href === "/staff"
      ? pathname === "/staff"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-[var(--brand-soft)] font-bold text-[var(--brand)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {item.iconify ? (
        <Icon
          icon={item.iconify}
          className={cn(
            "size-5 shrink-0",
            active ? "text-[var(--brand)]" : "text-[var(--muted-foreground)]",
          )}
          aria-hidden
        />
      ) : (
        <span className="w-5" />
      )}
      {item.label}
    </Link>
  );
}

function SidebarBody({
  user,
  onNavigate,
}: {
  user: AuthUser;
  onNavigate?: () => void;
}) {
  const showAdmin = user.roleKey === ROLE_KEYS.ADMIN;
  const showMentorAi = user.roleKey === ROLE_KEYS.MENTOR || user.roleKey === ROLE_KEYS.ADMIN;

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <p className="text-lg font-bold text-[var(--brand)]">صفا نور</p>
        <p className="text-xs text-[var(--muted-foreground)]">{user.fullName}</p>
      </div>

      <div className="space-y-1">
        <p className="mb-2 px-3 text-[10px] font-bold tracking-wide text-[var(--muted-foreground)]">
          منوی اصلی
        </p>
        {staffMainNav.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="space-y-1">
        <p className="mb-2 px-3 text-[10px] font-bold tracking-wide text-[var(--muted-foreground)]">
          ابزارها
        </p>
        {staffToolsNav.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
        {showMentorAi ? (
          <NavLink
            item={{ href: "/staff/ai", label: "مربی‌یار", iconify: "mdi:robot" }}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>

      {showAdmin ? (
        <div className="space-y-1">
          <p className="mb-2 px-3 text-[10px] font-bold tracking-wide text-[var(--muted-foreground)]">
            مدیریت سامانه
          </p>
          {staffAdminExtraNav
            .filter((i) => i.href.startsWith("/admin"))
            .map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
        </div>
      ) : null}

      <form action={logoutAction} className="mt-auto">
        <Button type="submit" variant="outline" size="sm" className="w-full">
          خروج
        </Button>
      </form>
    </div>
  );
}

export function StaffShell({
  user,
  children,
  title,
}: {
  user: AuthUser;
  children: React.ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] md:flex">
      <aside className="hidden w-64 shrink-0 border-e border-[var(--border)] bg-[var(--surface)] p-4 md:block">
        <SidebarBody user={user} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="بستن منو"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 end-0 w-72 bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <SidebarBody user={user} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm md:hidden"
              onClick={() => setOpen(true)}
            >
              منو
            </button>
            <div>
              <p className="text-sm font-bold md:hidden">صفا نور</p>
              {title ? <p className="text-xs text-[var(--muted-foreground)]">{title}</p> : null}
            </div>
          </div>
          <p className="hidden text-sm text-[var(--muted-foreground)] md:block">{user.fullName}</p>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
