import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { requireRole } from "@/server/auth/guards";
import { ROLE_KEYS } from "@/lib/enums";
import { CreateUserForm } from "./create-user-form";

export const runtime = "nodejs";

export default async function NewUserPage() {
  const user = await requireRole(ROLE_KEYS.ADMIN);
  return (
    <AdminShell user={user}>
      <PageHeader
        title="کاربر جدید"
        description="حساب توسط مدیر ساخته می‌شود؛ ثبت‌نام عمومی وجود ندارد."
      />
      <CreateUserForm />
    </AdminShell>
  );
}
