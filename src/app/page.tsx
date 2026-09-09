import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { ROLE_KEYS } from "@/lib/enums";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  switch (user.roleKey) {
    case ROLE_KEYS.ADMIN:
    case ROLE_KEYS.MENTOR:
    case ROLE_KEYS.ASSISTANT_MENTOR:
      redirect("/staff");
    case ROLE_KEYS.STUDENT:
      redirect("/student");
    default:
      redirect("/login");
  }
}
