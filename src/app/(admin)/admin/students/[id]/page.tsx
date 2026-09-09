import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/patterns/admin-shell";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS, ACTIVITY_STATUS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { listGrades } from "@/server/modules/grades/service";
import { listGroups } from "@/server/modules/groups/service";
import {
  getGrowthProfile,
  getStudentById,
  listAssignmentHistory,
  listStaffUsers,
} from "@/server/modules/students/service";
import { listAuditEventsForStudent } from "@/server/modules/audit/service";
import {
  isProfileTab,
  StudentProfileView,
} from "@/components/students/student-profile-view";
import { EditStudentForm } from "./edit-student-form";
import { listSessions } from "@/server/modules/sessions/service";
import { listNotesForStudent } from "@/server/modules/notes/service";
import { summarizeChatForStudent } from "@/server/modules/chat/service";
import {
  listActivities,
  listAssignmentsForStudent,
} from "@/server/modules/activities/service";

export const runtime = "nodejs";

export default async function AdminStudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const { id } = await params;
  const { tab } = await searchParams;

  const student = getStudentById(id);
  if (!student) notFound();

  const activeTab = isProfileTab(tab) ? tab : "overview";
  const profile = getGrowthProfile(id);
  const history = listAssignmentHistory(id);
  const auditEvents = listAuditEventsForStudent(id);

  return (
    <AdminShell user={user}>
      <div className="mb-4">
        <Link
          href="/admin/students"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          بازگشت به لیست دانش‌آموزان
        </Link>
      </div>

      <StudentProfileView
        student={student}
        profile={profile}
        history={history}
        auditEvents={auditEvents}
        activeTab={activeTab}
        basePath={`/admin/students/${id}`}
        canEdit
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

      {activeTab === "overview" ? (
        <div className="mt-6">
          <EditStudentForm
            student={student}
            grades={listGrades()}
            groups={listGroups()}
            mentors={listStaffUsers(ROLE_KEYS.MENTOR)}
            assistants={listStaffUsers(ROLE_KEYS.ASSISTANT_MENTOR)}
          />
        </div>
      ) : null}
    </AdminShell>
  );
}
