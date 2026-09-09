import { StaffShell } from "@/components/patterns/staff-shell";
import type { AuthUser } from "@/server/auth/session";

export function AssistantShell({
  user,
  children,
  title = "پنل کمک‌مربی",
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
