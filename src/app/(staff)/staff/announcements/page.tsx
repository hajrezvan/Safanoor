import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ANNOUNCEMENT_AUDIENCE,
  ANNOUNCEMENT_STATUS,
  ROLE_KEYS,
} from "@/lib/enums";
import { formatDateTimeFa } from "@/lib/date";
import { requireRole } from "@/server/auth/guards";
import { listAnnouncements } from "@/server/modules/announcements/service";
import { listGrades } from "@/server/modules/grades/service";
import { listGroups } from "@/server/modules/groups/service";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  publishAnnouncementAction,
} from "@/server/actions/announcements";

export const runtime = "nodejs";

export default async function StaffAnnouncementsPage() {
  const user = await requireRole(ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  const items = listAnnouncements();
  const grades = listGrades();
  const groups = listGroups();

  async function createAction(formData: FormData) {
    "use server";
    await createAnnouncementAction({}, formData);
  }

  return (
    <StaffShell user={user} title="اطلاعیه‌ها">
      <PageHeader title="اطلاعیه‌ها" description="ارسال و مدیریت اطلاعیه‌های دانش‌آموزان" />

      <form
        action={createAction}
        className="mb-8 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
      >
        <Input name="title" placeholder="عنوان" required />
        <textarea
          name="body"
          required
          rows={4}
          placeholder="متن اطلاعیه"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            name="audience"
            className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
            defaultValue={ANNOUNCEMENT_AUDIENCE.ALL_STUDENTS}
          >
            <option value={ANNOUNCEMENT_AUDIENCE.ALL_STUDENTS}>همه دانش‌آموزان</option>
            <option value={ANNOUNCEMENT_AUDIENCE.GRADE}>پایه خاص</option>
            <option value={ANNOUNCEMENT_AUDIENCE.GROUP}>گروه خاص</option>
          </select>
          <select
            name="gradeId"
            className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
          >
            <option value="">پایه (اختیاری)</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.titleFa}
              </option>
            ))}
          </select>
          <select
            name="groupId"
            className="flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
          >
            <option value="">گروه (اختیاری)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <select
          name="status"
          className="flex h-10 w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
          defaultValue={ANNOUNCEMENT_STATUS.PUBLISHED}
        >
          <option value={ANNOUNCEMENT_STATUS.DRAFT}>پیش‌نویس</option>
          <option value={ANNOUNCEMENT_STATUS.PUBLISHED}>منتشر</option>
        </select>
        <Button type="submit">ثبت اطلاعیه</Button>
      </form>

      <div className="space-y-3">
        {items.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{a.title}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {a.status} · {a.authorName}
                  {a.publishedAt ? ` · ${formatDateTimeFa(a.publishedAt)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {a.status !== ANNOUNCEMENT_STATUS.PUBLISHED ? (
                  <form action={publishAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      انتشار
                    </Button>
                  </form>
                ) : null}
                <form action={deleteAnnouncementAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <Button type="submit" size="sm" variant="outline">
                    حذف
                  </Button>
                </form>
              </div>
            </div>
            <p className="text-sm leading-7 whitespace-pre-wrap">{a.body}</p>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">اطلاعیه‌ای نیست.</p>
        ) : null}
      </div>
    </StaffShell>
  );
}
