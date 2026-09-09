import { MentorShell } from "@/components/patterns/mentor-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { listGrades } from "@/server/modules/grades/service";
import { listGroups } from "@/server/modules/groups/service";
import { listStudentsForStaff } from "@/server/modules/students/service";
import { StudentFilterBar } from "@/components/students/student-filter-bar";
import { StudentsTable } from "@/components/students/students-table";

export const runtime = "nodejs";

export default async function MentorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; grade?: string; group?: string; status?: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.STUDENTS_VIEW_SCOPED);
  const params = await searchParams;

  const students = listStudentsForStaff(user.id, user.roleKey, {
    search: params.q,
    gradeId: params.grade || undefined,
    groupId: params.group || undefined,
    status: params.status || undefined,
  });

  return (
    <MentorShell user={user}>
      <PageHeader
        title="دانش‌آموزان من"
        description="فقط دانش‌آموزانی که تخصیص فعال مربی‌گری آن‌ها با شماست."
      />

      <StudentFilterBar params={params} grades={listGrades()} groups={listGroups()} />

      <StudentsTable
        students={students}
        hrefBase="/staff/mentor/students"
        emptyTitle="دانش‌آموزی به شما تخصیص نیافته"
        emptyDescription="پس از تخصیص توسط مدیر، دانش‌آموزان شما اینجا نمایش داده می‌شوند."
      />
    </MentorShell>
  );
}
