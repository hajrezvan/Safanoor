import Link from "next/link";
import { CourseCover } from "@/components/patterns/course-cover";
import { toFaDigits } from "@/lib/digits";
import type { catalog } from "@/server/modules/school/service";
export function SchoolCourseGrid({
  courses,
}: {
  courses: ReturnType<typeof catalog>;
}) {
  if (!courses.length)
    return (
      <p className="rounded-2xl bg-[var(--muted)] p-6 text-sm">
        دوره‌ای برای نمایش نیست.
      </p>
    );
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {courses.map((c) => (
        <Link
          key={c.id}
          href={`/student/school/courses/${c.id}`}
          className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]"
        >
          <CourseCover
            coverPath={c.coverPath}
            title={c.title}
            className="aspect-[4/3] w-full"
          />
          <div className="space-y-3 p-4">
            <h3 className="font-bold leading-7">{c.title}</h3>
            <p className="line-clamp-2 text-xs leading-6 text-[var(--muted-foreground)]">
              {c.description}
            </p>
            <div className="flex justify-between text-xs">
              <span>
                {c.isGroup
                  ? "گروه دوره"
                  : `${toFaDigits(c.progress.total)} درس`}
              </span>
              <span>
                {c.enrollment?.status === "completed"
                  ? "تکمیل‌شده ✓"
                  : c.enrollment && c.enrollment.status !== "cancelled"
                    ? `${toFaDigits(c.progress.percent)}٪ پیشرفت`
                    : "مشاهده دوره"}
              </span>
            </div>
            {c.enrollment && (
              <progress
                aria-label="پیشرفت دوره"
                value={c.progress.percent}
                max={100}
                className="h-1.5 w-full accent-[var(--brand)]"
              />
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
