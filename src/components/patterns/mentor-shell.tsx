import { StaffShell } from "@/components/patterns/staff-shell";
import type { AuthUser } from "@/server/auth/session";

/** سازگاری با مسیرهای قدیمی — همه staff از StaffShell استفاده می‌کنند. */
export function MentorShell({
  user,
  children,
  title = "پنل مربی",
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
