import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { StudentShell } from "@/components/patterns/student-shell";
import { SchoolNav } from "@/components/school/nav";
import { SchoolForm } from "@/components/school/form";
import { SchoolCourseGrid } from "@/components/school/course-grid";
import { SchoolComments } from "@/components/school/comments";
import { Panel } from "@/components/school/shared";
import { CourseCover } from "@/components/patterns/course-cover";
import { requireUser } from "@/server/auth/guards";
import * as school from "@/server/modules/school/service";
import { isLessonCompletedByStudent, listChapters, listPrerequisites } from "@/server/modules/courses/service";
import { toFaDigits } from "@/lib/digits";
export const runtime = "nodejs";
export default async function StudentCourse({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser(); const student = school.studentFor(actor); const { id } = await params;
  let course; try { course = school.courseAccess(student.id, id); } catch { notFound(); }
  const joined = school.enrollment(student.id, id); const enrolled = joined && joined.status !== "cancelled";
  const lessons = school.publishedLessons(id); const progress = school.courseProgress(student.id, id);
  const chapters = listChapters(id).filter(c => c.status === "published");
  const prerequisites = listPrerequisites(id);
  const exams = db.select().from(s.schoolExams).where(and(eq(s.schoolExams.courseId, id), eq(s.schoolExams.status, "published"))).all();
  return <StudentShell user={actor} title={course.title}><SchoolNav /><div className="mb-7 grid gap-6 sm:grid-cols-[180px_1fr]"><CourseCover coverPath={course.coverPath} title={course.title} className="aspect-[3/4] w-full max-w-48 rounded-2xl" /><div className="space-y-4"><h1 className="text-2xl font-bold leading-10">{course.title}</h1><p className="whitespace-pre-wrap text-sm leading-8 text-[var(--muted-foreground)]">{course.description}</p>{!course.isGroup && <p className="text-sm">{toFaDigits(lessons.length)} درس · {toFaDigits(lessons.reduce((n, l) => n + l.durationMinutes, 0))} دقیقه</p>}{prerequisites.length > 0 && <p className="text-sm">پیش‌نیاز: {prerequisites.map(p => p.title).join("، ")}</p>}{!course.isGroup && (enrolled ? <div><p className="mb-2 text-sm">{toFaDigits(progress.completed)} از {toFaDigits(progress.total)} درس تکمیل‌شده</p><progress value={progress.percent} max={100} className="w-full accent-[var(--brand)]" /></div> : <SchoolForm operation="enroll" hidden={{ courseId: id }} submit="ثبت‌نام در دوره" />)}</div></div>
    {course.isGroup ? <SchoolCourseGrid courses={school.catalog(student.id).filter(c => c.parentCourseId === id)} /> : <>{[...chapters.map(c => ({ id: c.id, title: c.title })), { id: null, title: "درس‌ها" }].map(ch => {
      const rows = lessons.filter(l => l.chapterId === ch.id); if (!rows.length) return null;
      return <Panel key={ch.id ?? "other"} title={ch.title}>{rows.map(l => <div key={l.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-4"><div><p className="font-medium">{l.title}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{l.durationMinutes ? `${toFaDigits(l.durationMinutes)} دقیقه · ` : ""}{isLessonCompletedByStudent(student.id, l.id) ? "تکمیل‌شده ✓" : l.isPreview ? "پیش‌نمایش رایگان" : ""}</p></div>{enrolled || l.isPreview ? <Link className="text-sm text-[var(--brand)]" href={`/student/school/lessons/${l.id}`}>مشاهده ←</Link> : <span className="text-xs text-[var(--muted-foreground)]">نیاز به ثبت‌نام</span>}</div>)}</Panel>;
    })}{!lessons.length && <Panel title="درس‌ها">هنوز درسی منتشر نشده است.</Panel>}{exams.length > 0 && <Panel title="آزمون‌های دوره">{exams.map(e => <Link className="flex justify-between border-b border-[var(--border)] py-4" key={e.id} href={`/student/school/exams/${e.id}`}><span>{e.title}</span><span className="text-xs">{toFaDigits(e.durationMinutes)} دقیقه · مشاهده شرایط ←</span></Link>)}</Panel>}</>}
    {db.select().from(s.schoolPresenters).where(eq(s.schoolPresenters.courseId, id)).all().map(p => <Panel key={p.id} title={p.name}><p className="text-sm leading-7">{p.bio}</p></Panel>)}
    {enrolled && <SchoolComments actor={actor} courseId={id} />}
  </StudentShell>;
}
