import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/auth/guards";
import {
  PATH_ENROLLMENT_STATUS_TITLES_FA,
  GROWTH_PATH_STATUS_TITLES_FA,
  ROLE_KEYS,
} from "@/lib/enums";
import { cn } from "@/lib/utils";
import { formatDateFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import { listGrades } from "@/server/modules/grades/service";
import {
  getPathById,
  listObjectives,
  listPathStudents,
} from "@/server/modules/paths/service";
import { deleteObjectiveAction, deletePathAction } from "@/server/actions/paths";
import { PathForm } from "../path-form";
import { ObjectiveForm } from "./objective-form";

export const runtime = "nodejs";

export default async function AdminPathDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  const { id } = await params;

  const path = getPathById(id);
  if (!path) notFound();

  const objectives = listObjectives(id);
  const enrolled = listPathStudents(id);

  return (
    <AdminShell user={user}>
      <div className="mb-4">
        <Link
          href="/admin/paths"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          بازگشت به مسیرها
        </Link>
      </div>

      <PageHeader
        title={path.title}
        description={`پایه ${path.gradeTitleFa} — وضعیت: ${
          GROWTH_PATH_STATUS_TITLES_FA[path.status] ?? path.status
        }`}
        actions={
          path.activeEnrollmentCount === 0 ? (
            <form action={deletePathAction}>
              <input type="hidden" name="id" value={path.id} />
              <Button type="submit" variant="danger" size="sm">
                حذف مسیر
              </Button>
            </form>
          ) : null
        }
      />

      <div className="grid gap-6">
        <PathForm grades={listGrades()} path={path} />

        <Card>
          <CardHeader>
            <CardTitle>اهداف مسیر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {objectives.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                هنوز هدفی برای این مسیر ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-4">
                {objectives.map((objective) => (
                  <details
                    key={objective.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      {toFaDigits(objective.ordering)}. {objective.title}
                    </summary>
                    <div className="mt-4 space-y-4">
                      <ObjectiveForm pathId={path.id} objective={objective} />
                      <form action={deleteObjectiveAction}>
                        <input type="hidden" name="id" value={objective.id} />
                        <input type="hidden" name="pathId" value={path.id} />
                        <Button type="submit" variant="outline" size="sm">
                          حذف هدف
                        </Button>
                      </form>
                    </div>
                  </details>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-[var(--border)] p-4">
              <h3 className="mb-4 text-sm font-medium">افزودن هدف جدید</h3>
              <ObjectiveForm pathId={path.id} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>دانش‌آموزان این مسیر</CardTitle>
          </CardHeader>
          <CardContent>
            {enrolled.length === 0 ? (
              <EmptyState
                title="هنوز دانش‌آموزی ثبت‌نام نشده"
                description="مربی از تب «یادگیری» پرونده دانش‌آموز، مسیر فعال را انتخاب می‌کند."
              />
            ) : (
              <ul className="space-y-2">
                {enrolled.map((row) => (
                  <li
                    key={row.enrollmentId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <Link
                      href={`/admin/students/${row.studentId}?tab=learning`}
                      className="text-sm font-medium hover:underline"
                    >
                      {row.fullName ?? "بدون نام"}
                    </Link>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      از {formatDateFa(row.startedAt)}
                    </span>
                    <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs">
                      {PATH_ENROLLMENT_STATUS_TITLES_FA[row.status] ?? row.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
