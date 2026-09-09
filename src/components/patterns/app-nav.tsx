"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  /** Iconify icon name, e.g. `mdi:home` */
  iconify?: string;
  section?: string;
};

export function AppNav({ items, className }: { items: NavItem[]; className?: string }) {
  return (
    <nav className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          {item.iconify ? <Icon icon={item.iconify} className="size-4 shrink-0" aria-hidden /> : null}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** منوی مشترک پنل staff (ادمین / مربی / کمک‌مربی) */
export const staffMainNav: NavItem[] = [
  { href: "/staff", label: "داشبورد", iconify: "mdi:view-dashboard" },
  { href: "/staff/forces", label: "نیروها", iconify: "mdi:account" },
  { href: "/staff/assistants", label: "کمک‌مربیان", iconify: "mdi:account-group" },
  { href: "/staff/library", label: "کتابخانه", iconify: "mdi:bookshelf" },
  { href: "/staff/classes", label: "کلاس‌ها", iconify: "mdi:school" },
  { href: "/staff/announcements", label: "اطلاعیه‌ها", iconify: "mdi:bullhorn" },
];

export const staffAdminExtraNav: NavItem[] = [
  { href: "/admin/users", label: "کاربران", section: "مدیریت سامانه", iconify: "mdi:cog" },
  { href: "/admin/grades", label: "پایه‌ها", section: "مدیریت سامانه", iconify: "mdi:table" },
  { href: "/admin/groups", label: "گروه‌ها", section: "مدیریت سامانه", iconify: "mdi:circle-outline" },
  { href: "/admin/paths", label: "مسیرها", section: "مدیریت سامانه", iconify: "mdi:arrow-right-bold" },
  { href: "/admin/knowledge", label: "بانک دانش", section: "مدیریت سامانه", iconify: "mdi:star-four-points" },
  { href: "/staff/mentor/ai", label: "مربی‌یار", section: "ابزارها", iconify: "mdi:robot" },
];

export const staffToolsNav: NavItem[] = [
  { href: "/staff/sessions", label: "جلسات", section: "ابزارها", iconify: "mdi:clock-outline" },
  { href: "/staff/referrals", label: "ارجاع‌ها", section: "ابزارها", iconify: "mdi:arrow-top-right" },
  { href: "/staff/follow-ups", label: "پیگیری", section: "ابزارها", iconify: "mdi:check" },
  { href: "/staff/chat", label: "چت", section: "ابزارها", iconify: "mdi:message-text" },
];

export const studentBottomNav: NavItem[] = [
  { href: "/student/profile", label: "پروفایل", iconify: "mdi:account-circle" },
  { href: "/student/library", label: "کتابخانه", iconify: "mdi:bookshelf" },
  { href: "/student", label: "خانه", iconify: "mdi:home" },
  { href: "/student/school", label: "مدرسه", iconify: "mdi:school" },
  { href: "/student/messenger", label: "پیامرسان", iconify: "mdi:message-text" },
];

export const studentDesktopNav: NavItem[] = [
  { href: "/student", label: "خانه", iconify: "mdi:home" },
  { href: "/student/school", label: "مدرسه", iconify: "mdi:school" },
  { href: "/student/library", label: "کتابخانه", iconify: "mdi:bookshelf" },
  { href: "/student/messenger", label: "پیامرسان", iconify: "mdi:message-text" },
  { href: "/student/profile", label: "پروفایل", iconify: "mdi:account-circle" },
];

/** @deprecated — use staffMainNav */
export const adminNav = staffMainNav;
/** @deprecated */
export const mentorNav = staffMainNav;
/** @deprecated */
export const assistantNav = staffMainNav;
/** @deprecated */
export const studentNav = studentDesktopNav;
