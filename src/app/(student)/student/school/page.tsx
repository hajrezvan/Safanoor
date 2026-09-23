import Link from "next/link";
import Image from "next/image";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { schoolBanners } from "@/db/schema";
import { requireUser } from "@/server/auth/guards";
import { studentFor, catalog, groupLeaderboard } from "@/server/modules/school/service";
import { StudentShell } from "@/components/patterns/student-shell";
import { SchoolNav } from "@/components/school/nav";
import { SchoolCourseGrid } from "@/components/school/course-grid";
import { Panel } from "@/components/school/shared";
import { toFaDigits } from "@/lib/digits";
export const runtime = "nodejs";
export default async function StudentSchoolPage() {
  const actor = await requireUser(); const student = studentFor(actor); const courses = catalog(student.id);
  const mine = courses.filter(c => c.enrollment && c.enrollment.status !== "cancelled");
  const ongoing = mine.filter(c => c.enrollment?.status !== "completed");
  const banners = db.select().from(schoolBanners).orderBy(asc(schoolBanners.ordering)).all();
  return <StudentShell user={actor} title="مدرسه"><SchoolNav /><div className="mb-6 rounded-3xl bg-gradient-to-l from-teal-800 to-slate-900 p-7 text-white"><p className="text-sm opacity-75">فضای آموزشی شما</p><h1 className="mt-2 text-2xl font-bold">مدرسه صفا نور</h1><p className="mt-3 text-sm leading-7">یاد بگیر، تمرین کن و مسیر رشدت را ادامه بده.</p></div>{banners.length > 0 && <div className="mb-6 grid gap-3 sm:grid-cols-2">{banners.map(b => <a key={b.id} href={b.href || undefined} className="relative block aspect-[3/1] overflow-hidden rounded-2xl"><Image src={b.image} alt={b.title} fill unoptimized className="object-cover" /></a>)}</div>}<div className="grid grid-cols-3 gap-3">{[["دوره‌های من", mine.length], ["تکمیل‌شده", mine.length - ongoing.length], ["درس‌های گذرانده", mine.reduce((n, c) => n + c.progress.completed, 0)]].map(([label, value]) => <Panel key={label} title={String(label)}><p className="text-2xl font-bold text-[var(--brand)]">{toFaDigits(value)}</p></Panel>)}</div>{ongoing.length > 0 && <section className="mb-8"><h2 className="mb-4 font-bold">ادامه یادگیری</h2><SchoolCourseGrid courses={ongoing} /></section>}<section><div className="mb-4 flex justify-between"><h2 className="font-bold">دوره‌های مدرسه</h2><Link href="/student/school/catalog" className="text-sm text-[var(--brand)]">تمام دوره‌ها ←</Link></div><SchoolCourseGrid courses={courses.filter(c => !c.parentCourseId)} /></section><div className="mt-7"><Panel title="برترین‌های گروه شما">{groupLeaderboard(actor).map((row, index) => <p key={row.id} className="flex justify-between border-b border-[var(--border)] py-3 text-sm"><span>{toFaDigits(index + 1)}. {row.name}{row.isMe ? " (شما)" : ""}</span><span>{toFaDigits(row.points)} امتیاز آزمون</span></p>)}</Panel></div></StudentShell>;
}
