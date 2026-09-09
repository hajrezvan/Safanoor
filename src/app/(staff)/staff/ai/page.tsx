import { redirect } from "next/navigation";
import { ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";

export const runtime = "nodejs";

export default async function StaffAiRedirect() {
  await requireRole(ROLE_KEYS.ADMIN, ROLE_KEYS.MENTOR);
  redirect("/staff/mentor/ai");
}
