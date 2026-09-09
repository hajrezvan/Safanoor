"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/patterns/app-nav";

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
        {items.map((item) => {
          const active =
            item.href === "/student"
              ? pathname === "/student"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px]",
                  active ? "text-[var(--brand)]" : "text-[var(--muted-foreground)]",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full",
                    active ? "bg-[var(--brand-soft)]" : "bg-transparent",
                  )}
                >
                  {item.iconify ? (
                    <Icon
                      icon={item.iconify}
                      className={cn(
                        "size-5",
                        active ? "text-[var(--brand)]" : "text-[var(--muted-foreground)]",
                      )}
                      aria-hidden
                    />
                  ) : (
                    "•"
                  )}
                </span>
                <span className={cn(active && "font-bold")}>{item.label}</span>
                {active ? <span className="h-0.5 w-6 rounded-full bg-[var(--brand)]" /> : <span className="h-0.5 w-6" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
