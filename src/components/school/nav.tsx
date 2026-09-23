"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export const staffSchoolSections = [
  ["", "پیشخوان"],
  ["courses", "دوره‌ها"],
  ["lessons", "دروس"],
  ["playlists", "محتوای منتخب"],
  ["exams", "آزمون‌ها"],
  ["banks", "بانک سؤال"],
  ["comments", "نظرات"],
  ["enrollments", "ثبت‌نام‌ها"],
  ["reports", "گزارش‌ها"],
  ["certificates", "گواهی‌ها"],
  ["settings", "بنر صفحه"],
];
const studentSections = [
  ["", "پیشخوان"],
  ["catalog", "تمام دوره‌ها"],
  ["report", "کارنامه من"],
  ["playlists", "محتوای منتخب"],
  ["certificates", "گواهینامه‌ها"],
  ["verify", "تأیید گواهینامه"],
];
export function SchoolNav({ staff = false }: { staff?: boolean }) {
  const pathname = usePathname();
  const root = staff ? "/staff/school" : "/student/school";
  return (
    <nav
      aria-label="بخش‌های مدرسه"
      className="mb-6 flex gap-2 overflow-x-auto border-b border-[var(--border)] pb-3"
    >
      {(staff ? staffSchoolSections : studentSections).map(([path, title]) => {
        const href = path ? `${root}/${path}` : root;
        return (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm ${pathname === href ? "bg-[var(--brand)] font-bold text-white" : "bg-[var(--muted)]"}`}
          >
            {title}
          </Link>
        );
      })}
    </nav>
  );
}
