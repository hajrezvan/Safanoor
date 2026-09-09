import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { CourseCover } from "@/components/patterns/course-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COURSE_STATUS,
  COURSE_STATUS_TITLES_FA,
  LESSON_CONTENT_TYPE,
  LESSON_CONTENT_TYPE_TITLES_FA,
  ROLE_KEYS,
} from "@/lib/enums";
import { toFaDigits } from "@/lib/digits";
import { requireRole } from "@/server/auth/guards";
import {
  getCourseById,
  listChapters,
  listLessons,
  listPrerequisites,
} from "@/server/modules/courses/service";
import { listCourses } from "@/server/modules/courses/service";
import {
  createChapterAction,
  createLessonAction,
  setPrerequisiteAction,
  updateCourseAction,
} from "@/server/actions/courses";

export const runtime = "nodejs";

export default async function StaffClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );
  const { id } = await params;
  const course = getCourseById(id);
  if (!course) notFound();

  const chapters = listChapters(id);
  const lessons = listLessons(id);
  const prereqs = listPrerequisites(id);
  const allCourses = listCourses().filter((c) => c.id !== id);
  const canEdit = user.roleKey === ROLE_KEYS.ADMIN || user.roleKey === ROLE_KEYS.MENTOR;

  async function addChapter(formData: FormData) {
    "use server";
    await createChapterAction({}, formData);
  }
  async function addPrereq(formData: FormData) {
    "use server";
    await setPrerequisiteAction({}, formData);
  }
  async function addLesson(formData: FormData) {
    "use server";
    await createLessonAction({}, formData);
  }
  async function saveCourse(formData: FormData) {
    "use server";
    await updateCourseAction({}, formData);
  }

  return (
    <StaffShell user={user} title={course.title}>
      <PageHeader title={course.title} description={course.description ?? undefined} />

      <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <CourseCover
          coverPath={course.coverPath}
          title={course.title}
          className="aspect-[21/9] w-full"
        />
      </div>

      {prereqs.length > 0 ? (
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          پیش‌نیاز: {prereqs.map((p) => p.title).join("، ")}
        </p>
      ) : null}

      {canEdit ? (
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <form
            action={saveCourse}
            encType="multipart/form-data"
            className="space-y-2 rounded-2xl border border-[var(--border)] p-4 md:col-span-2"
          >
            <input type="hidden" name="id" value={id} />
            <p className="text-sm font-bold">ویرایش دوره و کاور</p>
            <Input name="title" defaultValue={course.title} placeholder="عنوان دوره" required />
            <Input
              name="description"
              defaultValue={course.description ?? ""}
              placeholder="توضیح دوره"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                name="coverPath"
                dir="ltr"
                defaultValue={course.coverPath ?? ""}
                placeholder="/covers/... یا URL"
              />
              <Input name="cover" type="file" accept="image/*" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                name="ordering"
                type="number"
                min={0}
                defaultValue={course.ordering}
                placeholder="ترتیب"
              />
              <select
                name="status"
                defaultValue={course.status}
                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
              >
                {Object.values(COURSE_STATUS).map((status) => (
                  <option key={status} value={status}>
                    {COURSE_STATUS_TITLES_FA[status]}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              آپلود فایل اولویت دارد؛ وگرنه مسیر/آدرس کاور ذخیره می‌شود.
            </p>
            <Button type="submit" size="sm">
              ذخیره دوره
            </Button>
          </form>
          <form action={addChapter} className="space-y-2 rounded-2xl border border-[var(--border)] p-4">
            <input type="hidden" name="courseId" value={id} />
            <p className="text-sm font-bold">فصل جدید</p>
            <Input name="title" placeholder="عنوان فصل" required />
            <Button type="submit" size="sm">
              افزودن فصل
            </Button>
          </form>
          <form action={addPrereq} className="space-y-2 rounded-2xl border border-[var(--border)] p-4">
            <input type="hidden" name="courseId" value={id} />
            <p className="text-sm font-bold">پیش‌نیاز</p>
            <select
              name="prerequisiteCourseId"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
              required
            >
              <option value="">انتخاب دوره</option>
              {allCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="secondary">
              ثبت پیش‌نیاز
            </Button>
          </form>
        </div>
      ) : null}

      {chapters.map((ch) => {
        const chapterLessons = lessons.filter((l) => l.chapterId === ch.id);
        return (
          <section key={ch.id} className="mb-8">
            <h2 className="mb-3 text-base font-bold">
              {toFaDigits(ch.ordering)}. {ch.title}
            </h2>
            <div className="space-y-2">
              {chapterLessons.map((l) => (
                <Link
                  key={l.id}
                  href={`/staff/classes/${id}/lessons/${l.id}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
                >
                  <span className="font-medium">{l.title}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {LESSON_CONTENT_TYPE_TITLES_FA[l.contentType] ?? l.contentType}
                  </span>
                </Link>
              ))}
            </div>
            {canEdit ? (
              <form
                action={addLesson}
                className="mt-3 grid gap-2 rounded-xl border border-dashed border-[var(--border)] p-3 md:grid-cols-2"
              >
                <input type="hidden" name="courseId" value={id} />
                <input type="hidden" name="chapterId" value={ch.id} />
                <Input name="title" placeholder="عنوان درس" required />
                <select
                  name="contentType"
                  className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                  defaultValue={LESSON_CONTENT_TYPE.TEXT}
                >
                  {Object.entries(LESSON_CONTENT_TYPE_TITLES_FA).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <Input name="body" placeholder="متن / توضیح" />
                <Input name="url" placeholder="آدرس یا آپارات / فایل" dir="ltr" />
                <Button type="submit" size="sm" className="md:col-span-2">
                  افزودن درس
                </Button>
              </form>
            ) : null}
          </section>
        );
      })}

      {lessons.filter((l) => !l.chapterId).length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-bold">درس‌های بدون فصل</h2>
          <div className="space-y-2">
            {lessons
              .filter((l) => !l.chapterId)
              .map((l) => (
                <Link
                  key={l.id}
                  href={`/staff/classes/${id}/lessons/${l.id}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
                >
                  <span className="font-medium">{l.title}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {LESSON_CONTENT_TYPE_TITLES_FA[l.contentType] ?? l.contentType}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ) : null}

      {chapters.length === 0 && lessons.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">هنوز فصل یا درسی نیست.</p>
      ) : null}
    </StaffShell>
  );
}
