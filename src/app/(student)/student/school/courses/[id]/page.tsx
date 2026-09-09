import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { CourseCover } from "@/components/patterns/course-cover";
import { EmptyState } from "@/components/patterns/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { COURSE_STATUS, ROLE_KEYS } from "@/lib/enums";
import { toFaDigits } from "@/lib/digits";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import {
  getCourseById,
  getCourseProgressForStudent,
  listLessons,
} from "@/server/modules/courses/service";
import { getStudentByUserId } from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const { id } = await params;
  const course = getCourseById(id);
  if (!course || course.status !== COURSE_STATUS.PUBLISHED) notFound();

  const student = getStudentByUserId(user.id);
  const lessons = listLessons(course.id);
  const progress = student
    ? getCourseProgressForStudent(student.id, course.id)
    : {
        completedCount: 0,
        progressPercent: 0,
        lessonCount: lessons.length,
      };

  const completedCount = progress?.completedCount ?? 0;
  const lessonCount = progress?.lessonCount ?? lessons.length;
  const progressPercent = progress?.progressPercent ?? 0;
  const description = course.description?.trim() || null;

  return (
    <StudentShell user={user} title={course.title}>
      <PageHeader
        title={course.title}
        description={`${toFaDigits(completedCount)} از ${toFaDigits(lessonCount)} درس تکمیل شده${
          progressPercent > 0 ? ` · ${toFaDigits(progressPercent)}٪` : ""
        }`}
        actions={
          <Link
            href="/student/school"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            بازگشت
          </Link>
        }
      />

      <div className="mb-8 flex flex-col items-center text-center">
        <div className="w-44 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] shadow-[var(--shadow-sm)] sm:w-52">
          <CourseCover
            coverPath={course.coverPath}
            title={course.title}
            className="aspect-[3/4] w-full"
          />
        </div>

        <div className="mt-4 w-full max-w-lg space-y-2">
          <h2 className="text-lg font-bold leading-8">{course.title}</h2>
          {description ? (
            <p className="text-sm leading-7 text-[var(--muted-foreground)]">{description}</p>
          ) : null}
        </div>
      </div>

      <h2 className="mb-3 text-base font-bold">درس‌ها</h2>
      {lessons.length === 0 ? (
        <EmptyState title="درسی نیست" description="هنوز درسی برای این دوره ثبت نشده است." />
      ) : (
        <ul className="space-y-2">
          {lessons.map((l, index) => (
            <li key={l.id}>
              <Link
                href={`/student/school/lessons/${l.id}`}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)]/40 px-4 py-3 text-sm transition-opacity hover:opacity-90"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--card)] text-xs font-bold text-[var(--brand)]">
                  {toFaDigits(index + 1)}
                </span>
                <span className="min-w-0 flex-1 text-start font-medium">{l.title}</span>
                <ChevronLeft
                  className="size-4 shrink-0 text-[var(--muted-foreground)]"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StudentShell>
  );
}
