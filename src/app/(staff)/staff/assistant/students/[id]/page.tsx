import Link from "next/link";
import { notFound } from "next/navigation";
import { AssistantShell } from "@/components/patterns/assistant-shell";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS, ACTIVITY_STATUS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  canStaffAccessStudent,
  getGrowthProfile,
  getStudentById,
  listAssignmentHistory,
} from "@/server/modules/students/service";
import { listAuditEventsForStudent } from "@/server/modules/audit/service";
import {
  isProfileTab,
  StudentProfileView,
} from "@/components/students/student-profile-view";
import { listActions, listGoals, listPlans } from "@/server/modules/plans/service";
import { listReadingPlansForStudent } from "@/server/modules/books/service";
import { listSessions } from "@/server/modules/sessions/service";
import { listNotesForStudent } from "@/server/modules/notes/service";
import { summarizeChatForStudent } from "@/server/modules/chat/service";
import {
  listActivities,
  listAssignmentsForStudent,
} from "@/server/modules/activities/service";

export const runtime = "nodejs";

export default async function AssistantStudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ASSISTANT_MENTOR);
  assertPermission(user, PERMISSIONS.STUDENTS_VIEW_SCOPED);

  const { id } = await params;
  const { tab } = await searchParams;

  if (!canStaffAccessStudent(user.id, user.roleKey, id)) notFound();

  const student = getStudentById(id);
  if (!student) notFound();

  return (
    <AssistantShell user={user}>
      <div className="mb-4">
        <Link
          href="/staff/assistant/students"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          بازگشت به دانش‌آموزان من
        </Link>
      </div>

      <StudentProfileView
        student={student}
        profile={getGrowthProfile(id)}
        history={listAssignmentHistory(id)}
        auditEvents={listAuditEventsForStudent(id)}
        activeTab={isProfileTab(tab) ? tab : "overview"}
        basePath={`/staff/assistant/students/${id}`}
        canEdit
        goals={listGoals({ studentId: id })}
        plans={listPlans({ studentId: id })}
        actions={listActions({ studentId: id })}
        readingPlans={listReadingPlansForStudent(id).map((item) => ({
          plan: item,
          book: { title: item.bookTitle },
        }))}
        sessions={listSessions({ studentId: id })}
        notes={listNotesForStudent(id, user.id, user.roleKey)}
        chatSummary={summarizeChatForStudent(id)}
        activityAssignments={listAssignmentsForStudent(id)}
        assignableActivities={listActivities({ status: ACTIVITY_STATUS.PUBLISHED }).map((a) => ({
          id: a.id,
          title: a.title,
        }))}
      />
    </AssistantShell>
  );
}
