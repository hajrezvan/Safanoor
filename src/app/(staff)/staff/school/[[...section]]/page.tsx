import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { requireUser } from "@/server/auth/guards";
import * as school from "@/server/modules/school/service";
import { listStudentsForStaff } from "@/server/modules/students/service";
import {
  getCourseById,
  getLessonById,
  listChapters,
  listCourses,
} from "@/server/modules/courses/service";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { CourseForm } from "@/components/learning/course-form";
import { SchoolForm, type Field } from "@/components/school/form";
import { SchoolNav } from "@/components/school/nav";
import {
  Panel,
  statusField,
  orderField,
  statusLabels,
} from "@/components/school/shared";
import { toFaDigits } from "@/lib/digits";
import { LESSON_CONTENT_TYPE_TITLES_FA } from "@/lib/enums";

export const runtime = "nodejs";
const href = (section: string, id?: string) =>
  `/staff/school/${section}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
const select = (
  name: string,
  label: string,
  rows: { id: string; title: string }[],
  value = "",
  required = true,
): Field => ({
  name,
  label,
  type: "select",
  options: rows.map((r) => ({ value: r.id, label: r.title })),
  value,
  required,
});
const titleField: Field = { name: "title", label: "عنوان", required: true };

export default async function SchoolManagement({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ id?: string; search?: string }>;
}) {
  const actor = await requireUser();
  school.manager(actor);
  const { section = [] } = await params;
  const query = await searchParams;
  const tab = section[0] ?? "";
  if (
    section.length > 1 ||
    ![
      "",
      "courses",
      "lessons",
      "playlists",
      "exams",
      "banks",
      "comments",
      "enrollments",
      "reports",
      "certificates",
      "settings",
    ].includes(tab)
  )
    notFound();
  const courses = listCourses().filter((c) => !c.isStandaloneCollection);
  const lessons = db
    .select()
    .from(s.lessons)
    .orderBy(asc(s.lessons.ordering))
    .all();
  const banks = db.select().from(s.schoolBanks).all();
  const exams = db.select().from(s.schoolExams).all();
  const students = listStudentsForStaff(actor.id, actor.roleKey);
  let content: React.ReactNode;

  if (tab === "") {
    const enrollments = school.scopedEnrollments(actor);
    const attempts = school.scopedAttempts(actor);
    content = (
      <>
        <div className="mb-6 rounded-3xl bg-gradient-to-l from-teal-800 to-slate-900 p-8 text-white">
          <p className="mb-2 text-sm opacity-75">بخش آموزش</p>
          <h2 className="text-2xl font-bold">مدرسه صفا نور</h2>
          <p className="mt-3 text-sm leading-7 opacity-90">
            مدیریت آموزش، آزمون‌ها و پیشرفت متربیان
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            [
              "دوره‌های منتشر",
              courses.filter((c) => c.status === "published").length,
            ],
            ["ثبت‌نام‌های متربیان شما", enrollments.length],
            [
              "دوره‌های تکمیل‌شده",
              enrollments.filter((e) => e.status === "completed").length,
            ],
            [
              "آزمون‌های تکمیل‌شده",
              attempts.filter((a) => a.status === "graded").length,
            ],
          ].map(([label, value]) => (
            <Panel key={label} title={String(label)}>
              <p className="text-3xl font-bold text-[var(--brand)]">
                {toFaDigits(value)}
              </p>
            </Panel>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["courses", "ساخت و مدیریت دوره"],
            ["exams", "طراحی آزمون"],
            ["banks", "بانک سؤال"],
            ["enrollments", "ثبت‌نام متربیان"],
            ["playlists", "محتوای منتخب"],
            ["reports", "گزارش پیشرفت"],
          ].map(([path, title]) => (
            <Link
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 font-bold"
              key={path}
              href={href(path)}
            >
              {title} ←
            </Link>
          ))}
        </div>
      </>
    );
  } else if (tab === "courses") {
    const course = query.id ? getCourseById(query.id) : undefined;
    if (query.id && !course) notFound();
    content = (
      <>
        <Panel title="دوره‌ها">
          <Link href={href("courses")} className="text-[var(--brand)]">
            + دوره جدید
          </Link>
          <div className="mt-4 space-y-2">
            {courses.map((c) => (
              <Link
                className="flex justify-between rounded-xl bg-[var(--muted)] p-3"
                key={c.id}
                href={href("courses", c.id)}
              >
                <span>{c.title}</span>
                <span className="text-xs">
                  {statusLabels[c.status] ?? c.status} ·{" "}
                  {toFaDigits(c.lessonCount)} درس
                </span>
              </Link>
            ))}
          </div>
        </Panel>
        <CourseForm key={course?.id ?? "new"} course={course} />
        {course && (
          <div className="mt-5">
            <Panel title="تنظیمات دوره">
              <SchoolForm
                operation="course-settings"
                hidden={{ courseId: course.id }}
                fields={[
                  {
                    name: "isPublic",
                    label: "ثبت‌نام آزاد برای متربیان",
                    type: "checkbox",
                    value: course.isPublic,
                  },
                  {
                    name: "issueCertificate",
                    label: "صدور گواهی پس از تکمیل",
                    type: "checkbox",
                    value: course.issueCertificate,
                  },
                  {
                    name: "isGroup",
                    label: "گروه دوره (فقط شامل زیر‌دوره‌ها)",
                    type: "checkbox",
                    value: course.isGroup,
                  },
                  select(
                    "parentCourseId",
                    "گروه والد",
                    courses.filter((c) => c.isGroup && c.id !== course.id),
                    course.parentCourseId ?? "",
                    false,
                  ),
                ]}
              />
            </Panel>
            <Panel title="فصل‌ها">
              {listChapters(course.id).map((ch) => (
                <details
                  className="mb-3 rounded-xl border border-[var(--border)] p-3"
                  key={ch.id}
                >
                  <summary>{ch.title}</summary>
                  <SchoolForm
                    operation="chapter"
                    hidden={{ id: ch.id, courseId: course.id }}
                    fields={[
                      { ...titleField, value: ch.title },
                      { ...orderField, value: ch.ordering },
                      statusField(ch.status),
                    ]}
                  />
                </details>
              ))}
              <SchoolForm
                operation="chapter"
                hidden={{ courseId: course.id }}
                fields={[titleField, orderField, statusField()]}
                submit="افزودن فصل"
              />
            </Panel>
            <Panel title="مدرسان">
              {db
                .select()
                .from(s.schoolPresenters)
                .where(eq(s.schoolPresenters.courseId, course.id))
                .all()
                .map((p) => (
                  <div key={p.id} className="mb-3 flex justify-between">
                    <p>
                      {p.name} — {p.bio}
                    </p>
                    <SchoolForm
                      operation="presenter-remove"
                      hidden={{ id: p.id }}
                      submit="حذف"
                    />
                  </div>
                ))}
              <SchoolForm
                operation="presenter"
                hidden={{ courseId: course.id }}
                fields={[
                  { ...titleField, label: "نام مدرس" },
                  { name: "bio", label: "معرفی مدرس", type: "textarea" },
                ]}
                submit="افزودن مدرس"
              />
            </Panel>
            <Link className="text-[var(--brand)]" href={href("lessons")}>
              مدیریت دروس ←
            </Link>{" "}
            ·{" "}
            <Link href={`/staff/classes/${course.id}`}>
              پیش‌نیازها و نمای دوره
            </Link>
          </div>
        )}
      </>
    );
  } else if (tab === "lessons") {
    const lesson = query.id ? getLessonById(query.id) : undefined;
    const metadata = lessons.find((l) => l.id === query.id);
    if (query.id && !lesson) notFound();
    const chapters = db.select().from(s.courseChapters).all();
    content = (
      <>
        <Panel title="دروس">
          <Link href={href("lessons")} className="text-[var(--brand)]">
            + درس جدید
          </Link>
          <div className="mt-3 space-y-2">
            {lessons
              .filter((l) => !query.search || l.title.includes(query.search))
              .map((l) => (
                <Link
                  key={l.id}
                  className="flex justify-between rounded-xl bg-[var(--muted)] p-3"
                  href={href("lessons", l.id)}
                >
                  <span>{l.title}</span>
                  <span className="text-xs">
                    {courses.find((c) => c.id === l.courseId)?.title} ·{" "}
                    {statusLabels[l.status]}
                  </span>
                </Link>
              ))}
          </div>
        </Panel>
        <Panel title={lesson ? "ویرایش درس" : "درس جدید"}>
          <SchoolForm
            key={lesson?.id ?? "new"}
            operation="lesson"
            hidden={lesson ? { id: lesson.id } : {}}
            destination="/staff/school/lessons?id=:id"
            fields={[
              { ...titleField, value: lesson?.title },
              select(
                "courseId",
                "دوره",
                [
                  { id: "__standalone", title: "درس مستقل (محتوای منتخب)" },
                  ...courses.filter((c) => !c.isGroup),
                ],
                lesson?.courseId === "school_standalone"
                  ? "__standalone"
                  : lesson?.courseId,
              ),
              select(
                "chapterId",
                "فصل",
                chapters.map((c) => ({
                  id: c.id,
                  title: `${courses.find((r) => r.id === c.courseId)?.title} / ${c.title}`,
                })),
                lesson?.chapterId ?? "",
                false,
              ),
              {
                name: "contentType",
                label: "نوع محتوا",
                type: "select",
                options: Object.entries(LESSON_CONTENT_TYPE_TITLES_FA).map(
                  ([value, label]) => ({ value, label }),
                ),
                value: lesson?.contentType ?? "TEXT",
                required: true,
              },
              statusField(metadata?.status),
              { ...orderField, value: lesson?.ordering ?? 0 },
              {
                name: "description",
                label: "خلاصه",
                type: "textarea",
                value: lesson?.description,
              },
              {
                name: "body",
                label: "متن درس",
                type: "textarea",
                value: lesson?.body,
              },
              {
                name: "url",
                label: "آدرس ویدیو، صوت یا آپارات",
                type: "url",
                value: lesson?.url,
              },
              {
                name: "contentFile",
                label: "آپلود ویدیو / فایل / PDF (حداکثر ۲۰ مگابایت)",
                type: "file",
              },
              {
                name: "audioFile",
                label: "آپلود نسخه صوتی",
                type: "file",
                accept: ".mp3,.m4a,.ogg",
              },
              {
                name: "filePath",
                label: "آدرس فایل یا PDF",
                type: "url",
                value: lesson?.filePath,
              },
              {
                name: "audioUrl",
                label: "نسخه صوتی همراه",
                type: "url",
                value: metadata?.audioUrl,
              },
              {
                name: "durationMinutes",
                label: "مدت (دقیقه)",
                type: "number",
                min: 0,
                value: metadata?.durationMinutes ?? 0,
              },
              {
                name: "isPreview",
                label: "پیش‌نمایش بدون ثبت‌نام",
                type: "checkbox",
                value: metadata?.isPreview,
              },
            ]}
          />
        </Panel>
        {lesson && (
          <Panel title="پیوست‌های درس">
            {db
              .select()
              .from(s.schoolAttachments)
              .where(eq(s.schoolAttachments.lessonId, lesson.id))
              .all()
              .map((a) => (
                <div key={a.id} className="mb-3 flex justify-between">
                  <a href={a.url}>{a.title}</a>
                  <SchoolForm
                    operation="attachment-remove"
                    hidden={{ id: a.id }}
                    submit="حذف"
                  />
                </div>
              ))}
            <SchoolForm
              operation="attachment"
              hidden={{ lessonId: lesson.id }}
              fields={[
                titleField,
                { name: "url", label: "آدرس فایل", type: "url" },
                {
                  name: "attachmentFile",
                  label: "یا آپلود فایل",
                  type: "file",
                },
              ]}
              submit="افزودن پیوست"
            />
          </Panel>
        )}
      </>
    );
  } else if (tab === "banks") {
    const bank = banks.find((b) => b.id === query.id);
    content = (
      <>
        <Panel title="بانک‌های سؤال">
          <div className="mb-4 flex flex-wrap gap-3">
            {banks.map((b) => (
              <Link
                href={href("banks", b.id)}
                key={b.id}
                className="rounded-xl bg-[var(--muted)] p-3"
              >
                {b.title}
              </Link>
            ))}
          </div>
          <SchoolForm
            operation="bank"
            fields={[titleField]}
            submit="ساخت بانک"
            destination="/staff/school/banks?id=:id"
          />
        </Panel>
        {bank && (
          <>
            <Panel title={bank.title}>
              <SchoolForm
                operation="bank"
                hidden={{ id: bank.id }}
                fields={[{ ...titleField, value: bank.title }]}
              />
            </Panel>
            {[
              ...db
                .select()
                .from(s.schoolQuestions)
                .where(eq(s.schoolQuestions.bankId, bank.id))
                .all(),
              null,
            ].map((q, i) => (
              <Panel key={q?.id ?? i} title={q ? q.prompt : "سؤال جدید"}>
                <SchoolForm
                  operation="question"
                  hidden={{
                    bankId: bank.id,
                    type: "multiple_choice",
                    ...(q ? { id: q.id } : {}),
                  }}
                  fields={[
                    {
                      name: "prompt",
                      label: "متن سؤال",
                      type: "textarea",
                      value: q?.prompt,
                      required: true,
                    },
                    {
                      name: "points",
                      label: "بارم",
                      type: "number",
                      min: 1,
                      max: 100,
                      value: q?.points ?? 1,
                    },
                    ...["A", "B", "C", "D"].map((k) => ({
                      name: `option${k}`,
                      label: `گزینه ${k}`,
                      value: q?.options.find((o) => o.key === k)?.text,
                    })),
                    {
                      name: "answer",
                      label: "گزینه صحیح",
                      type: "select",
                      required: true,
                      value: q?.answer ?? "A",
                      options: ["A", "B", "C", "D"].map((value) => ({
                        value,
                        label: value,
                      })),
                    },
                  ]}
                />
              </Panel>
            ))}
          </>
        )}
      </>
    );
  } else if (tab === "exams") {
    const exam = exams.find((e) => e.id === query.id);
    const scopes = [
      ...lessons.map((l) => ({ id: l.id, title: `درس: ${l.title}` })),
      ...db
        .select()
        .from(s.courseChapters)
        .all()
        .map((c) => ({ id: c.id, title: `فصل: ${c.title}` })),
    ];
    content = (
      <>
        <Panel title="آزمون‌ها">
          <Link href={href("exams")} className="text-[var(--brand)]">
            + آزمون جدید
          </Link>
          {exams.map((e) => (
            <Link
              key={e.id}
              href={href("exams", e.id)}
              className="mt-2 flex justify-between rounded-xl bg-[var(--muted)] p-3"
            >
              {e.title}
              <span>{statusLabels[e.status]}</span>
            </Link>
          ))}
        </Panel>
        <Panel title={exam ? "ویرایش آزمون" : "آزمون جدید"}>
          <SchoolForm
            key={exam?.id ?? "new"}
            operation="exam"
            hidden={exam ? { id: exam.id } : {}}
            destination="/staff/school/exams?id=:id"
            fields={[
              { ...titleField, value: exam?.title },
              select(
                "courseId",
                "دوره",
                [
                  {
                    id: "school_standalone",
                    title: "محتوای منتخب / درس مستقل",
                  },
                  ...courses.filter((c) => !c.isGroup),
                ],
                exam?.courseId,
              ),
              select("bankId", "بانک سؤال", banks, exam?.bankId),
              {
                name: "scope",
                label: "دامنه آزمون",
                type: "select",
                value: exam?.scope ?? "course",
                required: true,
                options: [
                  { value: "course", label: "کل دوره" },
                  { value: "section", label: "فصل" },
                  { value: "lesson", label: "درس" },
                ],
              },
              select(
                "scopeId",
                "درس یا فصل مرتبط",
                scopes,
                exam?.scopeId ?? "",
                false,
              ),
              {
                ...statusField(exam?.status),
                options: [
                  ...statusField().options!,
                  { value: "closed", label: "بسته" },
                ],
              },
              {
                name: "durationMinutes",
                label: "زمان (دقیقه)",
                type: "number",
                min: 1,
                max: 300,
                value: exam?.durationMinutes ?? 20,
              },
              {
                name: "passingPercent",
                label: "درصد قبولی",
                type: "number",
                min: 0,
                max: 100,
                value: exam?.passingPercent ?? 60,
              },
              {
                name: "passBonusPoints",
                label: "امتیاز یک‌باره قبولی",
                type: "number",
                min: 0,
                max: 100000,
                value: exam?.passBonusPoints ?? 10,
              },
              {
                name: "maxAttempts",
                label: "تعداد تلاش مجاز",
                type: "number",
                min: 1,
                max: 100,
                value: exam?.maxAttempts ?? 3,
              },
              {
                name: "questionCount",
                label: "تعداد سؤال تصادفی از بانک",
                type: "number",
                min: 1,
                max: 100,
                value: exam?.questionCount ?? 10,
                hint: "اگر بانک سؤال بزرگ‌تر باشد، در هر تلاش همین تعداد سؤال به‌صورت تصادفی انتخاب می‌شود.",
              },
              {
                name: "shuffleQuestions",
                label: "انتخاب و ترتیب تصادفی سؤال‌ها",
                type: "checkbox",
                value: exam?.shuffleQuestions ?? true,
              },
              {
                name: "shuffleOptions",
                label: "ترتیب تصادفی گزینه‌ها",
                type: "checkbox",
                value: exam?.shuffleOptions ?? true,
              },
              {
                name: "showAnswers",
                label: "نمایش پاسخ صحیح پس از اعلام نتیجه",
                type: "checkbox",
                value: exam?.showAnswers ?? false,
              },
              {
                name: "releaseResults",
                label: "انتشار نتایج تصحیح‌شده",
                type: "checkbox",
                value: exam?.releaseResults ?? true,
              },
            ]}
          />
        </Panel>
      </>
    );
  } else if (tab === "comments") {
    const comments = db
      .select({ comment: s.schoolComments, author: s.users.fullName })
      .from(s.schoolComments)
      .innerJoin(s.users, eq(s.users.id, s.schoolComments.authorId))
      .orderBy(desc(s.schoolComments.createdAt))
      .all();
    content = (
      <>
        {!comments.length && (
          <Panel title="نظرات">هنوز نظری ثبت نشده است.</Panel>
        )}
        {comments.map(({ comment: c, author }) => (
          <Panel key={c.id} title={`${author} — ${statusLabels[c.status]}`}>
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">
              {courses.find((r) => r.id === c.courseId)?.title}
              {c.parentId ? " · پاسخ به نظر" : ""}
            </p>
            <p className="mb-4 whitespace-pre-wrap leading-7">{c.body}</p>
            <SchoolForm
              operation="moderate"
              hidden={{ id: c.id }}
              fields={[
                {
                  name: "status",
                  label: "وضعیت",
                  type: "select",
                  value: c.status,
                  required: true,
                  options: ["pending", "approved", "rejected"].map((v) => ({
                    value: v,
                    label: statusLabels[v],
                  })),
                },
              ]}
            />
            <details className="mt-4">
              <summary>پاسخ مربی</summary>
              <SchoolForm
                operation="comment"
                hidden={{
                  courseId: c.courseId,
                  lessonId: c.lessonId ?? "",
                  parentId: c.id,
                }}
                fields={[
                  {
                    name: "body",
                    label: "پاسخ",
                    type: "textarea",
                    required: true,
                  },
                ]}
                submit="ثبت پاسخ"
              />
            </details>
          </Panel>
        ))}
      </>
    );
  } else if (tab === "enrollments" || tab === "reports") {
    const rows = school.scopedEnrollments(actor);
    content = (
      <>
        {tab === "enrollments" && (
          <Panel title="ثبت‌نام متربی در دوره">
            <SchoolForm
              operation="enroll"
              fields={[
                select(
                  "studentId",
                  "متربی",
                  students.map((s) => ({ id: s.id, title: s.fullName })),
                ),
                select(
                  "courseId",
                  "دوره",
                  courses.filter((c) => c.status === "published" && !c.isGroup),
                ),
              ]}
              submit="ثبت‌نام"
            />
          </Panel>
        )}
        <Panel title="پیشرفت متربیان تحت پوشش">
          <a
            className="mb-4 inline-block text-sm text-[var(--brand)]"
            href="/api/staff/school/reports"
          >
            دریافت گزارش CSV ↓
          </a>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr>
                  {["متربی", "دوره", "پیشرفت", "وضعیت", ""].map((t, i) => (
                    <th className="p-3 text-start" key={i}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--border)]">
                    <td className="p-3">{r.studentName}</td>
                    <td className="p-3">{r.course?.title}</td>
                    <td className="p-3">{toFaDigits(r.progress.percent)}٪</td>
                    <td className="p-3">{statusLabels[r.status]}</td>
                    <td className="p-3">
                      {tab === "enrollments" && (
                        <SchoolForm
                          operation="enrollment-status"
                          hidden={{
                            id: r.id,
                            status:
                              r.status === "cancelled" ? "active" : "cancelled",
                          }}
                          submit={
                            r.status === "cancelled"
                              ? "فعال‌سازی"
                              : "لغو ثبت‌نام"
                          }
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="p-3">ثبت‌نامی وجود ندارد.</p>}
          </div>
        </Panel>
        {tab === "reports" && (
          <Panel title="نتایج آزمون‌ها">
            {school.scopedAttempts(actor).map((a) => (
              <p key={a.id} className="border-b border-[var(--border)] py-3">
                {a.studentName} · {a.examTitle} · {statusLabels[a.status]} ·{" "}
                {a.score === null ? "—" : `${toFaDigits(a.score)}٪`}
              </p>
            ))}
          </Panel>
        )}
      </>
    );
  } else if (tab === "playlists") {
    const playlists = db
      .select()
      .from(s.schoolPlaylists)
      .orderBy(asc(s.schoolPlaylists.ordering))
      .all();
    const playlist = playlists.find((p) => p.id === query.id);
    const items = playlist
      ? db
          .select()
          .from(s.schoolPlaylistLessons)
          .where(eq(s.schoolPlaylistLessons.playlistId, playlist.id))
          .orderBy(asc(s.schoolPlaylistLessons.ordering))
          .all()
      : [];
    content = (
      <>
        <Panel title="محتوای منتخب">
          <Link href={href("playlists")}>+ فهرست جدید</Link>
          {playlists.map((p) => (
            <Link
              key={p.id}
              className="mt-2 block rounded-xl bg-[var(--muted)] p-3"
              href={href("playlists", p.id)}
            >
              {p.title} · {statusLabels[p.status]}
            </Link>
          ))}
        </Panel>
        <Panel title={playlist ? "ویرایش فهرست" : "فهرست جدید"}>
          <SchoolForm
            key={playlist?.id ?? "new"}
            operation="playlist"
            hidden={playlist ? { id: playlist.id } : {}}
            destination="/staff/school/playlists?id=:id"
            fields={[
              { ...titleField, value: playlist?.title },
              {
                name: "description",
                label: "توضیح",
                type: "textarea",
                value: playlist?.description,
              },
              {
                name: "cover",
                label: "آپلود کاور",
                type: "file",
                accept: "image/png,image/jpeg,image/webp,image/gif",
              },
              {
                name: "coverPath",
                label: "آدرس کاور",
                type: "url",
                value: playlist?.coverPath,
              },
              statusField(playlist?.status),
              { ...orderField, value: playlist?.ordering ?? 0 },
            ]}
          />
        </Panel>
        {playlist && (
          <Panel title="درس‌های فهرست">
            {items.map((item) => (
              <div
                key={item.id}
                className="mb-4 flex items-center justify-between gap-3"
              >
                <p>
                  {toFaDigits(item.ordering)}.{" "}
                  {lessons.find((l) => l.id === item.lessonId)?.title}
                </p>
                <SchoolForm
                  operation="playlist-remove"
                  hidden={{ id: item.id }}
                  submit="حذف از فهرست"
                />
              </div>
            ))}
            <SchoolForm
              operation="playlist-lesson"
              hidden={{ playlistId: playlist.id }}
              fields={[select("lessonId", "درس", lessons), orderField]}
              submit="افزودن / تغییر ترتیب درس"
            />
          </Panel>
        )}
      </>
    );
  } else if (tab === "certificates") {
    const ids = new Set(school.scopedEnrollments(actor).map((e) => e.id));
    const certificates = db
      .select()
      .from(s.schoolCertificates)
      .all()
      .filter((c) => ids.has(c.enrollmentId));
    content = (
      <Panel title="گواهی‌های متربیان">
        {certificates.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] py-4"
          >
            <p>
              {c.studentName} — {c.courseTitle} {c.revoked ? "(باطل‌شده)" : ""}
            </p>
            {!c.revoked && (
              <>
                <Link
                  href={`/certificate/${c.number}`}
                  className="text-[var(--brand)]"
                >
                  مشاهده و چاپ
                </Link>
                <SchoolForm
                  operation="revoke"
                  hidden={{ id: c.id }}
                  submit="ابطال گواهی"
                />
              </>
            )}
          </div>
        ))}
        {!certificates.length && (
          <p>پس از تکمیل درس‌ها و قبولی آزمون‌ها گواهی صادر می‌شود.</p>
        )}
      </Panel>
    );
  } else if (tab === "settings") {
    content = (
      <>
        {[
          ...db
            .select()
            .from(s.schoolBanners)
            .orderBy(asc(s.schoolBanners.ordering))
            .all(),
          null,
        ].map((b, i) => (
          <Panel key={b?.id ?? i} title={b ? b.title : "بنر جدید"}>
            <SchoolForm
              operation="banner"
              hidden={b ? { id: b.id } : {}}
              fields={[
                {
                  ...titleField,
                  label: "عنوان و متن جایگزین تصویر",
                  value: b?.title,
                },
                {
                  name: "image",
                  label: "آدرس تصویر",
                  type: "url",
                  value: b?.image,
                },
                {
                  name: "imageFile",
                  label: "یا آپلود تصویر بنر",
                  type: "file",
                  accept: "image/png,image/jpeg,image/webp,image/gif",
                },
                {
                  name: "href",
                  label: "پیوند مقصد",
                  type: "url",
                  value: b?.href,
                },
                { ...orderField, value: b?.ordering ?? 0 },
              ]}
            />
            {b && (
              <div className="mt-3">
                <SchoolForm
                  operation="banner-remove"
                  hidden={{ id: b.id }}
                  submit="حذف بنر"
                />
              </div>
            )}
          </Panel>
        ))}
      </>
    );
  } else notFound();
  return (
    <StaffShell user={actor} title="مدرسه">
      <PageHeader title="مدرسه" description="مدیریت آموزش و یادگیری متربیان" />
      <SchoolNav staff />
      {content}
    </StaffShell>
  );
}
