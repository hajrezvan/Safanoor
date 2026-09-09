import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTIVITY_ASSIGNMENT_STATUS,
  ACTIVITY_ASSIGNMENT_STATUS_TITLES_FA,
  ACTIVITY_TYPE_TITLES_FA,
  ROLE_KEYS,
  type ActivityAssignmentStatus,
  type ActivityType,
} from "@/lib/enums";
import { formatDateFa, formatDateTimeFa } from "@/lib/date";
import { requireRole } from "@/server/auth/guards";
import { getStudentByUserId } from "@/server/modules/students/service";
import { listAssignmentsForStudent } from "@/server/modules/activities/service";
import { SubmitProgressForm } from "@/components/activities/submit-progress-form";

export const runtime = "nodejs";

export default async function StudentActivitiesPage() {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(user.id);
  const assignments = student ? listAssignmentsForStudent(student.id) : [];

  return (
    <StudentShell user={user}>
      <PageHeader
        title="فعالیت‌های من"
        description="پروژه‌ها و فعالیت‌های محول‌شده؛ گزارش انجام و شواهد را اینجا بفرستید."
      />

      {!student ? (
        <EmptyState
          title="پرونده یافت نشد"
          description="پس از ثبت پرونده دانش‌آموزی، فعالیت‌ها اینجا نمایش داده می‌شود."
        />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="فعالیتی محول نشده"
          description="وقتی مربی یا کمک‌مربی فعالیتی به شما بدهد، اینجا ظاهر می‌شود."
        />
      ) : (
        <div className="grid gap-4">
          {assignments.map((item) => {
            const canSubmit =
              item.status === ACTIVITY_ASSIGNMENT_STATUS.ASSIGNED ||
              item.status === ACTIVITY_ASSIGNMENT_STATUS.IN_PROGRESS ||
              item.status === ACTIVITY_ASSIGNMENT_STATUS.OVERDUE;

            return (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.activityTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm leading-7">
                  <p>
                    نوع:{" "}
                    {ACTIVITY_TYPE_TITLES_FA[item.activityType as ActivityType] ??
                      item.activityType}
                    {" — "}
                    وضعیت:{" "}
                    {ACTIVITY_ASSIGNMENT_STATUS_TITLES_FA[
                      item.status as ActivityAssignmentStatus
                    ] ?? item.status}
                  </p>
                  {item.dueDate ? <p>مهلت: {formatDateFa(item.dueDate)}</p> : null}
                  {item.instructions ? <p>دستورالعمل: {item.instructions}</p> : null}
                  {item.expectedOutput ? (
                    <p>خروجی مورد انتظار: {item.expectedOutput}</p>
                  ) : null}
                  {item.result ? (
                    <p className="rounded-lg bg-[var(--muted)] p-3">
                      گزارش شما: {item.result}
                      {item.submittedAt
                        ? ` (${formatDateTimeFa(item.submittedAt)})`
                        : ""}
                    </p>
                  ) : null}
                  {item.evidenceUrl ? (
                    <p>
                      لینک شواهد:{" "}
                      <a href={item.evidenceUrl} className="underline" target="_blank" rel="noreferrer">
                        مشاهده
                      </a>
                    </p>
                  ) : null}
                  {item.evidenceFilePath ? (
                    <p>
                      فایل شواهد:{" "}
                      <a href={item.evidenceFilePath} className="underline" target="_blank" rel="noreferrer">
                        دانلود
                      </a>
                    </p>
                  ) : null}
                  {item.feedback || item.mentorFeedback ? (
                    <p className="rounded-lg border border-[var(--border)] p-3">
                      بازخورد مربی: {item.feedback || item.mentorFeedback}
                    </p>
                  ) : null}
                  {canSubmit ? <SubmitProgressForm assignmentId={item.id} /> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}
