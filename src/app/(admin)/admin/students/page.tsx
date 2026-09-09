import Link from "next/link";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { listGrades } from "@/server/modules/grades/service";
import { listGroups } from "@/server/modules/groups/service";
import { listStaffUsers, listStudents } from "@/server/modules/students/service";
import { StudentFilterBar } from "@/components/students/student-filter-bar";
import { StudentsTable } from "@/components/students/students-table";

export const runtime = "nodejs";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    grade?: string;
    group?: string;
    mentor?: string;
    assistant?: string;
    status?: string;
  }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const params = await searchParams;

  const grades = listGrades();
  const groups = listGroups();
  const mentors = listStaffUsers(ROLE_KEYS.MENTOR);
  const assistants = listStaffUsers(ROLE_KEYS.ASSISTANT_MENTOR);

  const students = listStudents({
    search: params.q,
    gradeId: params.grade || undefined,
    groupId: params.group || undefined,
    mentorUserId: params.mentor || undefined,
    assistantUserId: params.assistant || undefined,
    status: params.status || undefined,
  });

  const newStudentLink = (
    <Link href="/admin/students/new" className={cn(buttonVariants())}>
      دانش‌آموز جدید
    </Link>
  );

  return (
    <AdminShell user={user}>
      <PageHeader
        title="دانش‌آموزان"
        description="پرونده رشد، پایه، گروه و تخصیص مربی و کمک‌مربی."
        actions={newStudentLink}
      />

      <StudentFilterBar
        params={params}
        grades={grades}
        groups={groups}
        mentors={mentors}
        assistants={assistants}
      />

      <StudentsTable
        students={students}
        hrefBase="/admin/students"
        emptyDescription="با فیلترهای دیگر جستجو کنید یا پرونده دانش‌آموز جدیدی بسازید."
        emptyAction={newStudentLink}
      />
    </AdminShell>
  );
}
