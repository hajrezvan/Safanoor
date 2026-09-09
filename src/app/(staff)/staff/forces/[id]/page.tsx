import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { ProgressCourseRow } from "@/components/patterns/progress-course-row";
import { StatPillCard } from "@/components/patterns/stat-pill-card";
import { InfoFieldRow } from "@/components/patterns/info-field-row";
import { ProfileSectionCard } from "@/components/patterns/profile-section-card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  READING_PLAN_STATUS_TITLES_FA,
  ROLE_KEYS,
  STUDENT_STATUS_TITLES_FA,
} from "@/lib/enums";
import { formatDateFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import {
  aliveLabel,
  formatSiblingFa,
  parentsTogetherLabel,
  parseSiblingsJson,
} from "@/lib/siblings";
import { cn } from "@/lib/utils";
import { requireRole, AuthError } from "@/server/auth/guards";
import { canStaffAccessStudent } from "@/server/modules/students/service";
import { getForceDetail } from "@/server/modules/forces/service";
import { deleteForceAction } from "@/server/actions/students";

export const runtime = "nodejs";

export default async function ForceDetailPage({
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

  if (
    user.roleKey !== ROLE_KEYS.ADMIN &&
    !canStaffAccessStudent(user.id, user.roleKey, id)
  ) {
    throw new AuthError("این نیرو در محدوده شما نیست.");
  }

  const detail = getForceDetail(id);
  if (!detail) notFound();

  const { student, readingPlans, courses, examSubmissions, profile } = detail;
  const siblings = parseSiblingsJson(profile?.siblingsJson);
  const avatarSrc = profile?.avatarPath?.trim()
    ? profile.avatarPath.startsWith("http") || profile.avatarPath.startsWith("/")
      ? profile.avatarPath
      : `/uploads/${profile.avatarPath}`
    : null;

  return (
    <StaffShell user={user} title={student.fullName}>
      <PageHeader
        title={student.fullName}
        description={`${student.gradeTitleFa ?? ""} ${student.groupTitle ? `· ${student.groupTitle}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/staff/mentor/students/${student.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              پرونده کامل
            </Link>
            {user.roleKey !== ROLE_KEYS.ASSISTANT_MENTOR ? (
              <form action={deleteForceAction}>
                <input type="hidden" name="id" value={student.id} />
                <Button type="submit" variant="danger" size="sm">
                  غیرفعال‌سازی
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <StatPillCard
          label="وضعیت"
          value={STUDENT_STATUS_TITLES_FA[student.status] ?? student.status}
          tone="teal"
        />
        <StatPillCard label="برنامه مطالعه" value={readingPlans.length} tone="orange" />
        <StatPillCard label="پاسخ آزمون" value={examSubmissions.length} tone="blue" />
        <StatPillCard label="دوره‌ها" value={courses.length} tone="green" />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <ProfileSectionCard title="اطلاعات فردی" icon="👤">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-soft)] text-lg font-bold text-[var(--brand)]">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="size-full object-cover" />
              ) : (
                student.fullName.slice(0, 1)
              )}
            </div>
            <div>
              <p className="font-bold">{student.fullName}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {profile?.phone ? toFaDigits(profile.phone) : "بدون شماره"}
              </p>
            </div>
          </div>
          <InfoFieldRow>
            <span className="text-xs text-[var(--muted-foreground)]">تاریخ تولد</span>
            <p>{profile?.birthDate ? formatDateFa(profile.birthDate) : "—"}</p>
          </InfoFieldRow>
          <InfoFieldRow>
            <span className="text-xs text-[var(--muted-foreground)]">کد ملی</span>
            <p>{profile?.nationalId ? toFaDigits(profile.nationalId) : "—"}</p>
          </InfoFieldRow>
          <InfoFieldRow>
            <span className="text-xs text-[var(--muted-foreground)]">آدرس</span>
            <p>{profile?.address ? toFaDigits(profile.address) : "—"}</p>
          </InfoFieldRow>
        </ProfileSectionCard>

        <ProfileSectionCard title="خانواده" icon="⌂" accent="orange">
          <InfoFieldRow accent="orange">
            <span className="text-xs text-[var(--muted-foreground)]">نام / شغل پدر</span>
            <p>
              {profile?.fatherName ?? "—"}
              {profile?.fatherJob ? ` · ${profile.fatherJob}` : ""}
            </p>
          </InfoFieldRow>
          <InfoFieldRow accent="orange">
            <span className="text-xs text-[var(--muted-foreground)]">تاریخ تولد پدر</span>
            <p>{profile?.fatherBirthDate ? formatDateFa(profile.fatherBirthDate) : "—"}</p>
          </InfoFieldRow>
          <InfoFieldRow accent="orange">
            <span className="text-xs text-[var(--muted-foreground)]">شغل مادر</span>
            <p>{profile?.motherJob ?? "—"}</p>
          </InfoFieldRow>
          <InfoFieldRow accent="orange">
            <span className="text-xs text-[var(--muted-foreground)]">وضعیت والدین</span>
            <p>
              پدر {aliveLabel(profile?.fatherAlive)} · مادر {aliveLabel(profile?.motherAlive)} ·{" "}
              {parentsTogetherLabel(profile?.parentsLiveTogether)}
            </p>
          </InfoFieldRow>
          <InfoFieldRow accent="orange">
            <span className="text-xs text-[var(--muted-foreground)]">
              خواهر و برادر ({toFaDigits(siblings.length)} نفر)
            </span>
            {siblings.length === 0 ? (
              <p>—</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {siblings.map((s, i) => (
                  <li key={i}>{formatSiblingFa(s)}</li>
                ))}
              </ul>
            )}
          </InfoFieldRow>
        </ProfileSectionCard>
      </div>

      {profile?.overallNote ? (
        <p className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-7">
          {profile.overallNote}
        </p>
      ) : null}

      <h2 className="mb-3 text-base font-bold">پیشرفت کلاس‌ها</h2>
      <div className="mb-8 space-y-3">
        {courses.map((c) => (
          <ProgressCourseRow
            key={c.id}
            title={c.title}
            href={`/staff/classes/${c.id}`}
            progress={c.progressPercent}
            meta={`${c.lessonCount} درس`}
          />
        ))}
        {courses.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">دوره‌ای نیست.</p>
        ) : null}
      </div>

      <h2 className="mb-3 text-base font-bold">برنامه‌های مطالعاتی</h2>
      <div className="mb-8 space-y-3">
        {readingPlans.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
          >
            <p className="text-sm font-bold">{p.bookTitle}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {READING_PLAN_STATUS_TITLES_FA[p.status] ?? p.status} — {toFaDigits(p.progress)}٪
            </p>
          </div>
        ))}
        {readingPlans.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">برنامه مطالعاتی نیست.</p>
        ) : null}
      </div>

      <h2 className="mb-3 text-base font-bold">آزمون‌ها</h2>
      <div className="space-y-3">
        {examSubmissions.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
          >
            <p className="text-sm font-bold">{s.examTitle}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {s.status}
              {s.score != null ? ` — نمره ${toFaDigits(s.score)}` : ""}
            </p>
          </div>
        ))}
        {examSubmissions.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">پاسخی ثبت نشده.</p>
        ) : null}
      </div>
    </StaffShell>
  );
}
