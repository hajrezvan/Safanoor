import Link from "next/link";
import { BookOpen } from "lucide-react";
import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { ROLE_KEYS } from "@/lib/enums";
import { toFaDigits } from "@/lib/digits";
import { requireRole } from "@/server/auth/guards";
import { getStudentByUserId } from "@/server/modules/students/service";
import { listReadingPlansForStudent } from "@/server/modules/books/service";

export const runtime = "nodejs";

function coverSrc(coverPath: string | null | undefined) {
  if (!coverPath?.trim()) return null;
  if (coverPath.startsWith("http") || coverPath.startsWith("/")) return coverPath;
  return `/uploads/${coverPath}`;
}

export default async function StudentLibraryPage() {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(user.id);
  const plans = student ? listReadingPlansForStudent(student.id) : [];

  return (
    <StudentShell user={user} title="کتابخانه">
      <PageHeader title="کتابخانه" description="کتاب‌های برنامهٔ مطالعهٔ شما" />

      {!student ? (
        <EmptyState title="پرونده یافت نشد" description="پرونده دانش‌آموزی شما ثبت نشده است." />
      ) : plans.length === 0 ? (
        <EmptyState
          title="کتابی نیست"
          description="هنوز برنامه مطالعاتی برای شما ثبت نشده است."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {plans.map((plan) => {
            const src = coverSrc(plan.coverPath);
            return (
              <Link
                key={plan.id}
                href={`/student/library/${plan.bookId}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--brand-soft)]">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-[var(--brand)]">
                      <BookOpen className="size-12 opacity-80" aria-hidden />
                    </div>
                  )}
                  {plan.progress > 0 ? (
                    <span className="absolute bottom-2 start-2 rounded-lg bg-[var(--card)]/90 px-2 py-0.5 text-[10px] font-bold text-[var(--brand)] backdrop-blur-sm">
                      {toFaDigits(plan.progress)}٪
                    </span>
                  ) : null}
                </div>
                <p className="line-clamp-2 px-3 py-2.5 text-center text-sm font-bold leading-6 text-[var(--foreground)]">
                  {plan.bookTitle}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}
