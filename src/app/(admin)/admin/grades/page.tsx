import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { formatDateFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import { listGrades } from "@/server/modules/grades/service";
import { listGroups } from "@/server/modules/groups/service";
import { seedGradesAction } from "@/server/actions/grades";

export const runtime = "nodejs";

export default async function AdminGradesPage() {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const grades = listGrades();
  const groups = listGroups();

  const groupCountByGrade = groups.reduce<Record<string, number>>((acc, group) => {
    acc[group.gradeId] = (acc[group.gradeId] ?? 0) + 1;
    return acc;
  }, {});

  const seedButton = (
    <form action={seedGradesAction}>
      <Button type="submit" variant={grades.length ? "outline" : "default"}>
        {grades.length ? "تکمیل پایه‌های پیش‌فرض" : "ایجاد پایه‌های هفتم تا دوازدهم"}
      </Button>
    </form>
  );

  return (
    <AdminShell user={user}>
      <PageHeader
        title="پایه‌های تحصیلی"
        description="پایه‌های هفتم تا دوازدهم مبنای گروه‌بندی و مسیرهای تربیتی هستند."
        actions={seedButton}
      />

      <DataTable
        rows={grades}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            title="هنوز پایه‌ای ثبت نشده"
            description="با یک کلیک پایه‌های هفتم تا دوازدهم ساخته می‌شوند."
            action={seedButton}
          />
        }
        columns={[
          { key: "ordering", header: "ترتیب", cell: (row) => toFaDigits(row.ordering) },
          {
            key: "titleFa",
            header: "عنوان",
            cell: (row) => <span className="font-medium">{row.titleFa}</span>,
          },
          { key: "key", header: "کلید", cell: (row) => row.key },
          {
            key: "groups",
            header: "تعداد گروه",
            cell: (row) => toFaDigits(groupCountByGrade[row.id] ?? 0),
          },
          {
            key: "createdAt",
            header: "تاریخ ثبت",
            cell: (row) => formatDateFa(row.createdAt),
          },
        ]}
      />
    </AdminShell>
  );
}
