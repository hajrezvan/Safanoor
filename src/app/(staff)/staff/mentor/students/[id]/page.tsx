import Link from "next/link";
import { notFound } from "next/navigation";
import { MentorShell } from "@/components/patterns/mentor-shell";
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
import {
  listGoals,
  listPlans,
  listActions,
  listGoalCategories,
  seedGoalCategories,
} from "@/server/modules/plans/service";
import { listReadingPlansForStudent } from "@/server/modules/books/service";
import { listSessions } from "@/server/modules/sessions/service";
import { listNotesForStudent } from "@/server/modules/notes/service";
import { summarizeChatForStudent } from "@/server/modules/chat/service";
import {
  listActivities,
  listAssignmentsForStudent,
} from "@/server/modules/activities/service";

export const runtime = "nodejs";

export default async function MentorStudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.STUDENTS_VIEW_SCOPED);

  const { id } = await params;
  const { tab } = await searchParams;

  if (!canStaffAccessStudent(user.id, user.roleKey, id)) notFound();

  const student = getStudentById(id);
  if (!student) notFound();
  if (!listGoalCategories().length) seedGoalCategories();
  const categories = listGoalCategories();

  return (
    <MentorShell user={user}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/staff/mentor/students"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          بازگشت به دانش‌آموزان من
        </Link>
        <Link
          href={`/staff/mentor/ai?studentId=${id}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          مربی‌یار هوشمند
        </Link>
      </div>

      <StudentProfileView
        student={student}
        profile={getGrowthProfile(id)}
        history={listAssignmentHistory(id)}
        auditEvents={listAuditEventsForStudent(id)}
        activeTab={isProfileTab(tab) ? tab : "overview"}
        basePath={`/staff/mentor/students/${id}`}
        canEdit
        goals={listGoals({ studentId: id })}
        plans={listPlans({ studentId: id })}
        actions={listActions({ studentId: id })}
        readingPlans={listReadingPlansForStudent(id).map((item) => ({
          plan: item,
          book: { title: item.bookTitle },
        }))}
        categoryId={categories[0]?.id}
        sessions={listSessions({ studentId: id })}
        notes={listNotesForStudent(id, user.id, user.roleKey)}
        chatSummary={summarizeChatForStudent(id)}
        allowMentorOnlyNotes
        activityAssignments={listAssignmentsForStudent(id)}
        assignableActivities={listActivities({ status: ACTIVITY_STATUS.PUBLISHED }).map((a) => ({
          id: a.id,
          title: a.title,
        }))}
      />
    </MentorShell>
  );
}
