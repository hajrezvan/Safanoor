import Link from "next/link";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { listGrades } from "@/server/modules/grades/service";
import { listGroups } from "@/server/modules/groups/service";
import {
  listStaffUsers,
  listUnlinkedStudentUsers,
} from "@/server/modules/students/service";
import { CreateStudentForm } from "./create-student-form";

export const runtime = "nodejs";

export default async function NewStudentPage() {
  const user = await requireRole(ROLE_KEYS.ADMIN);

  const grades = listGrades();
  const groups = listGroups();
  const unlinkedUsers = listUnlinkedStudentUsers();
  const mentors = listStaffUsers(ROLE_KEYS.MENTOR);
  const assistants = listStaffUsers(ROLE_KEYS.ASSISTANT_MENTOR);

  return (
    <AdminShell user={user}>
      <PageHeader
        title="دانش‌آموز جدید"
        description="حساب کاربری موجود را متصل کنید یا حساب تازه‌ای بسازید."
        actions={
          <Link href="/admin/students" className={cn(buttonVariants({ variant: "outline" }))}>
            بازگشت به لیست
          </Link>
        }
      />

      {grades.length === 0 ? (
        <EmptyState
          title="ابتدا پایه‌ها را بسازید"
          description="پرونده دانش‌آموز بدون پایه تحصیلی ثبت نمی‌شود."
          action={
            <Link href="/admin/grades" className={cn(buttonVariants())}>
              رفتن به پایه‌ها
            </Link>
          }
        />
      ) : (
        <CreateStudentForm
          unlinkedUsers={unlinkedUsers}
          grades={grades}
          groups={groups}
          mentors={mentors}
          assistants={assistants}
        />
      )}
    </AdminShell>
  );
}
