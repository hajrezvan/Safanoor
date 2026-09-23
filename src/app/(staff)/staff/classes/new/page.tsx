import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { CourseForm } from "@/components/learning/course-form";
import { requireRole } from "@/server/auth/guards";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import { ROLE_KEYS } from "@/lib/enums";

export default async function NewSchoolCoursePage() {
  const user = await requireRole(ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.CLASSES_MANAGE);
  return <StaffShell user={user} title="دوره جدید">
    <PageHeader title="دوره جدید" description="ساخت دوره آموزشی مدرسه" />
    <CourseForm />
  </StaffShell>;
}
