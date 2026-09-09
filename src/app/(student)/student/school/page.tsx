import Link from "next/link";
import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { StatPillCard } from "@/components/patterns/stat-pill-card";
import { CourseCover } from "@/components/patterns/course-cover";
import { EmptyState } from "@/components/patterns/empty-state";
import { COURSE_STATUS, ROLE_KEYS } from "@/lib/enums";
import { toFaDigits } from "@/lib/digits";
import { requireRole } from "@/server/auth/guards";
import {
  getCourseProgressForStudent,
  listCourses,
} from "@/server/modules/courses/service";
import { getStudentByUserId } from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function StudentSchoolPage() {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(user.id);
  const courses = listCourses().filter((c) => c.status === COURSE_STATUS.PUBLISHED);
  const totalLessons = courses.reduce((sum, c) => sum + c.lessonCount, 0);

  const progressRows = student
    ? courses.map((c) => getCourseProgressForStudent(student.id, c.id)!)
    : courses.map((c) => ({
        courseId: c.id,
        title: c.title,
        coverPath: c.coverPath,
        lessonCount: c.lessonCount,
        completedCount: 0,
        progressPercent: 0,
      }));

  const avg =
    progressRows.length === 0
      ? 0
      : Math.round(
          progressRows.reduce((s, p) => s + p.progressPercent, 0) / progressRows.length,
        );

  return (
    <StudentShell user={user} title="مدرسه">
      <PageHeader title="مدرسه" description="دوره‌ها و پیشرفت یادگیری" />

      <div className="mb-6 flex gap-3 overflow-x-auto pb-1">
        <StatPillCard label="دوره‌ها" value={courses.length} tone="teal" icon="🎓" />
        <StatPillCard label="درس‌ها" value={totalLessons} tone="blue" icon="📖" />
        <StatPillCard
          label="میانگین پیشرفت"
          value={`${avg}٪`}
          tone="orange"
          icon="↗"
          className="min-w-[8.5rem]"
        />
      </div>

      {courses.length === 0 ? (
        <EmptyState title="دوره‌ای نیست" description="به‌زودی دوره‌های آموزشی اینجا می‌آید." />
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-bold">دوره‌ها</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {courses.map((c) => {
              const progress = progressRows.find((p) => p.courseId === c.id);
              return (
                <Link
                  key={c.id}
                  href={`/student/school/courses/${c.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--brand-soft)]">
                    <CourseCover
                      coverPath={c.coverPath}
                      title={c.title}
                      className="size-full"
                    />
                    {progress && progress.progressPercent > 0 ? (
                      <span className="absolute bottom-2 start-2 rounded-lg bg-[var(--card)]/90 px-2 py-0.5 text-[10px] font-bold text-[var(--brand)] backdrop-blur-sm">
                        {toFaDigits(progress.progressPercent)}٪
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1 px-3 py-2.5 text-center">
                    <p className="line-clamp-2 text-sm font-bold leading-6 text-[var(--foreground)]">
                      {c.title}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">
                      {toFaDigits(c.lessonCount)} درس
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </StudentShell>
  );
}
