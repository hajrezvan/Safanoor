import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { requireUser } from "@/server/auth/guards";
import * as school from "@/server/modules/school/service";
import { StudentShell } from "@/components/patterns/student-shell";
import { SchoolNav } from "@/components/school/nav";
import { SchoolCourseGrid } from "@/components/school/course-grid";
import { Panel, statusLabels } from "@/components/school/shared";
import { toFaDigits } from "@/lib/digits";
export const runtime = "nodejs";
export default async function StudentSchoolSection({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ search?: string; id?: string; number?: string }> }) {
  const actor = await requireUser(); const student = school.studentFor(actor); const { section } = await params; const query = await searchParams;
  let content: React.ReactNode;
  if (section === "catalog") {
    content = <><form className="mb-5 flex gap-3"><input aria-label="جست‌وجوی دوره" name="search" defaultValue={query.search} placeholder="نام دوره را جست‌وجو کنید" className="w-full rounded-xl border border-[var(--border)] p-3" /><button className="rounded-xl bg-[var(--brand)] px-5 text-white">جست‌وجو</button></form><SchoolCourseGrid courses={school.catalog(student.id).filter(c => !query.search || c.title.includes(query.search))} /></>;
  } else if (section === "report") {
    const attempts = db.select().from(s.schoolAttempts).where(eq(s.schoolAttempts.studentId, student.id)).all();
    content = <><Panel title="پیشرفت دوره‌ها"><SchoolCourseGrid courses={school.myEnrollments(actor)} /></Panel><Panel title="نتایج آزمون‌ها">{attempts.map(a => { const view = school.studentAttempt(actor, a.id); return <Link className="flex justify-between border-b border-[var(--border)] py-4" key={a.id} href={`/student/school/exams/${a.examId}?attempt=${a.id}`}><span>{view.title}</span><span>{statusLabels[view.status]} · {view.score === null ? "—" : `${toFaDigits(view.score)}٪`}</span></Link>; })}{!attempts.length && <p>هنوز در آزمونی شرکت نکرده‌اید.</p>}</Panel></>;
  } else if (section === "certificates") {
    const certificates = school.myCertificates(actor);
    content = <Panel title="گواهینامه‌های من">{certificates.map(c => <div className="flex items-center justify-between border-b border-[var(--border)] py-4" key={c.id}><p>{c.courseTitle}</p><Link className="text-[var(--brand)]" href={`/certificate/${c.number}`}>مشاهده و چاپ گواهی ←</Link></div>)}{!certificates.length && <p className="text-sm leading-7">پس از تکمیل درس‌های دوره و قبولی در آزمون‌ها، گواهی شما اینجا نمایش داده می‌شود.</p>}</Panel>;
  } else if (section === "verify") {
    const certificate = query.number ? school.certificateByNumber(query.number.trim()) : null;
    content = <Panel title="تأیید اصالت گواهینامه"><form className="flex gap-3"><input aria-label="شماره گواهی" name="number" defaultValue={query.number} required className="w-full rounded-xl border border-[var(--border)] p-3" placeholder="شماره گواهینامه" /><button className="rounded-xl bg-[var(--brand)] px-5 text-white">بررسی</button></form>{query.number && (certificate ? <div className="mt-4 leading-8"><p>گواهی معتبر است.</p><p>{certificate.studentName} — {certificate.courseTitle}</p><Link href={`/certificate/${certificate.number}`}>مشاهده گواهی</Link></div> : <p role="alert" className="mt-4">گواهی معتبر یافت نشد.</p>)}</Panel>;
  } else if (section === "playlists") {
    const playlists = db.select().from(s.schoolPlaylists).where(eq(s.schoolPlaylists.status, "published")).orderBy(asc(s.schoolPlaylists.ordering)).all();
    const selected = playlists.find(p => p.id === query.id);
    if (query.id && !selected) notFound();
    content = <><Panel title="محتوای منتخب"><div className="grid gap-3 sm:grid-cols-2">{playlists.map(p => <Link key={p.id} href={`/student/school/playlists?id=${p.id}`} className="rounded-2xl bg-[var(--muted)] p-5"><h2 className="font-bold">{p.title}</h2><p className="mt-2 text-sm leading-7">{p.description}</p></Link>)}</div>{!playlists.length && <p>محتوای منتخبی منتشر نشده است.</p>}</Panel>{selected && <Panel title={selected.title}>{db.select().from(s.schoolPlaylistLessons).where(eq(s.schoolPlaylistLessons.playlistId, selected.id)).orderBy(asc(s.schoolPlaylistLessons.ordering)).all().map(item => {
      const lesson = db.select().from(s.lessons).where(eq(s.lessons.id, item.lessonId)).get();
      if (!lesson) return null;
      try { school.courseAccess(student.id, lesson.courseId); } catch { return null; }
      if (!school.publishedLessons(lesson.courseId).some(l => l.id === lesson.id)) return null;
      const joined = school.enrollment(student.id, lesson.courseId);
      const unlocked = lesson.courseId === "school_standalone" || lesson.isPreview || (joined && joined.status !== "cancelled");
      return <Link className="flex justify-between border-b border-[var(--border)] py-4" key={item.id} href={unlocked ? `/student/school/lessons/${lesson.id}` : `/student/school/courses/${lesson.courseId}`}><span>{lesson.title}</span><span className="text-xs">{unlocked ? "مشاهده درس ←" : "ثبت‌نام در دوره"}</span></Link>;
    })}</Panel>}</>;
  } else notFound();
  return <StudentShell user={actor} title="مدرسه"><SchoolNav />{content}</StudentShell>;
}
