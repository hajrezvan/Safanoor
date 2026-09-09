import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/patterns/data-table";
import { EmptyState } from "@/components/patterns/empty-state";
import { STUDENT_STATUS_TITLES_FA } from "@/lib/enums";
import type { StudentListItem } from "@/server/modules/students/service";

export function StudentsTable({
  students,
  hrefBase,
  emptyTitle = "دانش‌آموزی یافت نشد",
  emptyDescription,
  emptyAction,
  showStaffColumns = true,
}: {
  students: StudentListItem[];
  hrefBase: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  showStaffColumns?: boolean;
}) {
  return (
    <DataTable
      rows={students}
      rowKey={(row) => row.id}
      empty={
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      }
      columns={[
        {
          key: "fullName",
          header: "نام",
          cell: (row) => (
            <Link
              className="font-medium text-[var(--brand)]"
              href={`${hrefBase}/${row.id}`}
            >
              {row.fullName}
            </Link>
          ),
        },
        { key: "grade", header: "پایه", cell: (row) => row.gradeTitleFa ?? "—" },
        { key: "group", header: "گروه", cell: (row) => row.groupTitle ?? "—" },
        ...(showStaffColumns
          ? [
              {
                key: "mentor",
                header: "مربی",
                cell: (row: StudentListItem) => row.mentorName ?? "—",
              },
              {
                key: "assistant",
                header: "کمک‌مربی",
                cell: (row: StudentListItem) => row.assistantName ?? "—",
              },
            ]
          : []),
        {
          key: "status",
          header: "وضعیت",
          cell: (row) => STUDENT_STATUS_TITLES_FA[row.status] ?? row.status,
        },
      ]}
    />
  );
}
