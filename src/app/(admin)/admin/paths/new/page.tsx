import Link from "next/link";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { listGrades } from "@/server/modules/grades/service";
import { PathForm } from "../path-form";

export const runtime = "nodejs";

export default async function NewPathPage() {
  const user = await requireRole(ROLE_KEYS.ADMIN);

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
        title="مسیر رشد جدید"
        description="پس از ایجاد مسیر، اهداف آن را در صفحه مسیر ثبت کنید."
      />

      <PathForm grades={listGrades()} />
    </AdminShell>
  );
}
