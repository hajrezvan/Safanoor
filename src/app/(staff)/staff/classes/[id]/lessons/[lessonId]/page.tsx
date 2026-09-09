import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { LessonMedia } from "@/components/learning/lesson-media";
import { buttonVariants } from "@/components/ui/button";
import { LESSON_CONTENT_TYPE_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { getLessonById } from "@/server/modules/courses/service";

export const runtime = "nodejs";

export default async function StaffLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );
  const { id, lessonId } = await params;
  const lesson = getLessonById(lessonId);
  if (!lesson || lesson.courseId !== id) notFound();

  return (
    <StaffShell user={user} title={lesson.title}>
      <PageHeader
        title={lesson.title}
        description={`${lesson.courseTitle} · ${LESSON_CONTENT_TYPE_TITLES_FA[lesson.contentType] ?? lesson.contentType}`}
        actions={
          <Link
            href={`/staff/classes/${id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            بازگشت به کلاس
          </Link>
        }
      />

      {lesson.description ? (
        <p className="mb-4 text-sm leading-7 text-[var(--muted-foreground)]">
          {lesson.description}
        </p>
      ) : null}

      <LessonMedia
        contentType={lesson.contentType}
        body={lesson.body}
        url={lesson.url}
        filePath={lesson.filePath}
        title={lesson.title}
      />
    </StaffShell>
  );
}
