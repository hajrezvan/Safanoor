import { StaffShell } from "@/components/patterns/staff-shell";
import type { AuthUser } from "@/server/auth/session";

export function AdminShell({
  user,
  children,
  title = "پنل مدیر",
}: {
  user: AuthUser;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <StaffShell user={user} title={title}>
      {children}
    </StaffShell>
  );
}
