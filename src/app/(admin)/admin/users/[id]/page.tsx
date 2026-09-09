import { notFound } from "next/navigation";
import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { getUserById } from "@/server/modules/users/service";
import { EditUserForms } from "./edit-user-forms";

export const runtime = "nodejs";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireRole(ROLE_KEYS.ADMIN);
  const { id } = await params;
  const target = getUserById(id);
  if (!target) notFound();

  return (
    <AdminShell user={admin}>
      <PageHeader
        title={target.fullName}
        description={`ویرایش حساب «${target.username}» — ${target.roleTitleFa}`}
      />
      <EditUserForms user={target} />
    </AdminShell>
  );
}
