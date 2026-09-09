import Link from "next/link";
import { EmptyState } from "@/components/patterns/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFa, formatDateTimeFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import { cn } from "@/lib/utils";
import {
  ACTION_STATUS_TITLES_FA,
  ACTION_TYPE,
  ACTIVITY_ASSIGNMENT_STATUS,
  ACTIVITY_ASSIGNMENT_STATUS_TITLES_FA,
  ACTIVITY_TYPE_TITLES_FA,
  ASSIGNMENT_ROLE,
  GOAL_STATUS,
  NOTE_VISIBILITY,
  NOTE_VISIBILITY_TITLES_FA,
  PLAN_STATUS,
  PRIORITY,
  STUDENT_STATUS_TITLES_FA,
  type ActivityAssignmentStatus,
  type ActivityType,
  type NoteVisibility,
} from "@/lib/enums";
import type { StudentListItem } from "@/server/modules/students/service";
import type { GrowthProfile } from "@/db/schema";
import { GrowthProfileForm } from "./growth-profile-form";
import type { Action, Goal, IndividualPlan, ReadingPlan } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createActionAction, createGoalAction, createPlanAction } from "@/server/actions/plans";
import { createNoteAction } from "@/server/actions/notes";
import type { MentoringSessionListItem } from "@/server/modules/sessions/service";
import type { MentorNoteListItem } from "@/server/modules/notes/service";
import type { ConversationListItem } from "@/server/modules/chat/service";
import type { ActivityAssignmentItem } from "@/server/modules/activities/service";
import type { AuditEventListItem } from "@/server/modules/audit/service";
import {
  AssignActivityForm,
  MentorFeedbackForm,
} from "@/components/activities/staff-activity-forms";
import {
  aliveLabel,
  formatSiblingFa,
  parentsTogetherLabel,
  parseSiblingsJson,
} from "@/lib/siblings";
import { InfoFieldRow } from "@/components/patterns/info-field-row";
import { ProfileSectionCard } from "@/components/patterns/profile-section-card";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "ایجاد",
  update: "به‌روزرسانی",
  assign: "تخصیص",
  clear: "حذف تخصیص",
  status_transition: "تغییر وضعیت اقدام",
  status_change: "تغییر وضعیت ارجاع",
  accept: "پذیرش پیشنهاد AI",
  accept_edited: "پذیرش ویرایش‌شده AI",
  reject: "رد پیشنهاد AI",
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  student: "دانش‌آموز",
  mentor_assignment: "تخصیص مربی",
  action: "اقدام",
  referral: "ارجاع",
  ai_interaction: "تعامل AI",
  user: "کاربر",
};

export const PROFILE_TABS = [
  { key: "overview", label: "نمای کلی" },
  { key: "goals", label: "اهداف" },
  { key: "plan", label: "برنامه" },
  { key: "sessions", label: "جلسات و چت" },
  { key: "actions", label: "اقدامات" },
  { key: "learning", label: "یادگیری" },
  { key: "activities", label: "فعالیت‌ها" },
  { key: "notes", label: "یادداشت‌ها" },
  { key: "history", label: "تاریخچه" },
] as const;

export type ProfileTabKey = (typeof PROFILE_TABS)[number]["key"];

export function isProfileTab(value: string | undefined): value is ProfileTabKey {
  return PROFILE_TABS.some((tab) => tab.key === value);
}

export type AssignmentHistoryItem = {
  id: string;
  assignmentRole: string;
  isActive: boolean;
  startedAt: string;
  endedAt: string | null;
  staffUserId: string;
  staffName: string;
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value?.trim() ? toFaDigits(value) : "—";
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] py-3 last:border-b-0">
      <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      <span className="text-sm leading-7">{display}</span>
    </div>
  );
}

function ProfileHeader({
  student,
  profile,
}: {
  student: StudentListItem;
  profile?: GrowthProfile;
}) {
  const facts: { label: string; value: string }[] = [
    { label: "پایه", value: student.gradeTitleFa ?? "—" },
    { label: "گروه", value: student.groupTitle ?? "—" },
    { label: "مربی", value: student.mentorName ?? "تخصیص نشده" },
    { label: "کمک‌مربی", value: student.assistantName ?? "تخصیص نشده" },
  ];

  const avatarSrc = profile?.avatarPath?.trim()
    ? profile.avatarPath.startsWith("http") || profile.avatarPath.startsWith("/")
      ? profile.avatarPath
      : `/uploads/${profile.avatarPath}`
    : null;

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-soft)] text-xl font-bold text-[var(--brand)]">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt={student.fullName} className="size-full object-cover" />
            ) : (
              student.fullName.slice(0, 1)
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{student.fullName}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {student.username ? `نام کاربری: ${student.username}` : "بدون حساب کاربری"}
            </p>
            {profile?.phone ? (
              <p className="text-sm text-[var(--muted-foreground)]">تماس: {toFaDigits(profile.phone)}</p>
            ) : null}
          </div>
        </div>
        <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
          {STUDENT_STATUS_TITLES_FA[student.status] ?? student.status}
        </span>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <dt className="text-xs text-[var(--muted-foreground)]">{fact.label}</dt>
            <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ProfileTabs({
  basePath,
  activeTab,
}: {
  basePath: string;
  activeTab: ProfileTabKey;
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
      {PROFILE_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "overview" ? basePath : `${basePath}?tab=${tab.key}`}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition-colors",
            tab.key === activeTab
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function HistoryTab({
  history,
  auditEvents,
}: {
  history: AssignmentHistoryItem[];
  auditEvents: AuditEventListItem[];
}) {
  const empty = history.length === 0 && auditEvents.length === 0;
  if (empty) {
    return (
      <EmptyState
        title="تاریخچه‌ای ثبت نشده"
        description="پس از تخصیص مربی یا تغییرات پرونده، رویدادها اینجا نمایش داده می‌شوند."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>تاریخچه تخصیص مربی‌ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">تخصیصی ثبت نشده است.</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.staffName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.assignmentRole === ASSIGNMENT_ROLE.MENTOR ? "مربی" : "کمک‌مربی"}
                  </p>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  از {formatDateFa(item.startedAt)}
                  {item.endedAt ? ` تا ${formatDateFa(item.endedAt)}` : " — تاکنون"}
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs",
                    item.isActive
                      ? "bg-[var(--success-soft,var(--muted))] text-[var(--foreground)]"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]",
                  )}
                >
                  {item.isActive ? "فعال" : "پایان‌یافته"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>رویدادهای حسابرسی</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditEvents.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              هنوز رویداد حسابرسی برای این پرونده ثبت نشده است.
            </p>
          ) : (
            auditEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {AUDIT_ENTITY_LABELS[event.entityType] ?? event.entityType}
                    {" — "}
                    {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                  </p>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {formatDateTimeFa(event.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  توسط {event.actorName ?? "کاربر سامانه"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivitiesTab({
  studentId,
  assignments,
  assignableActivities,
  canEdit,
}: {
  studentId: string;
  assignments: ActivityAssignmentItem[];
  assignableActivities: { id: string; title: string }[];
  canEdit: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>فعالیت‌ها و پروژه‌ها</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignments.length === 0 ? (
          <EmptyState
            title="فعالیتی محول نشده"
            description="می‌توانید از فهرست فعالیت‌های منتشرشده یک مورد را محول کنید."
          />
        ) : (
          assignments.map((item) => {
            const needsFeedback =
              canEdit && item.status === ACTIVITY_ASSIGNMENT_STATUS.SUBMITTED;

            return (
              <div key={item.id} className="rounded-lg border border-[var(--border)] p-3 text-sm leading-7">
                <p className="font-medium">{item.activityTitle}</p>
                <p className="text-[var(--muted-foreground)]">
                  {ACTIVITY_TYPE_TITLES_FA[item.activityType as ActivityType] ?? item.activityType}
                  {" — "}
                  {ACTIVITY_ASSIGNMENT_STATUS_TITLES_FA[
                    item.status as ActivityAssignmentStatus
                  ] ?? item.status}
                  {item.dueDate ? ` — مهلت ${formatDateFa(item.dueDate)}` : ""}
                </p>
                {item.result ? <p className="mt-2">گزارش: {item.result}</p> : null}
                {item.evidenceUrl ? (
                  <p>
                    شواهد:{" "}
                    <a href={item.evidenceUrl} className="underline" target="_blank" rel="noreferrer">
                      لینک
                    </a>
                  </p>
                ) : null}
                {item.evidenceFilePath ? (
                  <p>
                    فایل:{" "}
                    <a
                      href={item.evidenceFilePath}
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      مشاهده
                    </a>
                  </p>
                ) : null}
                {item.feedback || item.mentorFeedback ? (
                  <p className="mt-2 rounded-lg bg-[var(--muted)] p-2">
                    بازخورد: {item.feedback || item.mentorFeedback}
                  </p>
                ) : null}
                {needsFeedback && !item.feedback ? (
                  <MentorFeedbackForm assignmentId={item.id} />
                ) : null}
              </div>
            );
          })
        )}

        {canEdit ? (
          <div className="border-t border-[var(--border)] pt-4">
            <p className="mb-3 text-sm font-medium">محول کردن فعالیت</p>
            <AssignActivityForm studentId={studentId} activities={assignableActivities} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SessionsChatTab({
  sessions,
  chatSummary,
}: {
  sessions: MentoringSessionListItem[];
  chatSummary?: { activeConversation: ConversationListItem | null; messageCount: number };
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>جلسات مربی‌گری</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <EmptyState title="جلسه‌ای ثبت نشده" description="پس از ثبت جلسه، اینجا نمایش داده می‌شود." />
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <p className="text-sm font-medium">{session.type}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {formatDateFa(session.date)}
                  {session.staffName ? ` — ${session.staffName}` : ""}
                </p>
                {session.summary ? (
                  <p className="mt-2 text-sm leading-7">{session.summary}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>خلاصه چت پشتیبانی</CardTitle>
        </CardHeader>
        <CardContent>
          {chatSummary?.activeConversation ? (
            <div className="space-y-2 text-sm">
              <InfoRow label="وضعیت" value="فعال" />
              <InfoRow label="طرف گفتگو" value={chatSummary.activeConversation.staffName} />
              <InfoRow label="تعداد پیام" value={String(chatSummary.messageCount)} />
              <InfoRow
                label="آخرین پیام"
                value={
                  chatSummary.activeConversation.lastMessageAt
                    ? formatDateTimeFa(chatSummary.activeConversation.lastMessageAt)
                    : null
                }
              />
              {chatSummary.activeConversation.lastMessagePreview ? (
                <InfoRow label="پیش‌نمایش" value={chatSummary.activeConversation.lastMessagePreview} />
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="گفتگوی فعالی نیست"
              description="چت با پشتیبان تخصیص‌یافته اینجا خلاصه می‌شود."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotesTab({
  notes,
  studentId,
  canEdit,
  allowMentorOnly,
}: {
  notes: MentorNoteListItem[];
  studentId: string;
  canEdit: boolean;
  allowMentorOnly: boolean;
}) {
  async function submitNote(formData: FormData) {
    "use server";
    await createNoteAction({}, formData);
  }

  const visibilityOptions = [
    NOTE_VISIBILITY.PRIVATE_STAFF,
    NOTE_VISIBILITY.STUDENT_VISIBLE,
    ...(allowMentorOnly ? [NOTE_VISIBILITY.MENTOR_ONLY] : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>یادداشت‌ها</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.length === 0 ? (
          <EmptyState
            title="یادداشتی نیست"
            description="یادداشت‌های مجاز برای نقش شما اینجا دیده می‌شود."
          />
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {note.authorName} — {formatDateTimeFa(note.createdAt)}
                </span>
                <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px]">
                  {NOTE_VISIBILITY_TITLES_FA[note.visibility as NoteVisibility] ?? note.visibility}
                </span>
              </div>
              <p className="text-sm leading-7 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))
        )}

        {canEdit ? (
          <form action={submitNote} className="grid gap-2 border-t border-[var(--border)] pt-4">
            <input type="hidden" name="studentId" value={studentId} />
            <Input name="content" placeholder="متن یادداشت جدید" required />
            <div className="flex flex-wrap gap-2">
              <select
                name="visibility"
                defaultValue={NOTE_VISIBILITY.PRIVATE_STAFF}
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              >
                {visibilityOptions.map((key) => (
                  <option key={key} value={key}>
                    {NOTE_VISIBILITY_TITLES_FA[key]}
                  </option>
                ))}
              </select>
              <Input name="tags" placeholder="برچسب‌ها" className="max-w-xs" />
              <Button type="submit">ثبت یادداشت</Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StudentProfileView({
  student,
  profile,
  history,
  auditEvents = [],
  activeTab,
  basePath,
  canEdit = false,
  goals = [],
  plans = [],
  actions = [],
  readingPlans = [],
  categoryId,
  sessions = [],
  notes = [],
  chatSummary,
  allowMentorOnlyNotes = false,
  activityAssignments = [],
  assignableActivities = [],
}: {
  student: StudentListItem;
  profile?: GrowthProfile;
  history: AssignmentHistoryItem[];
  auditEvents?: AuditEventListItem[];
  activeTab: ProfileTabKey;
  basePath: string;
  canEdit?: boolean;
  goals?: Goal[];
  plans?: IndividualPlan[];
  actions?: Action[];
  readingPlans?: { plan: ReadingPlan; book: { title: string } }[];
  categoryId?: string;
  sessions?: MentoringSessionListItem[];
  notes?: MentorNoteListItem[];
  chatSummary?: { activeConversation: ConversationListItem | null; messageCount: number };
  allowMentorOnlyNotes?: boolean;
  activityAssignments?: ActivityAssignmentItem[];
  assignableActivities?: { id: string; title: string }[];
}) {
  async function submitGoal(formData: FormData) {
    "use server";
    await createGoalAction({}, formData);
  }
  async function submitPlan(formData: FormData) {
    "use server";
    await createPlanAction({}, formData);
  }
  async function submitAction(formData: FormData) {
    "use server";
    await createActionAction({}, formData);
  }
  return (
    <>
      <ProfileHeader student={student} profile={profile} />
      <ProfileTabs basePath={basePath} activeTab={activeTab} />

      {activeTab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileSectionCard title="اطلاعات فردی" icon="👤" accent="teal">
            <InfoFieldRow>
              <span className="text-xs text-[var(--muted-foreground)]">نام و نام خانوادگی</span>
              <p className="font-medium">{student.fullName}</p>
            </InfoFieldRow>
            <InfoFieldRow>
              <span className="text-xs text-[var(--muted-foreground)]">تاریخ تولد</span>
              <p>{profile?.birthDate ? formatDateFa(profile.birthDate) : "—"}</p>
            </InfoFieldRow>
            <InfoFieldRow>
              <span className="text-xs text-[var(--muted-foreground)]">کد ملی</span>
              <p>{toFaDigits(profile?.nationalId?.trim()) || "—"}</p>
            </InfoFieldRow>
            <InfoFieldRow>
              <span className="text-xs text-[var(--muted-foreground)]">شماره تماس</span>
              <p>{toFaDigits(profile?.phone?.trim()) || "—"}</p>
            </InfoFieldRow>
            <InfoFieldRow>
              <span className="text-xs text-[var(--muted-foreground)]">آدرس</span>
              <p>{toFaDigits(profile?.address?.trim()) || "—"}</p>
            </InfoFieldRow>
          </ProfileSectionCard>

          <ProfileSectionCard title="خانواده و والدین" icon="⌂" accent="orange">
            <InfoFieldRow accent="orange">
              <span className="text-xs text-[var(--muted-foreground)]">نام پدر</span>
              <p>{profile?.fatherName?.trim() || "—"}</p>
            </InfoFieldRow>
            <InfoFieldRow accent="orange">
              <span className="text-xs text-[var(--muted-foreground)]">تاریخ تولد پدر</span>
              <p>{profile?.fatherBirthDate ? formatDateFa(profile.fatherBirthDate) : "—"}</p>
            </InfoFieldRow>
            <InfoFieldRow accent="orange">
              <span className="text-xs text-[var(--muted-foreground)]">شغل پدر</span>
              <p>{profile?.fatherJob?.trim() || "—"}</p>
            </InfoFieldRow>
            <InfoFieldRow accent="orange">
              <span className="text-xs text-[var(--muted-foreground)]">شغل مادر</span>
              <p>{profile?.motherJob?.trim() || "—"}</p>
            </InfoFieldRow>
            <InfoFieldRow accent="orange">
              <span className="text-xs text-[var(--muted-foreground)]">وضعیت پدر / مادر</span>
              <p>
                پدر: {aliveLabel(profile?.fatherAlive)} · مادر: {aliveLabel(profile?.motherAlive)}
              </p>
            </InfoFieldRow>
            <InfoFieldRow accent="orange">
              <span className="text-xs text-[var(--muted-foreground)]">زندگی مشترک والدین</span>
              <p>{parentsTogetherLabel(profile?.parentsLiveTogether)}</p>
            </InfoFieldRow>
            <InfoFieldRow accent="orange">
              <span className="text-xs text-[var(--muted-foreground)]">خواهر و برادر</span>
              {parseSiblingsJson(profile?.siblingsJson).length === 0 ? (
                <p>—</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {parseSiblingsJson(profile?.siblingsJson).map((s, idx) => (
                    <li key={idx}>{formatSiblingFa(s)}</li>
                  ))}
                </ul>
              )}
            </InfoFieldRow>
          </ProfileSectionCard>

          <Card>
            <CardHeader>
              <CardTitle>پرونده رشد تربیتی</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow label="علایق" value={profile?.interests} />
              <InfoRow label="مهارت‌ها" value={profile?.skills} />
              <InfoRow label="وضعیت تحصیلی" value={profile?.academicStatus} />
              <InfoRow label="جمع‌بندی مربی" value={profile?.overallNote} />
              <InfoRow
                label="آخرین به‌روزرسانی"
                value={profile?.updatedAt ? formatDateFa(profile.updatedAt) : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>اطلاعات پایه سامانه</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow label="نام کامل" value={student.fullName} />
              <InfoRow label="پایه تحصیلی" value={student.gradeTitleFa} />
              <InfoRow label="گروه" value={student.groupTitle} />
              <InfoRow label="مربی فعال" value={student.mentorName} />
              <InfoRow label="کمک‌مربی فعال" value={student.assistantName} />
              <InfoRow label="تاریخ ثبت" value={formatDateFa(student.createdAt)} />
            </CardContent>
          </Card>

          {canEdit ? (
            <div className="lg:col-span-2">
              <GrowthProfileForm studentId={student.id} profile={profile} variant="staff" />
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "history" ? (
        <HistoryTab history={history} auditEvents={auditEvents} />
      ) : null}

      {activeTab === "goals" ? (
        <Card>
          <CardHeader>
            <CardTitle>اهداف</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.map((goal) => (
              <div key={goal.id} className="rounded-lg border p-3">
                {goal.title}
              </div>
            ))}
            {canEdit && categoryId ? (
              <form action={submitGoal} className="grid gap-2 md:grid-cols-3">
                <input type="hidden" name="studentId" value={student.id} />
                <input type="hidden" name="categoryId" value={categoryId} />
                <input type="hidden" name="priority" value={PRIORITY.MEDIUM} />
                <input type="hidden" name="startDate" value={new Date().toISOString()} />
                <input type="hidden" name="status" value={GOAL_STATUS.ACTIVE} />
                <Input name="title" placeholder="هدف جدید" required />
                <Button>ثبت هدف</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "plan" ? (
        <Card>
          <CardHeader>
            <CardTitle>برنامه فردی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border p-3">
                {plan.title}
              </div>
            ))}
            {canEdit ? (
              <form action={submitPlan} className="flex gap-2">
                <input type="hidden" name="studentId" value={student.id} />
                <input type="hidden" name="status" value={PLAN_STATUS.ACTIVE} />
                <Input name="title" placeholder="برنامه جدید" required />
                <Button>ثبت برنامه</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "actions" ? (
        <Card>
          <CardHeader>
            <CardTitle>اقدامات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.map((action) => (
              <div key={action.id} className="rounded-lg border p-3">
                {action.title} —{" "}
                {ACTION_STATUS_TITLES_FA[action.status as keyof typeof ACTION_STATUS_TITLES_FA] ??
                  action.status}
              </div>
            ))}
            {canEdit ? (
              <form action={submitAction} className="grid gap-2 md:grid-cols-3">
                <input type="hidden" name="studentId" value={student.id} />
                <input type="hidden" name="assigneeUserId" value={student.userId ?? ""} />
                <input type="hidden" name="type" value={ACTION_TYPE.TASK} />
                <input type="hidden" name="startDate" value={new Date().toISOString()} />
                <input type="hidden" name="priority" value={PRIORITY.MEDIUM} />
                <Input name="title" placeholder="اقدام جدید" required />
                <Button>ثبت اقدام</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "learning" ? (
        <Card>
          <CardHeader>
            <CardTitle>یادگیری و مطالعه</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {readingPlans.map(({ plan, book }) => (
              <div key={plan.id} className="rounded-lg border p-3">
                {book.title} — {toFaDigits(plan.progress)}٪
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "sessions" ? (
        <SessionsChatTab sessions={sessions} chatSummary={chatSummary} />
      ) : null}

      {activeTab === "notes" ? (
        <NotesTab
          notes={notes}
          studentId={student.id}
          canEdit={canEdit}
          allowMentorOnly={allowMentorOnlyNotes}
        />
      ) : null}

      {activeTab === "activities" ? (
        <ActivitiesTab
          studentId={student.id}
          assignments={activityAssignments}
          assignableActivities={assignableActivities}
          canEdit={canEdit}
        />
      ) : null}
    </>
  );
}
